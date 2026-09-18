# Technische Datenschutz-Datenflüsse

Stand: 2026-08-29  
Status: Technisch verifiziert; juristische Prüfung ausstehend

Dieses Dokument beschreibt ausschließlich die im Repository nachweisbaren Datenflüsse. Es legt keine Rechtsgrundlage fest und ersetzt keine juristische Prüfung.

## Datenflüsse

| Bereich | Auslöser | Verarbeitete Daten | Empfänger / Speicher | Technischer Stand | Offener Prüfpunkt |
|---|---|---|---|---|---|
| Kontaktformular | Absenden durch Nutzer | Firma, Name, E-Mail, optional Telefon, Leistung, Nachricht, Sprache | Same-Origin-Endpunkt `/api/leads`; Cloudflare Pages Function; D1-Tabelle `leads` | Im Code verifiziert | Rechtsgrundlage, Aufbewahrungs- und Löschfrist |
| Serverseitige Lead-Metadaten | Erfolgreiche API-Anfrage | `source=website`, `status=new`, serverseitiger Zeitstempel; `ai_analysis=null` | Cloudflare D1 | Im Code verifiziert | Berechtigungskonzept und Löschprozess in Cloudflare |
| Zeichnungs-Upload | Formular mit erlaubter Datei | PDF, ASCII-DXF, STEP, STP, JPG, JPEG oder PNG; Dateiname und technische Metadaten | Same-Origin `/api/leads`, private R2-Ablage und D1-Metadaten | Dateien starten in Quarantäne; Zugriff nur über geschützte Mitarbeiterroute | Aufbewahrung, Malwareprüfung und Freigabeprozess organisatorisch bestätigen |
| Sprachwahl | Auswahl im Seitenkopf | Sprachcode `de`, `it`, `en` oder `fr` | Local Storage: `oscnc_lang` | Im Code verifiziert | Einordnung als technisch erforderlich prüfen |
| Consent-Entscheidung | Zustimmung oder Ablehnung | `granted` oder `denied` | Local Storage: `osmp_analytics_clarity_consent` | Im Code verifiziert | Speicherdauer und Text juristisch prüfen |
| Google Analytics 4 | Nur nach Zustimmung | Seitenaufrufe, Klick- und Formularereignisse gemäß `js/analytics.js` | Google; Measurement-ID `G-KFFN0VWBGK` | Ladeblockade vor Zustimmung automatisiert getestet | Vertrag, Drittlandtransfer, Aufbewahrung und vollständige Ereignisliste prüfen |
| Microsoft Clarity | Nur nach Zustimmung | Nutzungs- und Interaktionsdaten gemäß Anbieterfunktion | Microsoft; Project-ID `xlwutfjzhw` | Ladeblockade vor Zustimmung automatisiert getestet | Vertrag, Drittlandtransfer, Maskierung und Aufbewahrung prüfen |
| Analyse-Cookies | Nach Zustimmung durch externe Dienste möglich | Cookie-Kennungen von Google/Clarity | Browser und jeweiliger Anbieter | Ablehnung entfernt bekannte Präfixe im Code | Tatsächlich gesetzte Cookies im Live-System inventarisieren |
| Google Fonts | Aufruf einer HTML-Seite | Technisch mindestens IP-Adresse, User-Agent und Abrufdaten | `fonts.googleapis.com`, `fonts.gstatic.com` | Externe Einbindung in Seitenquelltext verifiziert | Rechtsgrundlage prüfen oder lokale Auslieferung erwägen |
| Cloudflare Hosting | Jeder Seiten- und API-Aufruf | Technische Verbindungs- und Sicherheitsdaten nach Cloudflare-Konfiguration | Cloudflare | Plattformnutzung verifiziert; konkrete Logkonfiguration nicht im Repository | Vertrag, Region, Logs und Aufbewahrung im Konto prüfen |
| Google Maps | Nur Klick auf externen Routenlink | Abrufdaten beim Öffnen der Google-Seite | Google Maps | Reiner externer Link, keine eingebettete Karte | Linktext und Anbieterhinweis juristisch prüfen |

## Kontaktformular-Vertrag

- Pflichtfelder im Frontend: Firma, Ansprechpartner und E-Mail.
- Serverseitig zwingend validiert: formal plausible E-Mail; erlaubte Sprach- und Leistungswerte; Feld- und Body-Grenzen.
- Der Browser sendet JSON ohne Datei oder Multipart mit Dateien an den relativen Same-Origin-Pfad `/api/leads`.
- Clientwerte für Quelle, Status, Zeitstempel und Analyse werden nicht vertraut; die Function setzt sie selbst.
- Bei einem Fehler bleiben Eingaben im Formular erhalten. Nur eine erfolgreiche 2xx-Antwort setzt das Formular zurück und erzeugt das Erfolgsereignis.
- Uploads werden serverseitig validiert, privat gespeichert und zunächst als `security_status=quarantine` geführt. Eine vollständige Schadsoftwareprüfung ist nicht Bestandteil dieser technischen Prüfung.

## Consent-Vertrag

- Ohne gespeicherte Zustimmung werden weder Google Analytics noch Microsoft Clarity geladen.
- Bei Ablehnung werden beide Skripte nicht geladen und bekannte Analyse-Cookies aktiv entfernt.
- Bei Zustimmung werden beide Skripte höchstens einmal geladen.
- Die Sprachwahl ist technisch von der Analyse-Einwilligung getrennt.

## Extern zu klären

Die folgenden Punkte sind nicht zuverlässig aus dem Repository ableitbar und bleiben in `docs/EXTERNAL_ACTIONS.md` offen: Datenschutz-Verantwortlicher und Kontaktkanal, Rechtsgrundlagen, Empfängerliste, Aufbewahrungsfristen, Cloudflare-/Google-/Microsoft-Verträge, Drittlandtransfers, Betroffenenprozess sowie die tatsächliche Live-Konfiguration und Cookie-Liste.
