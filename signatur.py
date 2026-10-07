import base64, os, sys
D = os.path.dirname(os.path.abspath(__file__))

AR    = "font-family:Arial,Helvetica,sans-serif"
NW    = AR + ";white-space:nowrap"
LINE  = "#C6C1B9"   # beige-grey, both verticals, 1px
RULE  = "#DDD7CB"   # footer hairline
BLUE  = "#009FE3"   # logo blue, links
INK   = "#1D1D1B"
GREY  = "#6E675E"

def img_src(name, embed):
    if not embed: return name
    return "data:image/png;base64,"+base64.b64encode(open(os.path.join(D,name),"rb").read()).decode()
def logo_src(embed): return img_src("casa-logo.png", embed)

INSTA = "https://www.instagram.com/casa_sprachschule"
def insta_block(embed):
    # Instagram-Icon farbig (instagram-icon.png, 72 px -> 18 px) und Handle in EINER Zeile (Mini-Tabelle, Outlook-sicher),
    # beides verlinkt. Graue Variante: instagram-icon-grau.png.
    return ('<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>'
            f'<td style="padding:0 6px 0 0;vertical-align:middle;border-bottom:0"><a href="{INSTA}" style="text-decoration:none">'
            f'<img src="{img_src("instagram-icon.png", embed)}" width="18" height="18" alt="Instagram" '
            'style="display:block;border:0"></a></td>'
            f'<td style="vertical-align:middle;border-bottom:0"><a href="{INSTA}" style="{AR};font-size:11px;line-height:18px;'
            f'color:{GREY};text-decoration:none;white-space:nowrap">@casa_sprachschule</a></td>'
            '</tr></table>')

def sep(px):
    # bullet at the SAME size as its text: centred by the glyph's own design, so it
    # needs no vertical-align (which Outlook strips). Regular spaces either side keep
    # a break opportunity for narrow screens.
    return f' <span style="{AR};font-size:{px}px;padding:0 3px">&bull;</span> '

def nw(t, extra=""):
    return f'<span style="{NW}{extra}">{t}</span>'

def link(href, text, nowrap_halves=None):
    st = f"{AR};color:{BLUE};text-decoration:none"
    if nowrap_halves:
        a, b = nowrap_halves
        return (f'<a href="{href}" style="{st}">'
                f'<span style="{NW}">{a}</span><wbr><span style="{NW}">{b}</span></a>')
    return f'<a href="{href}" style="{st};white-space:nowrap">{text}</a>'

