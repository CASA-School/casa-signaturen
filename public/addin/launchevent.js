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

function onNewMessageComposeHandler(event) { casaInsertSignature(event); }
function onMessageFromChangedHandler(event) { casaInsertSignature(event); }
function insertSignatureCommand(event) { casaInsertSignature(event); }

Office.onReady(function () {});
if (Office.actions && Office.actions.associate) {
  Office.actions.associate("onNewMessageComposeHandler", onNewMessageComposeHandler);
  Office.actions.associate("onMessageFromChangedHandler", onMessageFromChangedHandler);
  Office.actions.associate("insertSignatureCommand", insertSignatureCommand);
}
