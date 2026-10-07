# CASA E-Mail-Signaturen

Zwei Wege, wie die CASA-Signatur (V5) in Outlook landet – beide aus denselben Daten gebaut:

1. **Outlook-Add-in „CASA Signatur“** (Standard seit 06.10.2026): setzt die Signatur beim Schreiben automatisch ein,
   passend zum Absenderpostfach. Zentral über Microsoft 365 verteilt – Mitarbeitende installieren nichts.
2. **Webseite zum Kopieren**: https://casa-signaturen.vercel.app – alle Signaturen mit „Signatur kopieren“ und
   „Bearbeiten“ (Name, Funktion, E-Mail vor dem Kopieren anpassen; wird nicht gespeichert). Fallback, falls das Add-in
   nicht greift, und Vorlage „Neue Person“.

## Stand (07.10.2026)

| | |
|---|---|
| Repo | https://github.com/CASA-School/casa-signaturen (**öffentlich** – siehe Entscheidungen) |
| Hosting | Vercel, Team `casa-international-language-school` (Hobby), Projekt `casa-signaturen`; Push auf `main` = Deploy |
| Manifest | https://casa-signaturen.vercel.app/addin/manifest.xml (Add-in-ID `796b9014-f8bf-496c-8986-8116ebb486ae`) |
| Verteilung | admin.microsoft.com → Einstellungen → Integrierte Apps → „CASA Signatur“ (Status OK) |
| Zugewiesen (18) | r.shafiee, n.sostres, a.trouillet, m.grossehundrup, m.thomeczek, c.groene, b.rick, t.langenickel, i.ahrens, i.eismann, m.meerhoff · Postfächer bufdis, info, abend, accommodation, intensiv, buchhaltung, lernen |
| Bewusst nicht | **online@** – weder zugewiesen noch in `signatures.json` (`ADDIN_EXCLUDE` in `build_site.py`) |
| Getestet | Outlook im Web (r.shafiee): automatisch + Knopf, keine doppelte Signatur · Outlook-App Mac (neues Outlook 16.113): r.shafiee, Meike u. a. funktionieren |

## Aufbau

```
signatur.py        Signatur-Bauer (MAILBOXES + build()) – Kopie von ../output/casa-signatur/build.py, muss identisch bleiben
build_site.py      baut public/index.html (Webseite) und public/addin/signatures.json (Add-in-Daten)
template.html      Gerüst der Webseite (Anleitung, Kopieren, Bearbeiten)
vercel.json        statisch aus public/, noindex, CORS + no-cache für /addin/
public/
  index.html           generiert – nicht von Hand ändern
  casa-logo.png        von allen Signaturen per URL geladen – NIE umbenennen/löschen
  instagram-icon.png   dito
  addin/
    manifest.xml       Add-in-Manifest (XML, Mailbox 1.10+, LaunchEvent)
    commands.html      Laufzeit für Outlook im Web / neues Outlook / Mac (lädt office.js + launchevent.js)
    launchevent.js     Logik (klassisches Outlook für Windows lädt nur diese Datei)
    signatures.json    generiert: Absenderadresse (klein) -> fertiges Signatur-HTML
    icon-*.png         Segel aus dem CASA-Logo (16/32/64/80/128)
```

### So arbeitet das Add-in
- **Auslöser:** `OnNewMessageCompose` (neue Mail, Antwort, Weiterleitung) und `OnMessageFromChanged` (Feld „Von“
  gewechselt, z. B. auf info@). Zusätzlich Knopf **Apps → „CASA Signatur“** im Verfassen-Fenster.
- Liest die Absenderadresse (`item.from`, sonst Postfach des Nutzers), holt `signatures.json` und setzt die Signatur mit
  `body.setSignatureAsync` – das **ersetzt** einen vorhandenen Signaturblock, verdoppelt nicht.
- Adresse nicht in `signatures.json` (z. B. online@, bewerbungen@): Add-in tut nichts, Outlook-Signatur bleibt.
- Rechte: ReadWriteItem (nur die gerade verfasste Mail). Daten verlassen Outlook nicht; geladen wird nur die JSON-Datei.

## Ändern (Titel, Personen, Postfächer, Gestaltung)