def build(signer, role_de, role_en, mail, embed=True, greeting=True, greet_above="flush"):
    # greeting=False: ohne Grußzeile (für FileMaker-Mails, deren Text schon mit Gruß + Name endet)
    # greet_above (Vorschlag 07.10.2026): Grußzeile über der linken Linie, Linie beginnt auf Höhe von Logo und
    # Trennlinie. "flush" = Gruß bündig mit der Linie (Standard seit 07.10.2026, Entscheidung Rahman: Vorschlag A),
    # "indent" = Gruß bündig mit dem Logo, None = alte Fassung (Gruß innerhalb der Linie).
    S13, S11 = sep(13), sep(11)
    local, dom = mail.split("@", 1)
    contact = (
      f'<div style="{AR};font-size:13px;line-height:1.4;color:{INK}">'
        'CASA &ndash; Internationale Sprachschule gGmbH<br>'
        f'{nw("Am Dobben 14&ndash;16")}{S13}{nw("28203 Bremen")}{S13}'
        f'<span lang="en" style="{NW}">Germany</span><br>'
        f'{nw("Tel. +49 421 460 414 30")}<br>'
        f'{link("mailto:"+mail, mail, (local+"@", dom))}{S13}'
        f'{link("https://www.casa-bremen.de","www.casa-bremen.de")}'
      '</div>')
    footer = (
      f'<div style="{AR};border-top:1px solid {RULE};margin-top:16px;padding-top:11px;'
      f'color:{GREY};font-size:11px;line-height:1.35">'
        f'{nw("Sitz Bremen")}{S11}{nw("Amtsgericht Bremen HRB 32761 HB")}{S11}'
        f'{nw("Gesch&auml;ftsf&uuml;hrerin: Bettina Rick")}{S11}'
        f'{nw("Gemeinn&uuml;tzig nach &sect; 5 Abs. 1 Nr. 9 KStG")}<br>'
        f'<span lang="en" style="{AR};font-style:italic;color:{GREY}">'
        f'{nw("Registered office: Bremen",";font-style:italic")}{S11}'
        f'{nw("Registered at Bremen District Court, HRB 32761 HB",";font-style:italic")}{S11}'
        f'{nw("Managing Director: Bettina Rick",";font-style:italic")}{S11}'
        f'{nw("Non-profit under &sect; 5 (1) no. 9 KStG",";font-style:italic")}</span>'
      '</div>')
    greet = (f'<div style="{AR};font-size:11pt;color:{INK};margin-bottom:16px">'
        f'{nw("Freundliche Gr&uuml;&szlig;e")} <span style="{AR};font-size:11pt;padding:0 3px">&bull;</span> '
        f'<span lang="en" style="{NW}">Kind regards</span><br>{nw(signer)}</div>') if greeting else ''
    above = greet if greet_above else ''
    inner = (
      ('' if greet_above else greet) +
      '<table role="presentation" cellpadding="0" cellspacing="0" '
      'style="border-collapse:collapse"><tr>'
        '<td style="padding:0 18px 0 0;vertical-align:top;border-bottom:0">'
          f'<img src="{logo_src(embed)}" width="132" height="37" alt="CASA" '
          'style="display:block;border:0"></td>'
        f'<td rowspan="2" style="padding:0 0 0 18px;border-left:1px solid {LINE};vertical-align:top;'
        f'border-bottom:0">'
          f'<div style="{AR};font-size:16px;color:{INK}"><b>{role_de}</b></div>'
          + (f'<div lang="en" style="{AR};font-size:14px;color:#4A4642;'
             f'font-style:italic;margin-bottom:10px">{role_en}</div>'
             if role_en else '<div style="height:10px;line-height:10px;font-size:0">&nbsp;</div>')
          + f'{contact}</td>'
      '</tr><tr>'
        # Instagram unten in der linken Spalte, Handle auf Höhe der letzten Kontaktzeile (rowspan rechts)
        '<td style="padding:0 18px 1px 0;vertical-align:bottom;border-bottom:0">' + insta_block(embed) + '</td>'
      '</tr></table>' + footer)
    if above and greet_above == "indent":
        above = f'<div style="padding-left:17px">{above}</div>'
    return (
      f'<div lang="de" style="{AR};font-size:14px;line-height:1.5;color:{INK}">' + above +
      '<table role="presentation" cellpadding="0" cellspacing="0" '
      'style="border-collapse:collapse"><tr>'
      f'<td width="1" bgcolor="{LINE}" style="width:1px;padding:0;font-size:0;line-height:0;'
      f'background-color:{LINE};border-left:1px solid {LINE};border-bottom:0">&nbsp;</td>'
      f'<td style="padding:0 0 0 16px;vertical-align:top;border-bottom:0">{inner}</td>'
      '</tr></table></div>')

