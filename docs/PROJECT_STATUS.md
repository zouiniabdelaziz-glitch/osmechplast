# Projektstatus OS.MECHPLAST Website

Stand: 2026-08-31

## Kurzbeschreibung

Die Website ist eine statische HTML-, CSS- und JavaScript-Website für OS.MECHPLAST SRLS, eine CNC-Lohnfertigungsfirma aus Ala, Trentino, Italien. Die Website richtet sich an B2B-Kunden aus Einkauf, Konstruktion, Produktentwicklung und Produktion. Sprache und Ton sind technisch, nüchtern und vertrauensbildend.

Die aktuelle Arbeitskopie liegt unter:

`C:\Users\Director\Documents\Italien Firma\oscnc - Kopie`

Hinweis: Diese Arbeitskopie ist ein Git-Arbeitsbaum mit zahlreichen bereits vor dem Wissensbereich vorhandenen Änderungen und unversionierten Audit-/Archivdateien. Diese fremden Änderungen wurden bei der Umsetzung nicht bereinigt oder überschrieben.

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
- `/wissen/` wird beim Eleventy-Build aus `content/wissen-index.njk` erzeugt

Hinweis 2026-07-24: Für diese acht öffentlichen Clean URLs existieren zusätzlich echte Ordnerseiten (`leistungen/index.html`, `qualitaet/index.html`, `technologie/index.html`, `unternehmen/index.html`, `werkstoffe/index.html`, `kontakt/index.html`, `impressum/index.html`). Dadurch sind die Unterseiten auch ohne interne `.html`-Rewrite-Regeln direkt erreichbar.

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
- Eleventy-Build mit Ausgabe nach `_site`; bestehende öffentliche Seiten und Assets werden über eine explizite Freigabeliste unverändert übernommen.
- Pages-CMS-Konfiguration in `.pages.yml`; Artikelquelle ist `content/wissen/`, Bilder liegen ausschließlich unter `assets/images/wissen/`.
- Veröffentlichte Wissen-Artikel erhalten Clean URLs, statisches HTML, Article-/WebPage-/Breadcrumb-Schema und responsive WebP-/JPEG-Bilder. Entwürfe erzeugen keine öffentliche Seite und keinen Sitemap-Eintrag.

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

- SEO-Grundüberarbeitung am 2026-08-25: kanonische Seiten enthalten statische Modul-Fallbacks für crawlbares Initial-HTML, eindeutige Titles/Open-Graph-Daten und valide JSON-LD-Grundstruktur. Details stehen in `SEO_AUDIT.md` und `SEO_FINAL_REPORT.md`.
- Sichtbare NAP-Daten (OS.MECHPLAST SRLS, Adresse, Telefon, E-Mail) stehen im Footer; die Kontaktseite enthält zusätzlich einen nutzerinitiierten Google-Maps-Routenlink.
- Consent-gebundene Analytics-Ereignisse für CTA-Klicks, Telefon, E-Mail und erfolgreich gespeicherte Leads sind implementiert. Das frühere Uploadstart-Ereignis wurde mit dem vorläufig entfernten Uploadpfad gelöscht. Es werden keine Formularinhalte als Eventparameter übertragen.

