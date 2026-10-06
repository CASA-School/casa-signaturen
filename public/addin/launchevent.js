/* CASA Signatur – Outlook-Add-in.
 * Setzt beim Verfassen automatisch die CASA-Signatur des Absenderpostfachs (auch info@, abend@ … bei geteilten
 * Postfächern) und tauscht sie, wenn im Feld "Von" ein anderes Postfach gewählt wird. Eine schon vorhandene
 * Outlook-Signatur wird ersetzt, nicht verdoppelt (setSignatureAsync ersetzt den Signaturblock).
 * Quelle der Signaturen: signatures.json (gebaut von build_site.py, gleiche Daten wie die Webseite). */
var CASA_SIG_URL = "https://casa-signaturen.vercel.app/addin/signatures.json";
var casaSigCache = null;

function casaLoadSignatures() {
  if (casaSigCache) return Promise.resolve(casaSigCache);
  return fetch(CASA_SIG_URL, { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (j) { casaSigCache = j; return j; });
}

function casaGetFrom() {
  return new Promise(function (resolve) {
    var item = Office.context.mailbox.item;
    if (item && item.from && item.from.getAsync) {
      item.from.getAsync(function (r) {
        resolve(r.status === Office.AsyncResultStatus.Succeeded && r.value ? r.value.emailAddress : null);
      });
    } else {
      resolve(null);
    }
  });
}

function casaInsertSignature(event) {
  var done = function () { if (event && event.completed) event.completed(); };
  Promise.all([casaLoadSignatures(), casaGetFrom()])
    .then(function (res) {
      var sigs = res[0];
      var from = (res[1] || Office.context.mailbox.userProfile.emailAddress || "").toLowerCase();
      var html = sigs[from];
      if (!html) { done(); return; } // kein CASA-Postfach aus der Liste: Outlook-Signatur bleibt, wie sie ist
      Office.context.mailbox.item.body.setSignatureAsync(html, { coercionType: Office.CoercionType.Html }, done);
    })
    .catch(done);
}

function onNewMessageComposeHandler(event) { casaInsertSignature(event); }
function onMessageFromChangedHandler(event) { casaInsertSignature(event); }
function insertSignatureCommand(event) { casaInsertSignature(event); }

Office.onReady(function () {});
if (Office.actions && Office.actions.associate) {
  Office.actions.associate("onNewMessageComposeHandler", onNewMessageComposeHandler);
  Office.actions.associate("onMessageFromChangedHandler", onMessageFromChangedHandler);
  Office.actions.associate("insertSignatureCommand", insertSignatureCommand);
}
