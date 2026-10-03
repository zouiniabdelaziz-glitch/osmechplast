# Interne Mitarbeiteroberfläche – vollständige aktuelle Designspezifikation

Stand: 25.09.2026. Konsolidierung der im bisherigen Chat vereinbarten Spezifikation, der ausdrücklich verlangten Sicherheitsnachträge und der umgesetzten visuellen Korrekturen. Keine neue Architekturentscheidung und keine Behauptung einer bereits implementierten internen Anwendung.

## 1. Geltung, Freigabe und Projektbasis

Projekt: `C:\Users\Director\Documents\Italien Firma\oscnc`.

Diese Datei ist die übertragbare Fassung der bisher nur im Chat vorhandenen Spezifikation. Sie wird außerhalb des Projekts gespeichert, weil dessen Schreibzugriff in der alten Sitzung eingeschränkt war. Maßgebliche Ergänzung ist der zugehörige Umsetzungsplan im selben Übergabeordner.

- Die Designspezifikation ist als Grundlage für den Umsetzungsplan freigegeben.
- Der lokale visuelle Entwurf und die sieben nachfolgenden visuellen Korrekturen wurden ausdrücklich beauftragt und umgesetzt.
- Es liegt dadurch KEINE Freigabe für Produktcode, produktive Migrationen, Installation, Commit, Push, Deployment oder Cloudflare-Änderungen vor.
- Eine abschließende Benutzerfreigabe der zuletzt korrigierten Screenshots ist nicht dokumentiert.
- Die neue Sitzung soll keine abgeschlossene Architekturabfrage wiederholen.

Die abgeschlossene GitHub-API-Prüfung belegte:

| Referenz | Commit |
|---|---|
| master | 23b1ee2547a3d828e33ece522c612d7e97a3d358 |
| rfq-upload-preview | d597c433b9f7bf36c7f527b1b9957142812b99df |
| Gemeinsamer Dateibaum | 05fe610c52fafdddf3b4b916cbaf9ced155be780 |

Der master-Merge hat die Eltern `5a401606a53d9f335080e71fd50e0461eb4574ff` und `d597c433b9f7bf36c7f527b1b9957142812b99df`. Die frühere Aussage, die Upload-Implementierung fehle in master, beruhte auf einer veralteten lokalen Remote-Tracking-Referenz und wurde korrigiert. Der identische Dateibaum enthält Upload, Access und Cleanup. Das ist ein historisch belegter Stand, keine Live-Bestätigung für spätere Remote-Änderungen.

Letzte lesende Prüfung bei Erstellung dieser Übergabe: lokaler Branch `rfq-upload-preview`, HEAD `d597c433b9f7bf36c7f527b1b9957142812b99df`, sauberer Arbeitsbaum. Kein Fetch, Branchwechsel, Pull oder Merge ausgeführt. Spätere Umsetzung auf freigegebener, erneut lesend geprüfter master-Ausgangsbasis; noch keine eigenmächtige Branchanlage.

## 2. Ziel und Nicht-Ziele

Eine kleine interne Oberfläche für Mitarbeiter zeigt alle eingegangenen technischen Anfragen, auch Anfragen ohne Dateien. Sie ermöglicht Übersicht, Suche, Detailansicht, Geschäftsstatusänderungen und bestehende Mitarbeiteraktionen an privaten Uploads.

Version 1 umfasst keine Kundenkonten, E-Mail-Automation, Angebotserstellung, Auftragsverwaltung, Rollenverwaltung, Exporte, Löschoberfläche oder vollständige CRM-Erweiterung. Öffentliche Website, CMS, Anfrageannahme, Uploadlimits, Turnstile und Rate Limiting werden nicht neu gestaltet oder abgeschwächt. Der vorhandene Cleanup-Worker wird nicht im Zuge dieser Oberfläche erweitert.

Technik: bestehendes HTML/CSS/JavaScript, Eleventy, Cloudflare Pages Functions, D1 und privates R2. Keine neue UI-Bibliothek.

## 3. Pfade und Schutzgrenze

Neue Oberfläche: `/internal/`.

Neue APIs:

- `GET /internal/api/leads`
- `GET /internal/api/leads/:leadId`
- `POST /internal/api/leads/:leadId/status`

Vorhandene Routen bleiben erhalten:

