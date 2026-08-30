# Externe Arbeiten und fehlende Baseline

Stand: 2026-08-29  
Zweck: Dokumentation aller Arbeiten, die nicht allein im lokalen Repository abgeschlossen werden können. Ein fehlender Kontozugriff blockiert die lokalen Korrekturen der Phase 1 nicht.

| ID | System/Verantwortlicher | benötigte Information oder Aktion | Nachweis | Status | blockiert lokale Phase 1? |
|---|---|---|---|---|---|
| E01 | Inhaber | Öffentliche Marke OSMP bestätigen | Entscheidung D01 vom 2026-08-29 | abgeschlossen | nein |
| E02 | Inhaber | Juristischen Namen OS.MECHPLAST SRLS bestätigen | Entscheidung D02 vom 2026-08-29 | abgeschlossen | nein |
| E03 | Inhaber | Zeichnungs-Upload vorläufig vollständig entfernen | Entscheidung D03 vom 2026-08-29 | abgeschlossen | nein |
| E04 | Google Search Console | Property-Typ und Zugriff; Sitemapstatus; Page Indexing; Exporte für Queries, Pages, Länder, Geräte und CWV mit Zeitraum | datierter Export/Screenshot | blockiert | nein |
| E05 | Google Analytics 4 | Property/Datenstream; tatsächlicher Eingang von `lead_form_submit`, `lead_form_success`, Telefon-/E-Mail-Klicks; freigegebene Conversiondefinition | DebugView-/Berichts-Nachweis ohne personenbezogene Werte | blockiert | nein |
| E06 | Cloudflare Pages | Projektname, Produktionsbranch, Deploymentzuordnung und Übereinstimmung von lokalem Stand und Live-Version | Dashboardexport/Screenshot und späterer Deployment-Hash | blockiert | nein |
| E07 | Cloudflare D1 | Name/Binding der produktiven Lead-Datenbank, Schema-/Backup-Prozess, Zugriffsrollen und Aufbewahrung | Dashboard-/Schemaexport | blockiert | nein |
| E08 | Cloudflare Security | Bestehende WAF-, Bot-, Rate-Limit-, CORS-, Cache- und Headerregeln für `/api/leads` und Website | Regel-Export/Screenshots | blockiert | nein; lokale Validierung wird umgesetzt |
| E09 | Cloudflare Domains | Dauerhafte Weiterleitung von `www` auf die später freigegebene Hauptdomain | Redirect-Regel und Live-Matrix | blockiert bis Phase 2 | ja, nur für M2.2 |
| E10 | Datenschutz-Fachperson | Datenschutzentwurf: Verantwortlicher/Kontakt, Rechtsgrundlagen, Auftragsverarbeiter, Drittlandtransfers, Fristen und Betroffenenrechte prüfen | datierte Freigabe oder Korrekturliste | blockiert | nein für technischen Entwurf; ja für rechtliche Finalität |
| E11 | Inhaber/Fertigung | Behauptungen C05–C06 und C14–C19 sowie Impressumsangaben C24 prüfen | schriftliche Freigabe/Beleg je Registerzeile | blockiert | nein für Formularfix; ja für spätere Textausrollung |
| E12 | Browser/Assistive Technik | Reale Prüfung von Kontaktformular, Consent, Tastatur, Fokus, Mobilansicht und Screenreader | Testprotokoll mit Umgebung/Datum | blockiert am 2026-08-29: keine Browser-Instanz verfügbar | teilweise; automatisierte Tests und lokaler HTTP-Smoke-Test sind abgeschlossen, visuelle Prüfung ist nicht verifiziert |

## Noch fehlende Baseline-Daten

- Keine bereitgestellten GSC-Performance-/Indexierungsdaten.
- Keine bereitgestellten GA4-Ereignis-/Conversiondaten.
- Keine bereitgestellte Cloudflare-Konfiguration für Pages, D1, WAF oder Rate Limiting.
- Keine juristische Freigabe einer Datenschutzseite.
- Keine vollständige interne Freigabe der im Behauptungsregister markierten Unternehmens- und Maschinenangaben.

Diese Lücken werden nicht durch Schätzungen ersetzt.
