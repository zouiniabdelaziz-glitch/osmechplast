# Projektstatus OS.MECHPLAST Website

Stand: 2026-07-22

## Kurzbeschreibung

Die Website ist eine statische HTML-, CSS- und JavaScript-Website für OS.MECHPLAST SRLS, eine CNC-Lohnfertigungsfirma aus Ala, Trentino, Italien. Die Website richtet sich an B2B-Kunden aus Einkauf, Konstruktion, Produktentwicklung und Produktion. Sprache und Ton sind technisch, nüchtern und vertrauensbildend.

Die aktuelle Arbeitskopie liegt unter:

`work/oscnc-logo-integrated-20260704-005043`

Hinweis: Diese Arbeitskopie meldet selbst kein eigenes Git-Repository. Im übergeordneten Codex-Ordner ist ein `.git`-Ordner sichtbar, `git status` und `git diff --stat` liefern dort aktuell jedoch „not a git repository“. Dieser Git-Stand ist unklar und darf nicht als sauberer Repository-Status interpretiert werden.

## Aktuelle Hauptseiten

Indexierbare bzw. kanonisch in `sitemap.xml` geführte Seiten:

- `/` aus `index.html`
- `/leistungen/` aus `leistungen.html`
- `/qualitaet/` aus `qualitaet.html`
- `/technologie/` aus `technologie.html`
- `/unternehmen/` aus `unternehmen.html`
- `/werkstoffe/` aus `werkstoffe.html`
- `/kontakt/` aus `kontakt.html`
- `/impressum/` aus `impressum.html`

Weitere vorhandene HTML-Dateien mit noindex- oder Hilfsstatus:

- `ablauf.html`
- `branchen.html`
- `business-card-preview.html`
- `cnc-anfrage-vorbereiten.html`
- `drehen.html`
- `faq.html`
- `komplettbearbeitung.html`
- `maschinenpark.html`

## Aktuelle Module

Vorhandene HTML-Module in `modules/`:

- `header.html`
- `footer.html`
- `hero.html`
- `factory-flow.html`
- `band.html`
- `leistungen.html`
- `technologie.html`
- `werkstoffe.html`
- `kontakt.html`
- `standort.html`
- `impressum.html`
- `maschinenpark.html`
- `prozess.html`
- `branchen.html`
- `faq.html`
- `galerie.html`
- `uspbar.html`
- `wissen.html`
- Legacy-/ältere Modulnamen: `01_nav.html`, `02_hero.html`, `03_ticker.html`, `04_machines.html`, `05_industries.html`, `06_team.html`, `07_contact.html`, `08_footer.html`

## Vorhandene Funktionen

- Modularer Seitenaufbau über `data-include` und `js/app.js`.
- Sprachumschaltung über Dropdown im Header.
- Übersetzungsdaten in `js/translations.js`.
- Kontakt-/Leadformular in `modules/kontakt.html`.
- Cloudflare Function für Leads: `functions/api/leads.js`.
- Datei-Upload-Hinweis für Anfrageformular.
- Anfrage-Assistent auf der Startseite.
- Mobile Navigation mit Menübutton.
- Interne Clean-URL-Struktur über `_redirects`.
- Header- und X-Robots-Regeln über `_headers`.

## Analytics und Consent

Vorhanden:

- Google Analytics Measurement ID in `js/app.js`: `G-KFFN0VWBGK`
- Microsoft Clarity Project ID in `js/app.js`: `xlwutfjzhw`
- Consent-Logik in `js/analytics.js`
- Consent-Speicherkey: `osmp_analytics_clarity_consent`
- Analytics und Clarity werden erst nach Zustimmung geladen.
- Cookie-/Consent-Einstellungsbutton wird über `js/analytics.js` erzeugt.

Wichtig: Tracking- und Consent-Code nicht ohne ausdrücklichen Auftrag ändern.

## Bereits erkennbare abgeschlossene Arbeiten