- `GET /internal/leads/:leadId/uploads/:uploadId`
- `POST /internal/leads/:leadId/uploads/:uploadId/approve`
- `POST /internal/leads/:leadId/uploads/:uploadId/reject`

Auch `/internal` ohne Slash, interne CSS-/JS-Dateien und unbekannte interne Pfade gehören zur Schutzfläche. Eine Weiterleitung darf keine ungeschützten internen Inhalte ausliefern. Unbekannte authentifizierte API-Pfade liefern JSON-404, keinen HTML-/SPA-Fallback.

### Cloudflare Access: ausdrücklich UNGEPRÜFT

Nachgewiesen war lediglich eine Anwendung für `osmechplast.com/internal/leads/*`. Die inzwischen möglicherweise erfolgte Erweiterung auf `/internal/*` ist NICHT belegt. Vor geschütztem Online-Test muss die Access-Anwendung den gesamten internen Bereich einschließlich `/internal` abdecken. Das ist für Apex, `www.osmechplast.com` und den tatsächlich benutzten Preview-Host getrennt zu prüfen. Kein unbeabsichtigter Schutz der öffentlichen Website.

Diese Cloudflare-Prüfung ist eine Deployment-/Online-Test-Voraussetzung, keine Voraussetzung für lokale Planung oder synthetische Tests. Jetzt keine Cloudflare-Änderung.

### Backend bleibt selbst verantwortlich

Alle internen APIs und Aktionen prüfen Access-JWT und Mitarbeiterberechtigung serverseitig, auch bei direktem Handleraufruf. Versteckte Buttons oder Access allein sind keine ausreichende Autorisierung.

Vorhandene Konfigurationsnamen:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_POLICY_AUD`
- `ACCESS_ALLOWED_SUBJECTS`
- `ACCESS_ALLOWED_GROUPS`

Vorgesehene Einzelberechtigung aus der bisherigen Planung: `abdelaziz.zouini@osmechplast.com`, Subject `04833bf3-b356-59d9-bee2-7cb869f8d78e`. Identität ausschließlich aus verifiziertem `sub`, keine Ableitung aus unbestätigter E-Mail. Die konfigurierte Identität ist vor Online-Freigabe zu bestätigen; diese Dokumentation ist keine aktuelle Dashboard-Prüfung. Version 1 darf keine zusätzliche unbestätigte Gruppenberechtigung eröffnen.

JWT-Prüfung: RS256, kid, JWKS-Schlüssel, Signatur, exakter Issuer, Audience, Ablauf und nbf; Team-Domain sicher normalisieren, keine Benutzerinformationen, Pfade, Query oder Fragmente zulassen. JWKS-Netzwerkabruf auf drei Sekunden begrenzen. Fehler und fehlende Werte führen fail-closed. Kein Produktions-Testmodus.

Neue normale Runtime-Variablen:

- `INTERNAL_ORIGIN`: exakter zulässiger HTTPS-Origin pro Umgebung.
- `INTERNAL_UI_ENABLED`: nur `1` aktiviert neue UI und neue Lead-API. Bestehende Datei-Review-Routen verwenden zusätzlich den Datenbank-Guard, nicht nur diesen Schalter.

## 4. HTTP-, Browser- und Eingabesicherheit

Bei internen Mutationen: Methode, verifizierte Identität, Mitarbeiterberechtigung, Origin/Cross-Site-Kontext, Content-Type, tatsächliche Body-Bytezahl und Feldvertrag prüfen, bevor fachlich gelesen/geschrieben wird. Sicherheits-Audits sind von fachlichen Datenzugriffen zu unterscheiden.

- Nur die vorgesehenen Methoden; sonst 405 mit Allow.
- JSON für Mutationen; falscher Typ 415.
- Höchstens 4.096 tatsächlich gelesene Bytes, sonst 413.
- Ungültiges JSON, UTF-8, unbekannte Felder oder doppelte Queryparameter ablehnen.
- Lead-ID: kanonische positive sichere Ganzzahl, keine Exponenten/Dezimalzahlen/alternativen Schreibweisen.
- Upload-ID und neue Status-Request-ID: gültige UUID v4.
- Kein CORS-Zugriff für fremde Origins.
- Keine internen SQL-, Bucket-, Token- oder Ausnahmeinformationen in Antworten.

Interne Antworten: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`. CSP auf lokale benötigte Ressourcen beschränken; frame-ancestors und base-uri sperren, Form-/Connect-Ziele einschränken. Downloads erhalten eigene sichere Header.

