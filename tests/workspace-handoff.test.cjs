const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname,'../public/addin/launchevent.js'),'utf8');
const token = 'A'.repeat(43);
const payload = {to:['nobody@example.invalid'],bcc:['blind@example.invalid'],subject:'Checked subject',html:'<p>Checked body</p>',signature:'<p>Signature<img src="cid:sig-logo"></p>',attachments:[{name:'logo.png',contentId:'sig-logo',contentBytes:'aW1hZ2U=',inline:true},{name:'Letter.pdf',contentBytes:'JVBERi0=',inline:false}]};
function setup({failAttachment=false,editDuringLoad=false,bccCount=0}={}) {
  const calls=[], acknowledgements=[];
  let body='CASA Workspace bereitet diese Nachricht vor. Bitte noch nicht senden.\n\n[CASA-WORKSPACE:'+token+']';
  const ok=cb=>cb({status:'ok'});
  const item={
    body:{getAsync(type,cb){cb({status:'ok',value:body});},setAsync(html,opts,cb){calls.push(['body',html]);body=html;ok(cb);},setSignatureAsync(html,opts,cb){calls.push(['signature',html]);ok(cb);}},
    subject:{setAsync(text,cb){calls.push(['subject',text]);ok(cb);}},
    to:{setAsync(list,cb){calls.push(['to',list]);ok(cb);}},bcc:{setAsync(list,cb){calls.push(['bcc',list]);ok(cb);},addAsync(list,cb){calls.push(['bcc-add',list]);ok(cb);}},
    addFileAttachmentFromBase64Async(bytes,name,opts,cb){calls.push(['attachment',bytes,name,opts]);if(editDuringLoad)body+='\nMy new edit';cb({status:failAttachment?'failed':'ok'});},
    notificationMessages:{replaceAsync(key,notice,cb){calls.push(['notice',notice.message]);ok(cb);}}
  };
  const context={Promise,setTimeout:(fn,ms)=>setTimeout(fn,ms<1000?0:ms),clearTimeout,Office:{context:{mailbox:{item}},CoercionType:{Text:'text',Html:'html'},AsyncResultStatus:{Succeeded:'ok'},onReady(){},actions:{associate(){}}},fetch:async (url,request)=>{
    assert.equal(url,'https://admin.casa-bremen.de/admin/mail-handoff');
    const requestBody=JSON.parse(request.body);assert.equal(requestBody.token,token);assert.equal(request.credentials,'omit');
    if(requestBody.result)acknowledgements.push(requestBody.result);
    return {ok:true,json:async()=>({data:requestBody.result?{ok:true}:structuredClone(bccCount?{...payload,bcc:Array.from({length:bccCount},(_,i)=>'blind-'+i+'@example.invalid')}:payload),error:null})};
  }};
  vm.runInNewContext(source,context);
  return {context,calls,acknowledgements};
}
test('inserts actual attachment bytes and a native signature before addressing the compose window',async()=>{
  const {context,calls,acknowledgements}=setup();let completed=0;
  assert.equal(await context.casaTryWorkspace({completed(){completed++;}}),true);
  assert.equal(completed,1);assert.deepEqual(acknowledgements,['ready']);
  assert.equal(calls[0][0],'attachment');assert.equal(calls[1][0],'attachment');
  assert.equal(calls[1][1],'JVBERi0=');assert.equal(calls[1][2],'Letter.pdf');assert.equal(calls[1][3].isInline,false);
  assert.ok(calls.find(c=>c[0]==='signature')[1].includes('cid:casa-workspace-0-logo.png'));
  assert.deepEqual(calls.map(c=>c[0]),['attachment','attachment','body','signature','subject','bcc','to']);
});
test('attachment failure leaves recipients unset and reports an incomplete handoff',async()=>{
  const {context,calls,acknowledgements}=setup({failAttachment:true});let completed=0;
  await context.casaTryWorkspace({completed(){completed++;}});
  assert.equal(completed,1);assert.deepEqual(acknowledgements,['failed']);
  assert.equal(calls.some(c=>['to','bcc','body','signature'].includes(c[0])),false);
  assert.ok(calls.some(c=>c[0]==='notice'));
});
test('does not overwrite a message edited while attachment preparation was pending',async()=>{
  const {context,calls,acknowledgements}=setup({editDuringLoad:true});
  await context.casaTryWorkspace({completed(){}});
  assert.deepEqual(acknowledgements,['failed']);assert.equal(calls.some(c=>['body','to','bcc'].includes(c[0])),false);
});
test('leaves ordinary mail to the established signature handler without making a handoff request',async()=>{
  const {context}=setup();context.Office.context.mailbox.item.body.getAsync=(type,cb)=>cb({status:'ok',value:'Ordinary mail'});
  assert.equal(await context.casaTryWorkspace({completed(){throw new Error('Not a handoff');}}),false);
});

test('a token quoted inside ordinary mail is not treated as a workspace launch',async()=>{
  const {context}=setup();context.Office.context.mailbox.item.body.getAsync=(type,cb)=>cb({status:'ok',value:'Ordinary reply\n[CASA-WORKSPACE:'+token+']'});
  assert.equal(await context.casaTryWorkspace({completed(){throw new Error('Not a handoff');}}),false);
});

test('sets large Bcc lists in supported chunks while keeping every recipient private',async()=>{
  const {context,calls}=setup({bccCount:201});await context.casaTryWorkspace({completed(){}});
  assert.deepEqual(calls.filter(c=>c[0]==='bcc'||c[0]==='bcc-add').map(c=>c[1].length),[100,100,1]);
  assert.equal(calls.filter(c=>c[0]==='to')[0][1].length,1);
});
test('sender resolution does not race a pending workspace message',async()=>{
  const {context}=setup();let signature=0,completed=0;context.casaInsertSignature=()=>signature++;
  context.onMessageFromChangedHandler({completed(){completed++;}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(signature,0);assert.equal(completed,1);
});


test('Maryam uses the existing Bufdis signature without changing any sender identity',()=>{
  const signatures=JSON.parse(readFileSync(require('node:path').join(__dirname,'../public/addin/signatures.json'),'utf8'));
  assert.equal(signatures['m.trawally@casa-bremen.de'],signatures['bufdis@casa-bremen.de']);
  assert.ok(signatures['m.trawally@casa-bremen.de'].includes('bufdis@casa-bremen.de'));
});
test('a checked workspace message accepts the account selected by the operator',async()=>{
  const {context,calls,acknowledgements}=setup();
  context.Office.context.mailbox.item.from={getAsync(cb){cb({status:'ok',value:{emailAddress:'another-account@example.invalid'}});}};
  await context.casaTryWorkspace({completed(){}});
  assert.deepEqual(acknowledgements,['ready']);
  assert.ok(calls.some(c=>c[0]==='to'));assert.ok(calls.some(c=>c[0]==='signature'));
});