MAILBOXES = {
 # --- Funktionspostfaecher ---
 "info":          dict(signer="Ihr CASA-Team", role_de="Kursverwaltung",
                       role_en="Information &amp; Enrolment", mail="info@casa-bremen.de"),
 "abend":         dict(signer="Ihr CASA-Kursteam", role_de="Abendkurse",
                       role_en="Evening Courses", mail="abend@casa-bremen.de"),
 "accommodation": dict(signer="Ihr CASA-Team",
                       role_de="Unterkunfts&shy;vermittlung",
                       role_en="Student Accommodation", mail="accommodation@casa-bremen.de"),
 "intensiv":      dict(signer="Ihr CASA-Kursteam", role_de="Intensivkurse",
                       role_en="Intensive Courses", mail="intensiv@casa-bremen.de"),
 "online":        dict(signer="Ihr CASA-Team", role_de="Online-Kurse",
                       role_en="Online Courses", mail="online@casa-bremen.de"),
 "buchhaltung":   dict(signer="Ina Eismann und Manuela Meerhoff", role_de="Buchhaltung",
                       role_en="Finance &amp; Accounting", mail="buchhaltung@casa-bremen.de"),
 "bufdis":        dict(signer="Ihr CASA-Team", role_de="Bundes&shy;freiwilligendienst",
                       role_en="Volunteer Programme", mail="bufdis@casa-bremen.de"),
 # "CASA Learn" from the mailbox list is the shared mailbox CASA Lernen
 "lernen":        dict(signer="Ihr CASA-Team", role_de="CASA Lernen",
                       role_en="Learning Platform", mail="lernen@casa-bremen.de"),

 # --- Personen. Namen, Adressen, Funktionen: output/casa-signatur/mitarbeiterliste.md (FileMaker + M365, 30.09.2026).
 #     Fett = Name, darunter Funktion DE / EN. "todo" markiert, was vor dem Rollout bestätigt werden muss. ---
 "bettina":       dict(signer="Bettina Rick", role_de="Bettina Rick",
                       role_en="Geschäftsführerin / Managing Director", mail="b.rick@casa-bremen.de"),
 "claudia":       dict(signer="Claudia Gröne", role_de="Claudia Gröne",
                       role_en="Studienleitung / Director of Studies", mail="c.groene@casa-bremen.de"),
 "natalia":       dict(signer="Natàlia Sostres", role_de="Natàlia Sostres",
                       role_en="Büroleitung / Head of Office", mail="n.sostres@casa-bremen.de"),
 "alissa":        dict(signer="Alissa Trouillet", role_de="Alissa Trouillet",
                       role_en="Kursverwaltung / Office Manager", mail="a.trouillet@casa-bremen.de"),
 "tanja":         dict(signer="Tanja Langenickel", role_de="Tanja Langenickel",
                       role_en="Kursverwaltung / Office Manager", mail="t.langenickel@casa-bremen.de"),
 "mareike":       dict(signer="Mareike Thomeczek", role_de="Mareike Thomeczek",
                       role_en="Kursverwaltung / Office Manager", mail="m.thomeczek@casa-bremen.de"),
 "meike":         dict(signer="Meike Große Hundrup", role_de="Meike Große Hundrup",
                       role_en="Kursverwaltung / Office Manager", mail="m.grossehundrup@casa-bremen.de"),
 "manuela":       dict(signer="Manuela Meerhoff", role_de="Manuela Meerhoff",
                       role_en="Buchhaltung / Finance &amp; Accounting", mail="m.meerhoff@casa-bremen.de"),
 "ina":           dict(signer="Ina Eismann", role_de="Ina Eismann",
                       role_en="Buchhaltung / Finance &amp; Accounting", mail="i.eismann@casa-bremen.de"),
 "ilka":          dict(signer="Ilka Ahrens", role_de="Ilka Ahrens",
                       role_en="Ressourcenmanagement / Resource Manager", mail="i.ahrens@casa-bremen.de"),
 "rahman":        dict(signer="Rahman Shafiee", role_de="Rahman Shafiee",
                       role_en="IT &amp; Digitalisierung", mail="r.shafiee@casa-bremen.de"),
}

if __name__ == "__main__":
    incomplete = []
    for key, v in MAILBOXES.items():
        todo = v.pop("todo", None)
        if todo: incomplete.append((key, todo))
        emb = build(embed=True, **v)
        rel = build(embed=False, **v)
        # the visible address is split across the <wbr>, so check the target and both
        # halves separately: this is exactly where text and href drifted apart before
        loc, dm = v["mail"].split("@", 1)
        assert f'mailto:{v["mail"]}"' in emb, key
        assert f'>{loc}@</span>' in emb, key
        assert f'>{dm}</span>' in emb, key
        assert "vertical-align:-" not in emb, "stale dot nudge"
        assert "#C9BFA8" not in emb, "stale beige"
        open(os.path.join(D, f"_v5-{key}.html"), "w").write("<html><body>"+emb+"</body></html>")
        open(os.path.join(D, f"Signatur-V5-{key}.html"), "w").write(
          '<!doctype html>\n<html lang="de"><head><meta charset="utf-8">'
          f'<title>CASA Signatur V5 {key}</title>'
          '<style>html,body{margin:0;padding:24px;background:#fff}</style></head><body>\n'
          '<!-- Alles markieren (Cmd+A), kopieren (Cmd+C), in die Signatur einsetzen. -->\n'
          + rel + '\n</body></html>\n')
        print(("built  " if not todo else "TODO   ") + key)
    if incomplete:
        print("\nUnvollstaendig - vor dem Rollout ergaenzen:")
        for k, t in incomplete: print("  " + k + ": " + t)