Kundentexte mit `textContent`/sicheren DOM-Operationen ausgeben, nicht unkontrolliert mit innerHTML. Keine Kundendaten/JWTs in localStorage, sessionStorage, IndexedDB, Service Worker oder Offlinecache. Keine Analytics und keine externen Fonts/Skripte in der internen UI. Öffentliche `js/app.js` nicht in die interne UI laden.

## 5. Datenansichten und API-Verträge

### Übersicht

Parameter: `page` 1 bis 10.000, `status` optional new/in_progress/completed, `q` optional getrimmt bis 100 Unicode-Codepoints. Suche in Firma, Name und E-Mail, nicht im Nachrichtentext. LIKE-Metazeichen maskieren und Parameter binden.

Sortierung: `created_at DESC, id DESC`. 25 Einträge je Seite; 26 abfragen für `has_more`. Keine Cursor-Paginierung. Neue Anfragen können Offset-Seiten verschieben; manuelles Aktualisieren anbieten.

Antwort enthält `items`, `page`, `has_more`. Ein Item enthält id, company, name, email, phone, service, language, created_at, workflow_status, workflow_version, technischen intake_status aus bisherigem leads.status und Dateianzahl/-statuszusammenfassung. Keine N+1-Abfragen. Kein globaler Gesamtzähler, keine globalen Statuszähler: dafür ist keine API-Datenquelle vereinbart. Die Anzahl der aktuell gerenderten Zeilen darf lokal angezeigt werden.

### Detail

Lead samt Nachricht, Kontakt- und Kontextfeldern sowie Uploadmetadaten. Pro Upload: id, original_name, extension, detected_type, byte_size, created_at, stored_at, reviewed_at, storage_status, security_status, rejection_reason und serverseitig abgeleitete allowed_actions. Keine r2_key-, Secret- oder ai_analysis-Ausgabe.

Verlauf: keine erfundenen Ablage-/Zuordnungsereignisse. Der Eingang ist über leads.created_at belegbar. Erfolgreiche Geschäftsstatuswechsel sind nur aus tatsächlichen Audit-/Request-Belegen darzustellen, nicht aus aktuellem Status/Version rückwärts zu erfinden. Falls solche Belege in der späteren Detailantwort geliefert werden, gehören sie zu dieser Detailroute und werden auf erfolgreiche Ereignisse des autorisierten Leads begrenzt; keine separate neue API ist festgelegt. Der lokale Entwurf verwendet explizite synthetische Ereignisse.

### Statusmutation

```json
{"request_id":"UUID-v4","expected_status":"new","expected_version":0,"target_status":"in_progress"}
```

Erfolg:

```json
{"ok":true,"status":"in_progress","version":1}
```

Neue APIs verwenden `{ "ok": false, "error": "code" }`. Bestehende Datei-Routen behalten ihren bisherigen `{ "error": "code" }`-Vertrag.

| HTTP | Fehler |
|---|---|
| 400 | invalid_request, invalid_transition |
| 401 | unauthorized |
| 403 | forbidden |
| 404 | lead_not_found |
| 409 | status_conflict, idempotency_conflict |
| 413 | payload_too_large |
| 415 | unsupported_media_type |
| 503 | temporarily_unavailable; bestehende Reviewroute neutral bei gesperrtem Schema |

## 6. Geschäftsstatusmaschine

Erlaubt: new → in_progress; new → completed; in_progress → completed; completed → in_progress mit ausdrücklich beschrifteter Aktion „Wieder öffnen“.

Nicht erlaubt: in_progress → new, completed → new, unveränderter Status als Mutation. Direkter Abschluss erlaubt die Bearbeitung kurzer Anfragen; Wiederöffnung bildet Rückfragen ab, ohne den ursprünglichen Eingang zu fälschen.

Neue Felder `leads.workflow_status` (Default new) und `leads.workflow_version` (Default 0). Das bestehende technische `leads.status` bleibt bestehen. Bekannte vorhandene Geschäftsstatus können bei Migration übernommen werden; unbekannte/technische Werte bleiben im alten Feld und führen im neuen Feld zu new. Keine Umdeutung von upload_failed in erfolgreichen Upload.

Version ist eine sichere Ganzzahl von 0 bis 9007199254740991; erwartete Version bei einer neuen Mutation höchstens 9007199254740990. Jede erfolgreiche Änderung erhöht sie genau um eins. Die Ansicht allein verändert nichts. Version schützt auch vor ABA-Konflikten.