- Website-Design mit dunklem Navy, Rot-Akzent und OSMP-Logo integriert.
- Header-Logo und Footer-Logo vorhanden.
- Startseite mit Hero, Anfrage-Assistent, Ablauf und CTA-Band.
- Materialseite mit Hero-Bild und B2B-Aufbau für Kunststoff, Aluminium und zerspanbare Stähle.
- Qualitätsseite mit Hero-Bild und Qualitäts-/Prüfstruktur.
- Technologieseite mit Grundlagen, Maschinenpark und einzelnen Maschinenbereichen.
- Unternehmensseite mit Gründerprofilen, Standort und Zielmarktbereich.
- Impressum-Seite mit vorhandenen Unternehmensangaben und Platzhalter-/TODO-Charakter für fehlende rechtliche Details.
- Robots.txt vorhanden.
- Sitemap mit acht kanonischen Clean URLs vorhanden.
- Clean-URL-Weiterleitungen in `_redirects` vorhanden.
- X-Robots-Regeln für technische und alte Seiten in `_headers` vorhanden.
- SEO-Dokumente `SEO_KEYWORD_MATRIX.md` und `SEO_SPRACHKONZEPT.md` vorhanden.
- Thematische Trennung der Hauptseiten wurde am 2026-07-22 nachgeschärft: Leistungen bleibt Leistungsübersicht, Werkstoffe bleibt Materialseite, Technologie bleibt Technik/Maschinenpark, Qualität bleibt Prüf-/Dokumentationsseite, Unternehmen bleibt Standort/Team, Kontakt bleibt Anfrage.
- Startseiten-CTA-Band wurde als eigenes Modul `modules/home-band.html` vom allgemeinen CTA-Band getrennt.

## Aktuell offene Punkte

- Datenschutzseite ist noch nicht final; Footer zeigt „Datenschutz folgt“.
- Rechtliche Angaben im Impressum können noch juristisch geprüft bzw. ergänzt werden.
- Live-Deployment und Live-Status sind aus dem lokalen Code nicht sicher bestätigbar.
- Git-Status ist unklar, da `git` im sichtbaren Arbeitsbereich kein gültiges Repository erkennt.
- Übersetzungsqualität wurde vom Nutzer als teilweise schlecht beschrieben; keine pauschale Übersetzungsüberarbeitung ohne konkreten Auftrag.
- In `js/translations.js` existieren in IT/EN/FR noch ältere Übersetzungs-Keys mit 24h-/Toleranz-/Materiallisten-Formulierungen; diese wurden bei der thematischen Seitenabgrenzung nicht pauschal überarbeitet.
- Mehrere alte HTML-Dateien existieren weiterhin mit `noindex` oder Redirect-Ziel.
- Allgemeines CTA-Band und Startseiten-CTA-Band sind getrennt; bei künftigen CTA-Änderungen trotzdem prüfen, auf welchen Seiten das jeweilige Modul eingebunden ist.

## Bereiche mit unklarem Stand

- Ob die Arbeitskopie identisch mit der tatsächlich veröffentlichten Cloudflare-Pages-Version ist.
- Ob alle Live-Weiterleitungen exakt wie lokal in `_redirects` laufen.
- Ob alle Analytics-/Clarity-Daten live korrekt eingehen.
- Ob die mehrsprachigen Inhalte fachlich final freigegeben sind.
- Ob alte Preview-/Hilfsdateien langfristig im Projekt bleiben sollen.

## Bereiche, die ohne ausdrücklichen Auftrag nicht geändert werden dürfen

- Header, Navigation und Sprachumschalter.
- Footer, Impressum und Datenschutz-Hinweise.
- Logo-Dateien und Brand-System.
- Kontaktformular, Lead-Function und Formular-IDs.
- Analytics-, Clarity- und Consent-Logik.
- Clean-URL-Regeln, `_redirects`, `_headers`, `robots.txt` und `sitemap.xml`.
- Bereits freigegebene Seitenbereiche: Startseite, Standort/Zielmärkte, Maschinenpark/Technologie, Materialien, Qualität, Unternehmen.
- Bestehende Texte mit rechtlicher Bedeutung.
