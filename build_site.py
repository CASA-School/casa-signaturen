# Baut public/index.html: alle CASA-Signaturen (V5) mit "Signatur kopieren" und "Bearbeiten".
# Quelle der Signatur: signatur.py (Kopie von output/casa-signatur/build.py). Danach: git push -> Vercel deployt.
import html, json, os
from signatur import build, MAILBOXES

SITE = os.environ.get("SITE_URL", "https://casa-signaturen.vercel.app")
D = os.path.dirname(os.path.abspath(__file__))

# signatur.py ist eine Kopie der Hauptquelle; liegt die Hauptquelle daneben, müssen beide gleich sein
MAIN = os.path.join(D, "..", "output", "casa-signatur", "build.py")
if os.path.exists(MAIN) and open(MAIN).read() != open(os.path.join(D, "signatur.py")).read():
    raise SystemExit("signatur.py weicht von output/casa-signatur/build.py ab – erst kopieren: "
                     "cp ../output/casa-signatur/build.py signatur.py")

PEOPLE = ["bettina", "claudia", "natalia", "alissa", "tanja", "mareike", "meike",
          "manuela", "ina", "ilka", "rahman"]
SHARED = [k for k in MAILBOXES if k not in PEOPLE]
NEW = dict(signer="Vorname Nachname", role_de="Vorname Nachname",
           role_en="Funktion / Function", mail="v.nachname@casa-bremen.de")

def clean(s):
    return html.unescape(s).replace("­", "")

def absolute(out):
    for img in ("casa-logo.png", "instagram-icon.png"):
        out = out.replace(f'src="{img}"', f'src="{SITE}/{img}"')
    assert "data:image" not in out and 'src="casa' not in out
    return out

def sig(v):
    # editierbare Stellen markieren; Bilder als feste URLs, damit Outlook sie sicher übernimmt
    out = build(signer=f'<span data-f="signer">{v["signer"]}</span>',
                role_de=f'<span data-f="role_de">{v["role_de"]}</span>',
                role_en=f'<span data-f="role_en">{v["role_en"]}</span>',
                mail=v["mail"], embed=False)
    return absolute(out)

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

# Für das Outlook-Add-in: Absenderadresse -> fertige Signatur (ohne Bearbeiten-Markierungen).
# Postfächer in ADDIN_EXCLUDE lässt das Add-in in Ruhe (Entscheidung Rahman 06.10.2026: online@ nicht).
ADDIN_EXCLUDE = {"online@casa-bremen.de"}
sigs = {v["mail"].lower(): absolute(build(**{k: x for k, x in v.items() if k != "todo"}, embed=False))
        for v in MAILBOXES.values() if v["mail"].lower() not in ADDIN_EXCLUDE}
os.makedirs(os.path.join(D, "public", "addin"), exist_ok=True)
json.dump(sigs, open(os.path.join(D, "public", "addin", "signatures.json"), "w"), ensure_ascii=False)
print("public/addin/signatures.json", len(sigs), "Postfächer")

# Vorschau für Layout-Vorschläge (nicht verlinkt, noindex): public/vorschau.html
def preview_card(title, note, v, mode):
    return (f'<section class="pv"><h3>{title}</h3><p>{note}</p>'
            f'<div class="sig">{absolute(build(**v, embed=False, greet_above=mode))}</div></section>')
pv_rows = ""
for key in ("bettina", "info"):
    v = {k: x for k, x in MAILBOXES[key].items() if k != "todo"}
    pv_rows += (f'<h2>{label(key)[0]} – {v["mail"]}</h2><div class="grid">'
                + preview_card("Heute", "Gruß innerhalb der Linie", v, None)
                + preview_card("Vorschlag A", "Gruß über der Linie, bündig mit der Linie", v, "flush")
                + preview_card("Vorschlag B", "Gruß über der Linie, bündig mit dem Logo", v, "indent")
                + '</div>')
open(os.path.join(D, "public", "vorschau.html"), "w").write(f'''<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Signatur-Vorschau</title>
<style>
:root{{--bg:#f6f3ee;--line:#e2dcd2;--muted:#6e675e}}
body{{margin:0;background:var(--bg);color:#1d1d1b;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}}
main{{max-width:1500px;margin:0 auto;padding:28px 16px 60px}}
.stripe{{height:4px;background:linear-gradient(90deg,#e30613 0 33.3%,#009fe3 33.3% 66.6%,#ffd500 66.6%)}}
h1{{margin:0 0 4px;font-size:24px}} h2{{font-size:17px;margin:30px 0 10px}} .lead{{color:var(--muted);margin:0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:14px}}
.pv{{background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.pv h3{{margin:0;padding:10px 16px 0;font-size:15px}} .pv p{{margin:0;padding:0 16px 10px;color:var(--muted);font-size:13px;border-bottom:1px solid var(--line)}}
.sig{{padding:22px 18px;overflow-x:auto}}
</style></head><body><div class="stripe"></div><main>
<h1>Signatur – Vorschlag Grußzeile</h1>
<p class="lead">Nur Vorschau. Die echten Signaturen und das Add-in sind unverändert.</p>
{pv_rows}</main></body></html>
''')
print("public/vorschau.html")
