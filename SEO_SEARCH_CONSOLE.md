# Google Search Console – Einrichtung und Routine

Stand: 2026-08-25. Diese Schritte sind manuell im Google-Konto auszuführen; im Quellcode wird kein Verifikationscode erfunden.

## Domain-Property per DNS

1. In [Google Search Console](https://search.google.com/search-console/) eine **Domain-Property** für `osmechplast.com` anlegen.
2. Den von Google bereitgestellten TXT-Wert beim DNS-Provider/Cloudflare für `osmechplast.com` eintragen. Bestehende TXT-Records nicht ersetzen.
3. Nach DNS-Propagation in Search Console auf **Bestätigen** klicken.
4. `https://osmechplast.com/sitemap.xml` unter **Sitemaps** einreichen.
5. Mit URL-Prüfung mindestens `/`, `/leistungen/`, `/technologie/`, `/werkstoffe/`, `/qualitaet/`, `/unternehmen/` und `/kontakt/` prüfen.
6. Erst nach dem nächsten erfolgreichen Deployment die Live-Redirects und den kanonischen Header kontrollieren.

## Nach der Einrichtung kontrollieren

| Bereich | Sollzustand |
|---|---|
| Sitemaps | acht URLs gefunden; keine `.html`-Altpfade |
| Indexierung | kanonische Clean URLs indexierbar; keine ausgeschlossenen Zielseiten ohne Grund |
| URL-Prüfung | gerenderte Seite enthält H1, Kerntext, NAP-Daten und interne Links |
| Seitenindexierung | keine Soft-404, keine Weiterleitungsketten, keine falschen Canonicals |
| Leistung | Suchanfragen, Klicks, Impressionen, CTR und durchschnittliche Position monatlich vergleichen |
| Verbesserungen | Mobile Usability, Core Web Vitals und strukturierte Daten beobachten |

## Dokumentationsvorlage (monatlich, maximal 30 Minuten)

- Zeitraum / verantwortliche Person
- Klicks, Impressionen, CTR, durchschnittliche Position
- neue bzw. ausgeschlossene URLs und Grund
- Crawling-/Sitemap-Fehler
- Core Web Vitals / wichtige PageSpeed-Veränderungen
- erfolgreiche Anfragen (nur aggregiert, keine personenbezogenen Daten)
- neue Backlinks bzw. offizielle Profile
- eine priorisierte technische oder inhaltliche Folgeaufgabe

## Voraussetzungen außerhalb des Codes

- Google-Unternehmensprofil: echte Profil-URL erst nach Verifikation als `sameAs` ergänzen.
- Datenschutzhinweis: vor produktiver Bewertung von Analytics/Clarity rechtlich finalisieren.
