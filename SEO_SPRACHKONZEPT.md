# SEO-Sprachkonzept OS.MECHPLAST

Stand: 2026-07-19

## Aktueller Befund

Die Website hat eine Sprach-Auswahl im Header mit folgenden Optionen:

| Auswahl | Technischer Wert | Aktueller Status |
| --- | --- | --- |
| Deutsch | `de` | Hauptsprache der Website |
| English | `en` | JavaScript-Übersetzung auf derselben URL |
| Italiano | `it` | JavaScript-Übersetzung auf derselben URL |
| Français | `fr` | JavaScript-Übersetzung auf derselben URL |

Die Sprachumschaltung verändert aktuell nur die Texte im Browser per JavaScript und speichert die Auswahl lokal im Browser (`localStorage`). Sie erzeugt keine eigenen URLs wie `/it/`, `/en/` oder `/fr/`.

## SEO-Entscheidung

Aktuell gibt es nur eine echte, indexierbare Sprachversion: Deutsch.

Deshalb werden aktuell keine `hreflang`-Tags gesetzt. Das ist Absicht, weil `hreflang` nur für echte, vollständige Sprachseiten mit eigenen URLs verwendet werden soll.

Würden jetzt `hreflang`-Tags für Italienisch, Englisch oder Französisch gesetzt, wäre das aus SEO-Sicht falsch: Google und Bing würden Sprachversionen erwarten, die öffentlich nicht als eigene kanonische URLs existieren.

## Aktuelle kanonische deutsche URLs

| Seite | Kanonische URL |
| --- | --- |
| Startseite | `https://osmechplast.com/` |
| Leistungen | `https://osmechplast.com/leistungen/` |
| Qualität | `https://osmechplast.com/qualitaet/` |
| Technologie | `https://osmechplast.com/technologie/` |
| Unternehmen | `https://osmechplast.com/unternehmen/` |
| Werkstoffe | `https://osmechplast.com/werkstoffe/` |
| Kontakt | `https://osmechplast.com/kontakt/` |
| Impressum | `https://osmechplast.com/impressum/` |

## Empfohlenes URL-Konzept für spätere italienische Version

Wenn Italienisch später wirklich vollständig als eigene Sprachversion aufgebaut wird, sollte sie eigene statische URLs bekommen:

| Deutsch | Italienisch später |
| --- | --- |
| `https://osmechplast.com/` | `https://osmechplast.com/it/` |
| `https://osmechplast.com/leistungen/` | `https://osmechplast.com/it/servizi/` |
| `https://osmechplast.com/qualitaet/` | `https://osmechplast.com/it/qualita/` |
| `https://osmechplast.com/technologie/` | `https://osmechplast.com/it/tecnologia/` |
| `https://osmechplast.com/unternehmen/` | `https://osmechplast.com/it/azienda/` |
| `https://osmechplast.com/werkstoffe/` | `https://osmechplast.com/it/materiali/` |
| `https://osmechplast.com/kontakt/` | `https://osmechplast.com/it/contatto/` |
| `https://osmechplast.com/impressum/` | `https://osmechplast.com/it/note-legali/` |

## Wann `hreflang` ergänzt werden darf

`hreflang` sollte erst ergänzt werden, wenn alle folgenden Punkte erfüllt sind:

1. Die italienischen Seiten existieren als echte öffentliche URLs.
2. Jede italienische Seite hat einen eigenen italienischen Title, Meta-Description, H1 und Hauptinhalt.
3. Jede italienische Seite hat einen selbstreferenziellen Canonical.
4. Deutsche und italienische Seiten verweisen paarweise korrekt aufeinander.
5. Die italienischen URLs sind in der Sitemap enthalten.
6. Alte oder technische Testseiten bleiben ausgeschlossen.

Dann kann pro Seitenpaar zum Beispiel Folgendes ergänzt werden:

```html
<link rel="alternate" hreflang="de" href="https://osmechplast.com/leistungen/">
<link rel="alternate" hreflang="it" href="https://osmechplast.com/it/servizi/">
<link rel="alternate" hreflang="x-default" href="https://osmechplast.com/leistungen/">
```

## Offene Punkte / TODO

- Italienische Inhalte fachlich vollständig prüfen und freigeben.
- Entscheiden, ob Englisch und Französisch nur als Komfort-Auswahl bleiben oder später ebenfalls echte SEO-Sprachversionen werden.
- Wenn echte Sprachversionen entstehen: Routing, Sitemap, Canonicals, interne Links und `hreflang` gemeinsam aktualisieren.
