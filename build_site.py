# Baut public/index.html: alle CASA-Signaturen (V5) mit "Signatur kopieren" und "Bearbeiten".
# Quelle der Signatur: signatur.py (Kopie von output/casa-signatur/build.py). Danach: git push -> Vercel deployt.
import html, os
from signatur import build, MAILBOXES

SITE = os.environ.get("SITE_URL", "https://casa-signaturen.vercel.app")
D = os.path.dirname(os.path.abspath(__file__))

PEOPLE = ["bettina", "claudia", "natalia", "alissa", "tanja", "mareike", "meike",
          "manuela", "ina", "ilka", "rahman"]
SHARED = [k for k in MAILBOXES if k not in PEOPLE]
NEW = dict(signer="Vorname Nachname", role_de="Vorname Nachname",
           role_en="Funktion / Function", mail="v.nachname@casa-bremen.de")

def clean(s):
    return html.unescape(s).replace("­", "")

def sig(v):
    # editierbare Stellen markieren; Bilder als feste URLs, damit Outlook sie sicher übernimmt
    out = build(signer=f'<span data-f="signer">{v["signer"]}</span>',
                role_de=f'<span data-f="role_de">{v["role_de"]}</span>',
                role_en=f'<span data-f="role_en">{v["role_en"]}</span>',
                mail=v["mail"], embed=False)
    for img in ("casa-logo.png", "instagram-icon.png"):
        out = out.replace(f'src="{img}"', f'src="{SITE}/{img}"')
    assert "data:image" not in out and 'src="casa' not in out
    return out

def card(key, v, title, sub, extra=""):
    return (f'<section class="card{extra}" id="{key}"><header><div><h3>{title}</h3><p>{sub}</p></div>'
            '<div class="actions"><button type="button" class="ghost" data-edit>Bearbeiten</button>'
            '<button type="button" data-copy>Signatur kopieren</button></div></header>'
            '<form class="edit" hidden>'
            '<label>Name in der Grußzeile<input name="signer"></label>'
            '<label>Fett gedruckte Zeile<input name="role_de"></label>'
            '<label>Funktion (kursiv)<input name="role_en"></label>'
            '<label>E-Mail-Adresse<input name="mail" type="email"></label>'
            '<p class="hint">Änderungen erscheinen sofort in der Vorschau. Sie werden nicht gespeichert – '
            'nach dem Bearbeiten einfach kopieren. <button type="button" class="link" data-reset>Zurücksetzen</button></p>'
            f'</form><div class="sig">{sig(v)}</div></section>')

def label(k):
    v = MAILBOXES[k]
    return (v["signer"] if v["role_de"] == v["signer"] else clean(v["role_de"])), v["mail"]

def toc(keys):
    return "".join(f'<a href="#{k}">{label(k)[0]}</a>' for k in keys)

cards_people = "".join(card(k, MAILBOXES[k], *label(k)) for k in PEOPLE)
cards_shared = "".join(card(k, MAILBOXES[k], *label(k)) for k in SHARED)
card_new = card("neu", NEW, "Neue Person", "Für neue Kolleginnen und Kollegen: Bearbeiten, Daten eintragen, kopieren", " new")

page = open(os.path.join(D, "template.html")).read()
page = (page.replace("{{TOC_PEOPLE}}", toc(PEOPLE)).replace("{{PEOPLE}}", cards_people)
            .replace("{{TOC_SHARED}}", toc(SHARED)).replace("{{SHARED}}", cards_shared)
            .replace("{{NEW}}", card_new).replace("{{SITE}}", SITE))
open(os.path.join(D, "public", "index.html"), "w").write(page)
print("public/index.html", len(PEOPLE) + len(SHARED), "Signaturen +1 Vorlage,", SITE)
