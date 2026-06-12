# OS. CNC Mechplast — Website (Modul-System v5)

## Architektur

Jede Seite ist eine dünne Schale, die Module lädt:

```html
<header class="header" data-include="header"></header>
<section class="sec" data-include="leistungen"></section>
<footer class="footer" data-include="footer"></footer>
```

`js/app.js` lädt automatisch `modules/<name>.html` in jeden Slot.
**Ein Modul ändern = überall geändert.**

## Seiten (jeder Menüpunkt = eigene Seite)

| Seite | Module |
|---|---|
| index.html | header, hero, uspbar, leistungen, prozess, band, galerie, footer |
| drehen.html | header, footer (+ eigener Inhalt) |
| komplettbearbeitung.html | header, footer (+ eigener Inhalt) |
| werkstoffe.html | header, footer (+ eigener Inhalt) |
| maschinenpark.html | header, maschinenpark, galerie, band, footer |
| ablauf.html | header, prozess, faq, band, footer |
| branchen.html | header, branchen, werkstoffe, band, footer |
| faq.html | header, faq, band, footer |
| kontakt.html | header, kontakt, footer |

## Module (modules/)

header · footer · hero · uspbar · leistungen · maschinenpark · werkstoffe ·
prozess · branchen · band (Overflow-CTA) · faq · galerie · kontakt (Formular)

## Häufige Änderungen

- **Menüpunkt ändern/hinzufügen** → nur `modules/header.html` (+ ggf. neue Seite als Kopie einer bestehenden Shell)
- **Text ändern** → `js/translations.js` (DE/IT/EN/FR — immer alle 4!). Apostroph in IT/FR als `’` schreiben, nicht `\'`
- **Maschine hinzufügen** → `modules/maschinenpark.html` Karte duplizieren + Keys `m4_*` in translations.js
- **FAQ-Frage** → `modules/faq.html` + Keys `fq6_q`/`fq6_a`
- **Foto einbauen** → `modules/galerie.html`, Platzhalter-SVG durch `<img>` ersetzen (siehe FOTO_VIDEO_PLAN.md)
- **Farben/Design** → `css/main.css` (Variablen oben)

## NICHT ändern

- Formular-IDs in `modules/kontakt.html` (f_company, f_name, f_email, f_phone, f_service, f_msg, uploadZone, sketchFile, aiResult…) — Cloudflare `/api/leads` und KI-Analyse hängen daran.

## Lokal testen

```bash
npx http-server . -p 8099
# http://localhost:8099
```
(Module laden per fetch — Datei direkt im Browser öffnen funktioniert NICHT, es braucht einen Server.)

## Deployen

```bash
git add . && git commit -m "Update" && git push
# Cloudflare Pages deployt automatisch
```
