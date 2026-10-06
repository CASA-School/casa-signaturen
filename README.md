# CASA E-Mail-Signaturen

Seite zum Kopieren der CASA-Outlook-Signaturen (V5), mit „Bearbeiten“ für Name, Funktion und E-Mail.
Live: https://casa-signaturen.vercel.app

## Ändern
1. `signatur.py` anpassen (Personen/Postfächer in `MAILBOXES`, Gestaltung in `build`) oder `template.html` (Seite).
2. `python3 build_site.py` → schreibt `public/index.html`.
3. Commit + Push auf `main` → Vercel deployt automatisch.

Bilder (`public/casa-logo.png`, `public/instagram-icon.png`) werden von den Signaturen direkt von dieser Adresse geladen –
Dateien nicht umbenennen oder löschen, sonst fehlt das Logo in bereits eingerichteten Signaturen.