## 7. Vollständiges Idempotenz- und Auditmodell

Geschäftsstatus-Requests sind von der bestehenden öffentlichen Tabelle `lead_requests` getrennt. Für kurze atomare Statusänderungen wird KEIN dauerhaftes processing benötigt. Ergebnis wird bereits innerhalb desselben atomaren Vorgangs gespeichert.

### lead_status_requests

| Feld | Festlegung |
|---|---|
| request_id | TEXT PRIMARY KEY NOT NULL; API validiert UUID v4 |
| actor_id | TEXT NOT NULL, verifiziertes Subject |
| requested_lead_id | positive sichere INTEGER, unveränderliche angefragte ID |
| lead_id | nullable INTEGER, FK leads(id) ON DELETE SET NULL |
| expected_status / expected_version | validierter erwarteter Ausgangszustand |
| target_status | erlaubtes Ziel |
| observed_status / observed_version | gemeinsam nullable; tatsächlicher Zustand beim Entscheiden |
| response_code | 200, 404 oder 409 |
| detail_code | status_changed, lead_not_found oder status_conflict |
| result_version | nur bei Erfolg INTEGER |
| occurred_at | NOT NULL, UTC-Zeit des ursprünglichen Vorgangs |

Constraints: erlaubte vier Übergänge; Integer-/Versionsgrenzen; observed-Werte gemeinsam vorhanden oder leer; Erfolg verlangt observed=expected und result_version=expected_version+1; 404 verlangt fehlende beobachtete Werte und keine Ergebnisversion; 409 speichert den tatsächlich beobachteten Zustand ohne Ergebnisversion. Falls lead_id vorhanden, entspricht sie requested_lead_id.

### lead_status_audit

| Feld | Festlegung |
|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT |
| request_id | nullable TEXT, NICHT UNIQUE, keine löschende Kaskade |
| lead_id | nullable INTEGER, FK leads(id) ON DELETE SET NULL |
| actor_type / actor_id | employee mit verifiziertem Subject oder unknown mit NULL |
| action | lead_status_change |
| result | success oder denied |
| detail_code | feste Allowlist unten |
| expected_status / expected_version | nullable; nur validierte Werte der aktuellen Anfrage |
| from_status / from_version | tatsächlicher Ausgangszustand; nullable falls nicht bekannt |
| to_status / to_version | angefragtes validiertes Ziel; Zielversion nur bei Erfolg |
| occurred_at | NOT NULL, UTC |

Codes: status_changed, lead_not_found, status_conflict, idempotency_conflict, invalid_request, invalid_transition, access_denied, origin_denied. Erfolg nur mit status_changed. Keine vertraulichen Kundendaten oder rohen Requestbodys in Auditcodes. Vor der Autorisierung keine Kundendetails nachladen, nur um ein Audit anzureichern.

Audit speichert erfolgreiche Änderungen, Statuskonflikte, Nichtvorhandensein, Idempotenzkonflikte und verweigerte/ungültige Aktionen. Felder für unbekannte Identität/Lead/Inhalt bleiben NULL. Ein Konfliktaudit bei belegter Request-ID beschreibt den aktuellen Versuch, nicht unzulässig die Daten des ursprünglichen anderen Mitarbeiters.

Indizes: leads(workflow_status,created_at,id), leads(created_at,id), lead_status_audit(lead_id,occurred_at), lead_status_audit(request_id), lead_status_audit(occurred_at).

### Konkreter atomarer Ablauf

Eine D1-batch()-Transaktion enthält:

1. INSERT … SELECT eines Request-Belegs aus der angefragten ID und dem aktuellen Lead. Entscheidung 404 bei fehlendem Lead, 200 bei passendem erwarteten Status UND Version, sonst 409. `ON CONFLICT(request_id) DO NOTHING`.
2. INSERT eines separaten denied/idempotency_conflict-Audits, wenn dieselbe ID bereits mit abweichendem actor_id, requested_lead_id, expected_status, expected_version oder target_status belegt ist. Originalbeleg nicht ändern.
3. SELECT der gespeicherten Antwort nur bei vollständiger Übereinstimmung dieser Vergleichsfelder. Kein Treffer bedeutet neutralen 409-Idempotenzkonflikt.