- Website-Design mit dunklem Navy, Rot-Akzent und OSMP-Logo integriert.
- Header-Logo und Footer-Logo vorhanden.
- Startseite mit Hero, Anfrage-Assistent, Ablauf und CTA-Band.
- Materialseite mit Hero-Bild und B2B-Aufbau für Kunststoff, Aluminium und zerspanbare Stähle.
- Qualitätsseite mit Hero-Bild und Qualitäts-/Prüfstruktur.
- Technologieseite mit Grundlagen, Maschinenpark und einzelnen Maschinenbereichen.
- Unternehmensseite mit Gründerprofilen, Standort und Zielmarktbereich.
- Impressum-Seite mit vorhandenen Unternehmensangaben und Platzhalter-/TODO-Charakter für fehlende rechtliche Details.
- Robots.txt vorhanden.
- Sitemap enthält die bestehenden kanonischen URLs sowie `/wissen/`; veröffentlichte Artikel werden beim Build automatisch ergänzt. `/impressum/` ist im aktuellen lokalen `sitemap.xml` nicht enthalten. Die Indexierungsentscheidung für Impressum und Datenschutz bleibt dem Inhaber vorbehalten.
- Clean-URL-Weiterleitungen in `_redirects` vorhanden; alte `.html`-URLs leiten per 301 auf die Clean URLs weiter.
- Echte Clean-URL-Ordnerseiten wurden am 2026-07-24 ergänzt; die früheren internen 200-Rewrites von `/seite/` auf `/seite.html` wurden entfernt.
- X-Robots-Regeln für technische und alte Seiten in `_headers` vorhanden.
- SEO-Dokumente `SEO_KEYWORD_MATRIX.md` und `SEO_SPRACHKONZEPT.md` vorhanden.
- Thematische Trennung der Hauptseiten wurde am 2026-07-22 nachgeschärft: Leistungen bleibt Leistungsübersicht, Werkstoffe bleibt Materialseite, Technologie bleibt Technik/Maschinenpark, Qualität bleibt Prüf-/Dokumentationsseite, Unternehmen bleibt Standort/Team, Kontakt bleibt Anfrage.
- Startseiten-CTA-Band wurde als eigenes Modul `modules/home-band.html` vom allgemeinen CTA-Band getrennt.

## Aktuell offene Punkte

- Ein technischer Datenschutzentwurf ist unter `/datenschutz/` vorhanden, als juristisch ungeprüfter Entwurf gekennzeichnet und aus allen kanonischen Footern sowie dem Kontaktformular verlinkt. Die Seite bleibt bis zur rechtlichen Freigabe `noindex, nofollow`.
- Rechtliche Angaben im Impressum können noch juristisch geprüft bzw. ergänzt werden.
- Live-Deployment und Live-Status sind aus dem lokalen Code nicht sicher bestätigbar.
- Git ist im aktuellen Arbeitsbereich verfügbar. Der Arbeitsbaum enthält bereits vor der Umsetzungsplanung fremde Änderungen an SEO-Reports und `sitemap.xml` sowie unversionierte Audit-/Archivdateien; diese sind zu bewahren.
- Übersetzungsqualität wurde vom Nutzer als teilweise schlecht beschrieben; keine pauschale Übersetzungsüberarbeitung ohne konkreten Auftrag.
- In `js/translations.js` existieren in IT/EN/FR noch ältere Übersetzungs-Keys mit 24h-/Toleranz-/Materiallisten-Formulierungen; diese wurden bei der thematischen Seitenabgrenzung nicht pauschal überarbeitet.
- Mehrere alte HTML-Dateien existieren weiterhin mit `noindex` oder Redirect-Ziel.
- Allgemeines CTA-Band und Startseiten-CTA-Band sind getrennt; bei künftigen CTA-Änderungen trotzdem prüfen, auf welchen Seiten das jeweilige Modul eingebunden ist.
- Die öffentliche Marke **OSMP** und der juristische Name **OS.MECHPLAST SRLS** wurden vom Inhaber am 2026-08-29 bestätigt; keine Umbenennung auf ONCC.
- SEO-Live-Prüfung nach Deployment: Redirects, Search Console, Schema Validator, Analytics/Clarity und Lighthouse-Messwerte.
- Der geprüfte Masterplan liegt in `docs/WEBSITE_MASTER_PLAN.md`; der phasenweise technische Plan liegt in `docs/WEBSITE_IMPLEMENTATION_PLAN.md`.
- Der Zeichnungs-Upload wurde gemäß Inhaberentscheidung vom 2026-08-29 vorläufig vollständig aus aktivem Kontakt-HTML, Formularlogik und Analytics entfernt. Ein späterer echter Upload benötigt einen neuen Auftrag.
- Phase 1 hat automatisiert 24/24 Tests bestanden; die reale visuelle Browser-/Assistive-Technik-Abnahme bleibt offen, weil in der Sitzung keine Browser-Instanz verfügbar war.
- Der Wissensbereich und Pages CMS sind technisch eingerichtet. Es wurde bewusst kein Artikel angelegt oder veröffentlicht. Vor Live-Nutzung müssen Cloudflare Pages auf `npm run build`/`_site` und Pages CMS auf das richtige GitHub-Repository sowie den Produktionsbranch eingestellt werden.

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
