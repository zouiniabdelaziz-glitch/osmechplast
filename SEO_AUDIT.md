# SEO-Audit – OS.MECHPLAST / OSMP

Stand: 2026-08-25. Prüfbereich: lokaler Cloudflare-Pages-Quellstand. Live-HTTP-Header, Live-Redirects und Search-Console-Daten müssen nach dem nächsten Deployment separat geprüft werden.

## Kurzfazit

Die acht kanonischen öffentlichen Seiten sind im Quellstand eindeutig definiert. Die wichtigsten Risiken waren die erst per JavaScript geladenen Module, uneinheitliche Marken-Endungen in Titles, unvollständige maschinenlesbare Unternehmensdaten und veraltete Sitemap-`lastmod`-Werte. Die Kernmodule liegen nun zusätzlich im initialen HTML vor; die bestehende Modulaktualisierung durch `js/app.js` bleibt erhalten.

## Crawl-Inventar

| Kanonische URL | Datei | Status im Quellstand |
|---|---|---|
| `https://osmechplast.com/` | `index.html` | indexierbar |
| `https://osmechplast.com/leistungen/` | `leistungen/index.html` | indexierbar |
| `https://osmechplast.com/qualitaet/` | `qualitaet/index.html` | indexierbar |
| `https://osmechplast.com/technologie/` | `technologie/index.html` | indexierbar |
| `https://osmechplast.com/unternehmen/` | `unternehmen/index.html` | indexierbar |
| `https://osmechplast.com/werkstoffe/` | `werkstoffe/index.html` | indexierbar |
| `https://osmechplast.com/kontakt/` | `kontakt/index.html` | indexierbar |
| `https://osmechplast.com/impressum/` | `impressum/index.html` | indexierbar |

## Befund und Behandlung

| Priorität | Befund | Behandlung |
|---|---|---|
| P1 | Header, Footer und mehrere Hauptabschnitte wurden erst aus `modules/*.html` nachgeladen. | Statische Fallback-Inhalte in den acht HTML-Antworten ergänzt. JavaScript ersetzt sie nach dem Laden weiter mit denselben zentralen Modulen. |
| P1 | Strukturierte Daten waren nur teilweise vorhanden und verwendeten unterschiedliche Unternehmensnamen/-daten. | Einheitlicher JSON-LD-Graph: Organization, WebSite, WebPage, Services, BreadcrumbList sowie sichtbare FAQPage. |
| P1 | Footer enthielt keine vollständigen NAP-Daten. | Firmenname, Adresse, Telefon und E-Mail als semantisches `address` ergänzt. |
| P2 | Title-Endungen waren uneinheitlich. | Acht eindeutige Titles mit konsistentem Markenende `OS.MECHPLAST`. |
| P2 | Sitemap-`lastmod` war auf ein früheres Datum festgeschrieben. | Nicht überprüfbare Datumsangaben entfernt; nur kanonische URLs bleiben. |
| P2 | Open-Graph-Angaben waren nur teilweise vorhanden. | Einheitliche `og:type`, Locale, Site-Name, Title, Description und URL ergänzt. |
| P2 | Kontaktwege waren nicht auf allen Seiten als klickbare NAP-Angaben sichtbar. | `tel:` und `mailto:` im Footer und Kontaktmodul ergänzt. |
| P3 | Es gibt einen sprachumschaltenden Client-Code, aber keine vollständigen eigenständigen Sprach-URLs. | Nur deutsche Seite und `x-default` werden ausgezeichnet. Keine erfundenen hreflang-Varianten. |

## Technische Prüfung

- `robots.txt`: erlaubt öffentliche Inhalte; sperrt API, Functions, Scripts, Outputs und lokale Hilfsdateien; Sitemap ist absolut angegeben.
- `sitemap.xml`: enthält die acht Clean URLs genau einmal und keine `.html`-Varianten.
- Canonical: pro Zielseite genau ein absoluter, selbstreferenzieller Canonical.
- Redirect-Konzept: `_redirects` führt alte `.html`- und `index.html`-Pfade auf die jeweiligen Clean URLs. Live-Status ist nach Deployment zu bestätigen.
- Indexierbarkeit: keine `noindex`-Regel auf den acht Zielseiten. `_headers` setzt `noindex` nur für technische bzw. alte Pfade.
- Sprache: `<html lang="de">`, `hreflang="de"` und `x-default` verweisen jeweils auf die tatsächliche deutsche URL.
- Mobile: alle öffentlichen Seiten enthalten `meta name="viewport"`.
- Bilder: überwiegend beschreibende Dateinamen vorhanden; leere `alt`-Attribute werden nur für dekorative Hero-/Illustrationsgrafiken verwendet.
- Links: eigene Ziele verwenden echte `<a href>`-Links mit Clean URLs. Beschreibende kontextuelle Links bestehen insbesondere zwischen Leistungen, Technologie, Werkstoffen, Qualität und Kontakt.

## Unternehmensdaten im Code

Verwendet wurden ausschließlich die sichtbaren Daten: OS.MECHPLAST SRLS / Marke OSMP, Via Strada Romana n. 19, 38061 Ala (TN), Italien, `+39 0464 667981`, `info@osmechplast.com`.

## Offene Punkte / TODO

1. **Marke bestätigen:** Der aktuelle Quellstand nutzt OSMP. Ein neuer Auftrag nennt ONCC. Kein automatischer Markenwechsel wurde vorgenommen, damit Logo, Website und rechtliche Angaben nicht widersprüchlich werden.
2. **Datenschutzseite:** Der Formularhinweis enthält weiterhin eine sichtbare TODO-Markierung, bis der freigegebene Datenschutzhinweis vorliegt.
3. **Kontaktzeiten:** Auf der Kontaktseite weiterhin als TODO markiert, da keine bestätigten Zeiten vorliegen.
4. **Sprachseiten:** Italienisch, Englisch und Französisch sind derzeit keine vollständig indexierbaren, eigenen URL-Versionen. Erst dann `hreflang` erweitern.
5. **Live-Prüfung nach Deployment:** HTTPS/www-Konsolidierung, alle 301-Ziele, `robots.txt`, `sitemap.xml`, Schema Validator, Rich Results Test und Search Console URL Inspection.

## Quellen für die Vorgehensweise

- [Google: crawlbare Links und beschreibende Ankertexte](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Google: lokalisierte Seiten und hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: Einführung in strukturierte Daten](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