Ein AFTER INSERT-Trigger auf lead_status_requests führt Erfolg und Audit aus. Kern des bedingten Updates:

```sql
UPDATE leads
SET workflow_status = NEW.target_status,
    workflow_version = workflow_version + 1
WHERE NEW.response_code = 200
  AND id = NEW.lead_id
  AND workflow_status = NEW.expected_status
  AND workflow_version = NEW.expected_version;

SELECT CASE WHEN NEW.response_code = 200 AND changes() <> 1
  THEN RAISE(ABORT, 'status_write_conflict') END;
```

Danach INSERT Audit aus NEW: tatsächliche observed-Werte → from-Werte, target_status → to_status, result_version → to_version; Erfolg/Verweigerung passend zum gespeicherten Ergebnis. Das ist ein SQL-/Trigger-Entwurf, keine ausgeführte Migration. Komplette ausführbare DDL und Constraints entstehen testgetrieben in Aufgabe 2/3.

Jeder Trigger-/Auditfehler bricht die Anweisung und den Batch ab. Keine Erfolgsantwort ohne Audit und Request-Beleg. Scheitert ein Verweigerungs-Audit, darf daraus niemals Erfolg werden; neutraler Fehler, keine Statusmutation. Öffentliche Fehlermeldungen enthalten keine SQL-Ausnahme.

Identische Wiederholung: gespeicherte Antwort, kein zweiter Übergang/Erfolgs-Audit. Gleiche ID mit anderem Inhalt/Benutzer: 409, Original unverändert, Konfliktaudit. Parallele gleiche ID: ein ursprünglicher Vorgang. Parallele verschiedene IDs mit derselben Ausgangsversion: ein Erfolg, ein Konflikt. Unklarer Netzwerkausgang: dieselbe ID wiederverwenden, nicht blind neue Aktion anlegen.

Nach Lead-Löschung bleibt requested_lead_id erhalten und lead_id wird NULL. Die identische Wiederholung kann die historische Antwort liefern, ohne Lead-Wiederanlage; nachfolgendes GET liefert 404. Autorisierung gilt auch für Wiederholungen.

### Nachvollziehbarkeit

Bei Erfolg muss eine Abfrage durch Join auf request_id belegen:

```text
expected_status = observed_status = audit.from_status
expected_version = observed_version = audit.from_version
target_status = audit.to_status
result_version = audit.to_version = audit.from_version + 1
```

Bei Konflikt müssen erwarteter und beobachteter Zustand nachvollziehbar sein; keine erfolgreiche Zielversion. Aktueller Leadzustand kann später abweichen und ist kein Ersatz für historische Snapshots.

## 8. Dateiaktionen, Migration 0005/0006 und atomarer Review-Audit

| storage_status | security_status | Aktion |
|---|---|---|
| stored | quarantine | Download, Freigeben, Ablehnen |
| stored | approved | nur Download |
| stored | rejected | Mitarbeiterdownload mit ausdrücklicher Warnung; keine erneute Freigabe/Ablehnung |
| pending/failed/delete_pending/deleted | beliebig | keine Dateiaktion |
| unbekannt | beliebig | fail-closed |

Backend und UI verwenden dieselbe Matrix; der Server ist maßgeblich. Freigabe/Ablehnung nur bedingt auf stored+quarantine. Ablehnungsgrund: String, NFC, trim, 1–200 Codepoints, keine C0/C1-Steuerzeichen oder einzelnen Surrogates; weder Fallbacktext noch stilles Kürzen. Download nicht als Malwarefreiheit darstellen.

### Gate und Schutz alter Deployments

0005 ergänzt internal_review_control mit Singleton id=1, enabled=0/1 (Default 0), protocol_version=2 und changed_at. lead_uploads erhält review_request_id. Der Protokoll-Guard prüft bei tatsächlicher Sicherheitsstatusänderung: Gate offen, Protokoll 2, neue nicht leere review_request_id ungleich alter ID. Neuer Handler generiert pro Versuch eine serverseitige UUID. Alte SQL ohne neue ID bleibt nach Wiederöffnung gesperrt. Keine Änderung am bestehenden Clientvertrag für Dateiaktionen.

Der Protokoll-Guard allein beweist NICHT die Vollständigkeit von 0006. Deshalb installiert 0005 zusätzlich:

```sql
CREATE TRIGGER upload_review_migration_block
BEFORE UPDATE OF security_status ON lead_uploads
WHEN NEW.security_status IS NOT OLD.security_status
BEGIN
  SELECT RAISE(ABORT, 'review_unavailable');
END;
```

Nur 0005 mit versehentlich enabled=1 bleibt damit gesperrt, selbst mit frischer Request-ID. Änderungen ausschließlich am storage_status durch Cleanup bleiben möglich.

### Reihenfolge 0006

1. Gate schließen.
2. Vollständigen fachlichen Review-Guard installieren.
3. Erfolgs-Audit-Trigger installieren.
4. Als LETZTE Anweisung `DROP TRIGGER upload_review_migration_block;` ohne IF EXISTS.

Fachlicher Guard bei tatsächlicher security_status-Änderung: alter und neuer Speicherstatus stored, alter Sicherheitsstatus quarantine, Ziel approved/rejected, reviewed_by und reviewed_at gesetzt, Ablehnungsgrund für rejected vorhanden/begrenzt, bei approved NULL. Unicode-/Steuerzeichenprüfung zusätzlich im Handler. AFTER UPDATE schreibt Erfolg in vorhandenes upload_audit_log mit file_approved/file_rejected, approved/rejected, employee und reviewed_by. Auditfehler rollt den Statuswechsel zurück. Handler entfernt seinen bisherigen separaten Erfolgs-Audit, behält Verweigerungs-Audits.

Unvollständige 0006 als Statement-Präfix bleibt gesperrt. Ein Fehler beim Erstellen eines Pflicht-Triggers muss die Ausführung stoppen, bevor DROP erreicht wird. Diese Executor-Eigenschaft ist mit lokalem D1 zu prüfen, NICHT vorauszusetzen. Eine Versionsmarkierung oder bloßer Triggername ersetzt keine Funktionsprüfung. Privilegierte spätere Schema-Manipulationen sind nicht von dieser Garantie abgedeckt.

Fehlendes/inkompatibles Schema oder geschlossenes Gate: neutral 503 vor Reviewmutation. Fachlicher Konflikt: weiterhin 409 invalid_state mit denied-Audit. Kein erfundener rückwirkender Audit für historische Vorgänge.

### Downloads

JWT und Matrix prüfen, dann R2 lesen, Status vor Ausgabe nochmals prüfen. Attachment, nosniff, no-store, sicherer Dateiname ohne CRLF, kein öffentlicher Link. Pflicht-Audit muss vor Streaming erfolgreich sein. Fehlendes Objekt neutral behandeln. Audit belegt genehmigten Abruf, NICHT vollständig übertragene Bytes. Ein bereits gestarteter Download kann nicht rückwirkend zurückgerufen werden.

## 9. Aufbewahrung

Kein ON DELETE CASCADE für neue Request-/Auditbelege. Keine vertraulichen Kundendaten darin. Konsistent mit vorhandenen nullable ON DELETE SET NULL-Bezügen im upload_audit_log. Bestehende andere Fremdschlüssel dürfen für einen Löschtest nicht abgeschwächt werden; Testdaten entsprechend bereinigen.

Keine automatische Löschung neuer Statusbelege vereinbart. Eine spätere Aufbewahrungsentscheidung muss Auditnachweis, personenbezogene Mitarbeiterkennung und Idempotenzfolgen berücksichtigen. Die vorgeschlagene organisatorische Prüfung nach 90 Tagen ist UNBESTÄTIGTER VORSCHLAG, keine gesetzliche oder technische Löschfrist. Bestehender öffentlicher lead_requests-Cleanup ist getrennt und wird nicht auf neue Tabellen übertragen.

## 10. UI und freigegebene visuelle Änderungen

Grundlayout: dunkle linke Navigation auf Laptop, kompakter Kopf auf Smartphone, ruhige Listen-/Detailbereiche, deutlich beschriftete Aktionen. Deutsch als interne Oberflächensprache; Kundenanfrage in Originalsprache. Zeitdarstellung Europe/Berlin, Belege intern UTC.

Verbindliche jüngste Änderungen:

1. Haupttitel „Anfragen“, nicht „Alles im Blick.“.
2. Smartphonekarten zeigen Eingangsdatum und Dateianzahl.
3. Smartphone-Kopf kompakter, redundante Kopfzeile entfällt.
4. Kleine graue Beschriftungen größer und dunkler.
5. Keine globalen Zähler ohne API. Verlauf nur aus tatsächlich verfügbaren Eingangs-/Auditbelegen, nicht aus erfundenen Dateiereignissen.
6. Ladefehler getrennt vom unklaren Ausgang einer Mutation. Exakter Text bei unklarem Ausgang: „Die Aktion konnte nicht bestätigt werden. Bitte laden Sie den aktuellen Stand.“ Kein falsches Versprechen, dass nichts gespeichert wurde. Bis zum Laden keine weitere Änderung anbieten.
7. Ablehnungsdialog: „Interne Entscheidung. Es wird keine Kunden-E-Mail versendet.“

Bedienung: Suche, Filter, Anfrage öffnen, Statuswechsel, Wiederöffnen, Dateiaktionen; Dialoge mit Abbrechen/Escape, Fokusführung, Pflichtgrund und verständlichen Meldungen. Kein Löschen von Eingaben bei vermeidbaren Fehlern. No-JavaScript-Hinweis ehrlich, keine scheinbar aktive Oberfläche. Statuskonflikt verlangt Aktualisieren, keine automatische Überschreibung. Netzwerk-Wiederholung verwendet dieselbe Request-ID.

Lokale Zustände: Übersicht, Details, Statusdialog, Freigabe, Ablehnung, Laden, Ladefehler, unbestätigte Änderung, Versionskonflikt, Sitzung abgelaufen, leere Suche. Keine erfundene Malwareprüfung und keine echten Downloads im Entwurf.

## 11. Lokaler Prototyp und Prüfstand

Autorisiert und erstellt außerhalb des Projekts:

`C:\Users\Director\Documents\Codex\2026-06-22\arbeite-am-projekt-c-users-director\outputs\internal-leads-design`

Enthält index.html, design.css, design.js, preview.mjs, design.test.mjs, README.md, screenshots.html und 22 Screenshots. Alle Daten synthetisch, Änderungen nur im Tab-Speicher, keine API-/D1-/R2-Verbindung. Server ausschließlich 127.0.0.1, explizite Datei-Allowlist, GET/HEAD, kein Directory Listing.

Ausgeführt in der bisherigen Sitzung: ein umfangreicher Browser-End-to-End-Test bestanden (1 Test, 0 Fehler); Laptop 1440 und Smartphone 390, zusätzliche 360/1280-Prüfung mit 200 % Textgröße; Aktionen, Pflichtgrund, Suche, Filter, Fehlerzustände, Portfreigabe und Serverabschaltung geprüft. Screenshots visuell kontrolliert. Das sind KEINE Produkt-, D1-, Pages-Routing- oder Cloudflare-Tests.

## 12. Abnahme, Werkzeuge und offene Voraussetzungen

Produktabnahme verlangt echte SQLite- und lokale D1-Transaktionen, echte Pages-Functions-Routingprüfung mit wrangler pages dev, Browserprüfung, bestehenden Gesamttest und Build. Direkte Handler-Tests im Test-Worker ersetzen das Routing nicht. Prüfmatrix: /internal, /internal/, CSS/JS, bekannte und unbekannte APIs, bestehende Dateirouten, Authfehler und öffentliche Seiten. Middleware muss wirklich angewendet werden.

Bestätigte Werkzeuge: Node 26.1.0, npm 11.13.0, node:sqlite/SQLite 3.53.0, gebündeltes Playwright, installiertes Chrome. Projektlokales Wrangler fehlt. Installation nicht freigegeben; noch keine D1-/Pages-Integration ausgeführt. Einzelheiten im Umsetzungsplan.

Nicht ausgeführt: Aufgaben 1–9 und 11–16 der Produktumsetzung, neue Migrationen, Produkt-Gesamttests/Build für diese Funktion, lokale D1-/Pages-Tests, geschützter Online-Test, Access-/Cloudflare-Konfiguration, Deployment. Aufgabe 10 ist als lokaler Entwurf erledigt; endgültige visuelle Benutzerabnahme der letzten Revision offen.

### Referenzquellen aus der bisherigen Planung

- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/best-practices/local-development/
- https://developers.cloudflare.com/pages/functions/local-development/
- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/functions/middleware/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

Quellen wurden bei der Planung verwendet; bei späterer Werkzeug-/Deploymentausführung gegen den dann tatsächlich installierten Stand prüfen. Diese Übergabe führt keine neue externe Konfigurationsprüfung durch.
