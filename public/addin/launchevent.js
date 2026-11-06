/* CASA Signatur – Outlook-Add-in.
 * Setzt beim Verfassen automatisch die CASA-Signatur des Absenderpostfachs (auch info@, abend@ … bei geteilten
 * Postfächern) und tauscht sie, wenn im Feld "Von" ein anderes Postfach gewählt wird. Eine schon vorhandene
 * Outlook-Signatur wird ersetzt, nicht verdoppelt (setSignatureAsync ersetzt den Signaturblock).
 * Logo und Instagram-Symbol werden als Inline-Anhang (cid:) in die Mail gelegt, damit sie auch bei Empfängern
 * erscheinen, deren Mailprogramm externe Bilder blockiert (07.10.2026). Klappt das nicht, bleiben die Web-Adressen.
 * Quelle der Signaturen: signatures.json + images.json (gebaut von build_site.py, gleiche Daten wie die Webseite). */
var CASA_BASE = "https://casa-signaturen.vercel.app";
var CASA_INLINE = [
  { file: "casa-logo.png", cid: "casa-logo.png" },
  { file: "instagram-icon.png", cid: "casa-instagram.png" }
];
var casaCache = {};

function casaLoad(name) {
  if (casaCache[name]) return Promise.resolve(casaCache[name]);
  return fetch(CASA_BASE + "/addin/" + name, { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (j) { casaCache[name] = j; return j; });
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

function casaExistingInline() {
  // Namen der schon vorhandenen Inline-Anhänge (z. B. nach Wechsel im Feld "Von"), damit nichts doppelt angehängt wird
  return new Promise(function (resolve) {
    var item = Office.context.mailbox.item;
    if (!item.getAttachmentsAsync) { resolve([]); return; }
    item.getAttachmentsAsync(function (r) {
      if (r.status !== Office.AsyncResultStatus.Succeeded) { resolve([]); return; }
      resolve(r.value.filter(function (a) { return a.isInline; }).map(function (a) { return a.name; }));
    });
  });
}

function casaAttachInline(images) {
  // true, wenn alle Bilder als Inline-Anhang da sind
  return casaExistingInline().then(function (existing) {
    return Promise.all(CASA_INLINE.map(function (img) {
      if (existing.indexOf(img.cid) !== -1) return true;
      return new Promise(function (resolve) {
        Office.context.mailbox.item.addFileAttachmentFromBase64Async(
          images[img.file], img.cid, { isInline: true },
          function (r) { resolve(r.status === Office.AsyncResultStatus.Succeeded); });
      });
    }));
  }).then(function (results) { return results.every(Boolean); })
    .catch(function () { return false; });
}

function casaInsertSignature(event) {
  var done = function () { if (event && event.completed) event.completed(); };
  Promise.all([casaLoad("signatures.json"), casaGetFrom()])
    .then(function (res) {
      var sigs = res[0];
      var from = (res[1] || Office.context.mailbox.userProfile.emailAddress || "").toLowerCase();
      var html = sigs[from];
      if (!html) { done(); return; } // kein CASA-Postfach aus der Liste: Outlook-Signatur bleibt, wie sie ist
      var item = Office.context.mailbox.item;
      var inline = item.addFileAttachmentFromBase64Async
        ? casaLoad("images.json").then(casaAttachInline).catch(function () { return false; })
        : Promise.resolve(false);
      return inline.then(function (ok) {
        if (ok) {
          CASA_INLINE.forEach(function (img) {
            html = html.split(CASA_BASE + "/" + img.file).join("cid:" + img.cid);
          });
        }
        item.body.setSignatureAsync(html, { coercionType: Office.CoercionType.Html }, done);
      });
    })
    .catch(done);
}

// Workspace native compose bridge. The token grants one checked message for three minutes.
// No recipient is added until the body, signature and every attachment are present.
var CASA_WORKSPACE = "https://admin.casa-bremen.de/admin/mail-handoff";
function casaOfficeCall(object, method, args) {
  return new Promise(function (resolve, reject) {
    object[method].apply(object, args.concat(function (r) {
      if (r.status === Office.AsyncResultStatus.Succeeded) resolve(r.value);
      else reject(new Error("Outlook could not complete " + method));
    }));
  });
}
function casaWorkspaceRequest(token, result) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error("Workspace handoff timed out")); }, 20000);
    fetch(CASA_WORKSPACE, {
    method: "POST", credentials: "omit", cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result ? {token: token, result: result} : {token: token})
    }).then(function (r) { clearTimeout(timer); resolve(r); }, function (error) { clearTimeout(timer); reject(error); });
  }).then(function (r) {
    if (!r.ok) throw new Error("Workspace handoff unavailable or expired");
    return r.json();
  }).then(function (r) {
    if (r.error || !r.data) throw new Error("Workspace handoff unavailable");
    return r.data;
  });
}
function casaWorkspaceNotice(message) {
  var notifications = Office.context.mailbox.item.notificationMessages;
  if (notifications && notifications.replaceAsync) notifications.replaceAsync("casa-workspace", {
    type: "errorMessage", message: message
  }, function () {});
}
function casaWorkspaceToken(attempt) {
  return casaOfficeCall(Office.context.mailbox.item.body, "getAsync", [Office.CoercionType.Text]).then(function (body) {
    var found = /^CASA Workspace bereitet diese Nachricht vor\. Bitte noch nicht senden\.\s+\[CASA-WORKSPACE:([A-Za-z0-9_-]{43})\]/.exec((body || "").trim());
    if (found) return found[1];
    // mailto fields may still be resolving when OnNewMessageCompose fires.
    if (attempt < 2) return new Promise(function (resolve) { setTimeout(resolve, 200); }).then(function () { return casaWorkspaceToken(attempt + 1); });
    return null;
  });
}
function casaWorkspaceRecipients(field, recipients) {
  // Windows/web accept at most 100 recipients in one call; keep Bcc separate in every chunk.
  var chain = casaOfficeCall(field, "setAsync", [recipients.slice(0, 100)]);
  for (var index = 100; index < recipients.length; index += 100) {
    (function (chunk) { chain = chain.then(function () { return casaOfficeCall(field, "addAsync", [chunk]); }); })(recipients.slice(index, index + 100));
  }
  return chain;
}
function casaFillWorkspaceMessage(payload, token, initialBody) {
  var item = Office.context.mailbox.item;
  if (!payload || typeof payload.html !== "string" || typeof payload.subject !== "string" ||
      !Array.isArray(payload.attachments || []) || (payload.attachments || []).length > 30) return Promise.reject(new Error("Invalid checked message"));
  var html = payload.html, signature = payload.signature;
  var attachments = payload.attachments || [];
  // Office.js resolves cid references by attachment name, not Graph's contentId.
  attachments = attachments.map(function (attachment, index) {
    var inline = attachment.inline === true || (attachment.inline !== false && !!attachment.contentId);
    var name = inline ? "casa-workspace-" + index + "-" + attachment.name : attachment.name;
    if (inline && attachment.contentId) {
      html = html.split("cid:" + attachment.contentId).join("cid:" + name);
      if (signature) signature = signature.split("cid:" + attachment.contentId).join("cid:" + name);
    }
    return {name: name, bytes: attachment.contentBytes, inline: inline};
  });
  // Read before inserting inline images, as required by the Outlook body API.
  return casaOfficeCall(item.body, "getAsync", [Office.CoercionType.Html]).then(function (body) {
    if (body !== initialBody || body.indexOf("[CASA-WORKSPACE:" + token + "]") === -1) throw new Error("Message changed while preparing");
    return attachments.reduce(function (chain, attachment) {
      return chain.then(function () {
        return casaOfficeCall(item, "addFileAttachmentFromBase64Async", [attachment.bytes, attachment.name, {isInline: attachment.inline}]);
      });
    }, Promise.resolve());
  }).then(function () {
    return casaOfficeCall(item.body, "getAsync", [Office.CoercionType.Html]);
  }).then(function (body) {
    if (body !== initialBody || body.indexOf("[CASA-WORKSPACE:" + token + "]") === -1) throw new Error("Message changed while preparing");
    return casaOfficeCall(item.body, "setAsync", [html, {coercionType: Office.CoercionType.Html}]);
  }).then(function () {
    // A real signature block lets the existing From-changed handler replace it without duplication.
    return signature ? casaOfficeCall(item.body, "setSignatureAsync", [signature, {coercionType: Office.CoercionType.Html}]) : null;
  }).then(function () {
    return casaOfficeCall(item.subject, "setAsync", [payload.subject]);
  }).then(function () {
    return casaWorkspaceRecipients(item.bcc, payload.bcc || []);
  }).then(function () {
    return casaWorkspaceRecipients(item.to, Array.isArray(payload.to) ? payload.to : [payload.to]);
  });
}
function casaTryWorkspace(event) {
  var token;
  return casaWorkspaceToken(0).then(function (found) {
    token = found;
    if (!token) return false;
    return casaOfficeCall(Office.context.mailbox.item.body, "getAsync", [Office.CoercionType.Html]).then(function (initialBody) {
      return casaWorkspaceRequest(token).then(function (payload) { return casaFillWorkspaceMessage(payload, token, initialBody); });
    }).then(function () {
      var notifications = Office.context.mailbox.item.notificationMessages;
      if (notifications && notifications.removeAsync) notifications.removeAsync("casa-workspace", function () {});
      return casaWorkspaceRequest(token, "ready");
    }).then(function () {
      if (event && event.completed) event.completed();
      return true;
    });
  }).catch(function () {
    if (!token) return false;
    casaWorkspaceNotice("CASA: Die Nachricht ist nicht vollständig vorbereitet. Bitte im Workspace erneut öffnen oder Outlook Web wählen. Noch nicht senden.");
    return casaWorkspaceRequest(token, "failed").catch(function () {}).then(function () {
      if (event && event.completed) event.completed();
      return true;
    });
  });
}
function onNewMessageComposeHandler(event) {
  casaTryWorkspace(event).then(function (handled) { if (!handled) casaInsertSignature(event); });
}
function onMessageFromChangedHandler(event) {
  // Initial sender resolution must not race the workspace body/signature insertion.
  casaWorkspaceToken(2).then(function (token) {
    if (token) { if (event && event.completed) event.completed(); }
    else casaInsertSignature(event);
  }).catch(function () { casaInsertSignature(event); });
}
function insertSignatureCommand(event) {
  casaTryWorkspace(event).then(function (handled) { if (!handled) casaInsertSignature(event); });
}

Office.onReady(function () {});
if (Office.actions && Office.actions.associate) {
  Office.actions.associate("onNewMessageComposeHandler", onNewMessageComposeHandler);
  Office.actions.associate("onMessageFromChangedHandler", onMessageFromChangedHandler);
  Office.actions.associate("insertSignatureCommand", insertSignatureCommand);
}