1. In **`../output/casa-signatur/build.py`** ändern (Hauptquelle; die FileMaker-Session importiert diese Datei ebenfalls).
2. Nach `signatur.py` kopieren: `cp ../output/casa-signatur/build.py signatur.py`
3. `python3 build_site.py` – bricht ab, wenn `signatur.py` und `build.py` nicht identisch sind.
4. Commit + `git push` → Vercel deployt in ~30 s. **Fertig:** Add-in-Nutzer haben die Änderung ab der nächsten Mail,
   nichts neu verteilen.

Nur bei Änderungen an `manifest.xml` (neue Ereignisse, Rechte, Icons, Name): `<Version>` erhöhen und im Admin Center
„CASA Signatur“ → **Add-in aktualisieren**. Danach bis zu 24 h Verteilzeit.

### Neue Person / neues Postfach
1. Eintrag in `MAILBOXES` (`build.py`), Schritte 2–4 oben. Personen auch in `PEOPLE` in `build_site.py` aufnehmen.
2. Admin Center → Integrierte Apps → „CASA Signatur“ → Benutzer → **Benutzer bearbeiten** → hinzufügen → Aktualisieren.
3. Ausgeschiedene Person: dort entfernen und aus `MAILBOXES` löschen.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| Nach Zuweisung nichts in Outlook | Verteilung dauert Stunden, bis 24 h, je Konto unterschiedlich. Outlook ganz beenden (Cmd+Q), neu öffnen. |
| Prüfen, ob es beim Konto angekommen ist | Outlook im Web als die Person → Add-Ins → „Vom Administrator verwaltet“ → „CASA Signatur – Hinzugefügt“. Dort ja, Mac-App nein → Mac-App neu starten bzw. Konto entfernen/neu hinzufügen. |
| In Outlook im Web erst nach Neuladen | Normal beim ersten Mal (Add-ins werden beim Seitenstart geladen). |
| Signatur doppelt | Alte Outlook-Signatur auf „Keine“ (Einstellungen → Signaturen, neue Nachrichten + Antworten). |
| Legacy Outlook für Mac | Keine automatische Einfügung, nur Knopf. Auf „Neues Outlook“ umstellen. |
| Logo fehlt in Mails | `public/casa-logo.png` erreichbar? Nie umbenennen/löschen. |
| Eingefügt nur als Text (Webseite) | Direkt in Outlooks Signatur-Editor einfügen, Chrome/Edge verwenden. |

## Entscheidungen
- **Repo öffentlich (06.10.2026, Rahman):** Vercel Hobby deployt keine privaten Org-Repos; Pro kostet. Inhalt = was ohnehin
  in jeder Signatur steht (Namen, Funktionen, Dienstadressen, Logo), keine Geheimnisse.
- **online@ ausgenommen (06.10.2026, Rahman).**
- **Buchhaltung (07.10.2026, Rahman):** Ina/Manuela „Buchhaltung / Finance & Accounting“; buchhaltung@ fett „Buchhaltung“,
  kursiv „Finance & Accounting“, Gruß „Ina Eismann und Manuela Meerhoff“. „Finance & Accounting“ statt „Finances and
  Accounting“ (üblicher Fachbegriff).
- **Add-in im selben Repo wie die Webseite:** eine Quelle, ein Deploy, gleicher Ursprung für JSON und Bilder.
- Konten: GitHub `rshafiee-casa`; Vercel CASA = Chrome-Profil r.shafiee („Browser 2“); Admin Center mit it@casa-bremen.de.
  Der lokale `vercel`-CLI-Login ist Rahmans privates Konto – nicht für CASA verwenden.

## Offen
- Rahmans früher seitlich geladene Testkopie (Outlook im Web → Add-Ins → Benutzerdefinierte Add-Ins) entfernen, sobald
  die zentrale Version bei ihm da ist (gleiche ID, schadet nicht, ist aber doppelt).
- Weitere Funktionspostfächer (bewerbungen@, accounting@, Rechnungen@, it@) – noch keine Signaturen.
- Optional kurze Adresse `signatur.casa-bremen.de` (DNS-Eintrag beim Domain-Verwalter nötig).
- Rundmail ans Team liegt als Entwurf in r.shafiee (Betreff „Neue E-Mail-Signatur: Outlook setzt sie ab jetzt
  automatisch ein“) – Rahman prüft und versendet selbst.
