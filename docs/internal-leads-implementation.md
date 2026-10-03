# Interne Mitarbeiteroberfläche – vollständiger Umsetzungsplan

> Für die spätere Ausführung: superpowers:executing-plans, test-driven-development und verification-before-completion. Keine automatische Ausführung durch Lesen dieses Plans. Die Freigabe zur Produktimplementierung fehlt weiterhin. Benutzergrenzen gehen Skill-Vorschlägen zu Commits, Installation und Worktrees vor.

**Ziel:** Geschützte Mitarbeiterübersicht, Anfragedetails, nachvollziehbare Geschäftsstatusänderungen und sichere vorhandene Dateiaktionen.

**Architektur:** Statische interne UI mit Pages-Middleware; JWT-autorisierte Pages Functions; D1-erzwungene atomare Geschäftsstatusänderungen, Idempotenz und Datei-Review-Audits; privates vorhandenes R2.

**Technik:** JavaScript, HTML, CSS, Eleventy, Pages Functions, SQLite/D1, Node-Test-Runner, vorhandenes Playwright/Chrome. Wrangler für echte lokale D1-/Pages-Tests erst nach separater Werkzeugfreigabe.

**Spezifikation:** `C:\Users\Director\Documents\Codex\2026-06-22\arbeite-am-projekt-c-users-director\outputs\internal-leads-handoff\2026-09-25-internal-leads-design.md`.

Stand 25.09.2026. Dieser Plan übernimmt die bestehende 16-Aufgaben-Planung einschließlich BEIDER Nachträge: unabhängige Sperre bei unvollständiger 0006 und echter Pages-Routing-Test. Die jüngsten sieben visuellen Korrekturen sind in Aufgabe 10/11 verbindlich. Keine neue Planungsrunde.

## 1. Pfade und Git-Basis

```powershell
$P = 'C:\Users\Director\Documents\Italien Firma\oscnc'
$D = 'C:\Users\Director\Documents\Codex\2026-06-22\arbeite-am-projekt-c-users-director\outputs\internal-leads-design'
```

Alle Produktdateien mit `$P` sind zukünftige Ziele, KEINE in dieser Übergabe geänderten Dateien. Alle Entwurfsdateien liegen verbindlich unter `$D`, nicht in oscnc. Dies ersetzt ausdrücklich die früheren Pfade für Aufgabe 10.

Historisch per GitHub-API geprüft: master `23b1ee2547a3d828e33ece522c612d7e97a3d358`, Preview `d597c433b9f7bf36c7f527b1b9957142812b99df`, identischer Dateibaum `05fe610c52fafdddf3b4b916cbaf9ced155be780`. Upload/Access/Cleanup sind im genannten master enthalten. Nicht erneut aufgrund veralteter origin/master-Trackingdaten das Gegenteil behaupten.

Lokale lesende Übergabeprüfung: rfq-upload-preview, HEAD d597c433b9f7bf36c7f527b1b9957142812b99df, sauber. Keine Behauptung, der Remote sei seit der API-Prüfung unverändert. Vor Umsetzung Arbeitsbaum und freigegebene Ausgangsbasis lesen; kein eigenmächtiger Branchwechsel/Fetch/Merge.

## 2. Globale Grenzen

- Keine öffentliche Seite, Geschäftsangabe, CMS-Datei oder öffentliche Upload-Sicherheitsprüfung neu gestalten.
- Vorhandene Upload-URLs und JSON-Verträge erhalten.
- Keine neuen Kundenkonten, Rollenverwaltung, Kunden-E-Mails, Exporte, CRM-Funktionen oder Löschoberfläche.
- Keine öffentlichen R2-URLs oder echte Kundendaten in Tests.
- Geschäftsstatus strikt getrennt von technischem leads.status, storage_status und security_status.
- Keine Kundendaten/JWTs in Browser-Persistenz, keine interne Analytics.
- Keine automatische Löschung neuer Audit-/Requestbelege.
- Keine Installation, Remote-Migration, Cloudflare-Änderung oder Veröffentlichung ohne gesonderte Freigabe.
- Keine automatische Commit-Grenze aus Skills übernehmen: Commits/Pushes sind ausdrücklich NICHT freigegeben.
- Organisatorische Überprüfung nach 90 Tagen ist nur UNBESTÄTIGTER VORSCHLAG, keine Aufbewahrungs- oder Löschautomatik.
- Access-Abdeckung /internal/* einschließlich /internal ist UNGEPRÜFTE Deployment-Voraussetzung, kein Hindernis für lokale synthetische Tests.

## 3. Review-Fokus

1. Migration 0005 allein trotz versehentlich geöffnetem Gate (Aufgabe 4/5/13).
2. Wiederholung nach Lead-Löschung und historische Zustandsbelege (3/14).
3. Konkurrenz, ABA und gleiche Request-ID mit anderer Identität/Nutzlast (3/8/13).
4. Middleware für statische Dateien, slashlose und unbekannte Pfade (6/12).
5. Auditfehler darf keinen erfolgreichen Teilzustand erzeugen (3/5/9/13).

## 4. Tatsächliche Werkzeuge und noch nicht ausgeführte Befehle

Bestätigt in der alten Sitzung: Node v26.1.0; npm 11.13.0; node:sqlite funktioniert mit SQLite 3.53.0. Es wurde nur eine leere In-Memory-Versionabfrage ausgeführt, keine Produktmigration.

Vorhandenes Browsermodul und Browser:

```powershell
$env:OSMP_PLAYWRIGHT_MODULE = 'C:\Users\Director\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright\index.mjs'
$env:OSMP_BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
```

Helper lädt Playwright mit pathToFileURL()/import(); kein @playwright/test und kein Browserdownload notwendig. Diese Pfade vor späterer Ausführung erneut prüfen.

Projektlokales `node_modules/wrangler/bin/wrangler.js` fehlt. Globaler/Cache-Zugriff war teilweise gesperrt, deshalb nicht behaupten, nirgendwo sei Wrangler installiert. Neue Installation ausschließlich nach Freigabe:

```powershell
Set-Location -LiteralPath $P
npm install --save-dev --save-exact wrangler@4
node .\node_modules\wrangler\bin\wrangler.js --version
```

Aufgelöste konkrete Version im Lockfile festschreiben und dokumentieren. Nicht still über npx nachinstallieren. Erst dann gelten die folgenden lokalen CLI-Aufrufe als ausführbar. Ihre Kompatibilität mit der installierten Version ist noch NICHT getestet.

## 5. Arbeitsweise je Aufgabe

- [ ] Passenden fachlichen Test schreiben.
- [ ] Konkreten Testbefehl ausführen; erwarteten Fehler festhalten.
- [ ] Minimalen Code innerhalb genannter Dateien implementieren.
- [ ] Denselben Test grün ausführen.
- [ ] Betroffene bestehende Tests auf Regression prüfen.
- [ ] Diff prüfen und Ergebnis mit Zahlen dokumentieren.

Kein roter Test darf nur wegen Tippfehlern als fachlicher Nachweis gelten. Mocks ersetzen nicht die ausdrücklich geforderten SQLite-/D1-/Routing-/Browsertests. Fehlendes Werkzeug ist ein offener Pflichtnachweis, kein PASS. Keine Tests/Builds in dieser reinen Dokumentationsübergabe ausführen, die Produktdateien generieren.

## Aufgabe 1 – Echte SQLite-Fixtures

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\tests\helpers\internal-sqlite.mjs`, `$P\tests\internal-fixtures.mjs`, `$P\tests\internal-lead-status.test.mjs`.

**Schnittstellen:** openInternalTestDb({through}) → SQLite-DB; applyMigration(db,filename) → void; seedInternalFixtures(db) → synthetische IDs; closeInternalTestDb(db) → void.

- [ ] Red: Helper fehlt; Test erstellt leere isolierte SQLite-DB und verlangt foreign_keys=1.
- [ ] Implementieren mit node:sqlite, Migrationen lexikalisch bis `through`, keine produktive DB-Datei öffnen.
- [ ] Synthetische Firmen/Personen mit example.test-Adressen.

```javascript
const db = openInternalTestDb({ through: '0004' });
assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
closeInternalTestDb(db);
```

```powershell
node --test tests/internal-lead-status.test.mjs
```

**Abnahme:** isolierte wiederholbare DB, echte Fremdschlüssel, keine Ressourcen außerhalb des Testordners.

## Aufgabe 2 – Geschäftsstatus-, Request- und Auditmodell

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\migrations\0005_internal_lead_workflow.sql`, `$P\schema.sql`, `$P\tests\internal-lead-status.test.mjs`, `$P\tests\migration-schema.test.mjs`.

**Modell:** vollständige Feld-/Constraintliste in Spezifikation Abschnitt 7. Neue workflow_status/workflow_version; leads.status unverändert. lead_status_requests speichert expected/observed/target/result, actor und unveränderliche requested_lead_id. lead_status_audit speichert erwartete und tatsächliche Ausgangs-/Zielwerte. Nullable lead_id ON DELETE SET NULL, kein CASCADE. Keine neuen processing-Zustände in Statusrequests.

- [ ] Red: fehlende Tabellen/Spalten; unzulässige Status-/Versionskombinationen; fehlende Indizes; Auditverlust bei Löschung.
- [ ] Migration und vollständiges Referenzschema ergänzen.
- [ ] Vier erlaubte Übergänge und Ganzzahlgrenzen bis 9007199254740991 erzwingen.
- [ ] Erfolg 200/status_changed verlangt expected=observed und result_version=expected_version+1; 404 ohne beobachteten Zustand; 409 mit tatsächlichem Zustand ohne Ergebnisversion.
- [ ] Audit-Allowlist und nullable Paare prüfen, keine Kundendaten in Audit.
- [ ] Bekannte Geschäftsstatus vorsichtig übernehmen, technische alte Werte erhalten, sonst workflow_status=new.

```powershell
node --test tests/internal-lead-status.test.mjs tests/migration-schema.test.mjs
```

**Abnahme:** leere DB mit kompletter Migrationskette und Referenzschema fachlich gleich; echte SQLite-Constraints, nicht nur Regex.

## Aufgabe 3 – Atomare Statusänderung und Idempotenz

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\functions\internal\lead-workflow.mjs`, `$P\migrations\0005_internal_lead_workflow.sql`, `$P\tests\internal-lead-status.test.mjs`.

**Schnittstelle:** changeLeadStatus(db,{requestId,actorId,leadId,expectedStatus,expectedVersion,targetStatus,occurredAt}) → Promise eines neutralen HTTP-Ergebnisobjekts mit status/version oder Fehlercode.

Ein D1-batch aus drei Statements:

1. INSERT…SELECT Request mit 404/200/409 aus dem aktuellen Lead; ON CONFLICT(request_id) DO NOTHING.
2. INSERT denied/idempotency_conflict wenn vorhandene ID bei actor, requested_lead_id, expected_status, expected_version oder target_status abweicht. Aktuellen Versuch auditieren, Original nicht verändern.
3. SELECT gespeichertes Ergebnis ausschließlich bei vollständiger Vergleichsübereinstimmung; sonst 409 idempotency_conflict.

AFTER INSERT-Trigger aktualisiert nur bei response_code=200 bedingt auf erwarteten Status UND Version. changes() muss dann genau 1 sein, sonst RAISE(ABORT,'status_write_conflict'). Danach schreibt derselbe Trigger Audit-Snapshots. Fehlender Audit führt zum Batch-Rollback. Kein vorgelagerter nichtatomarer Leseentscheid.

```sql
UPDATE leads
SET workflow_status=NEW.target_status, workflow_version=workflow_version+1
WHERE NEW.response_code=200 AND id=NEW.lead_id
  AND workflow_status=NEW.expected_status
  AND workflow_version=NEW.expected_version;
SELECT CASE WHEN NEW.response_code=200 AND changes()<>1
  THEN RAISE(ABORT,'status_write_conflict') END;
```

- [ ] Red: gleiche ID zweimal erzeugt heute keinen vereinbarten Beleg; Tests verlangen genau einen Übergang/Erfolgs-Audit.
- [ ] Gleiche ID/anderer Benutzer oder Inhalt → 409 plus Konfliktaudit, Original unverändert.
- [ ] Verschiedene IDs/gleiche Ausgangsversion → ein Erfolg/ein Konflikt.
- [ ] Gleiche ID gleichzeitig → gleiche ursprüngliche Antwort, nur ein Erfolg.
- [ ] ABA: Status kehrt zurück, aber alte Version bleibt abgewiesen.
- [ ] Auditfehler → weder geänderter Lead noch Request-Erfolg.
- [ ] Nach Lead-Löschung historischer Replay, keine Wiederanlage; Autorisierung bleibt Pflicht.

```powershell
node --test tests/internal-lead-status.test.mjs
```

**Abnahme:** SQLite-Transaktionen grün; echte D1-Konkurrenz separat Aufgabe 13. Kein unbestätigter processing-/Antwortcache-Zustand.

## Aufgabe 4 – Unabhängige Migrationssperre

**Status:** nicht umgesetzt/nicht ausgeführt. Enthält ersten Sicherheitsnachtrag.

**Dateien:** `$P\migrations\0005_internal_lead_workflow.sql`, `$P\schema.sql`, `$P\tests\internal-review-gate.test.mjs`.

0005 ergänzt internal_review_control (Singleton id=1, enabled Default 0, protocol_version=2, changed_at) und lead_uploads.review_request_id. Protokoll-Guard: offenes Gate, Version 2 und frische nicht leere Review-ID. Das allein beweist NICHT 0006-Vollständigkeit.

Zusätzlicher unabhängiger Sperrtrigger:

```sql
CREATE TRIGGER upload_review_migration_block
BEFORE UPDATE OF security_status ON lead_uploads
WHEN NEW.security_status IS NOT OLD.security_status
BEGIN
  SELECT RAISE(ABORT, 'review_unavailable');
END;
```

- [ ] Red: nur Migrationen bis 0005 anwenden; stored/quarantine-Upload anlegen; Gate absichtlich enabled=1; frische Review-ID und korrekte Mitarbeiterdaten verwenden.
- [ ] Freigabe UND Ablehnung müssen trotz geöffnetem Gate fehlschlagen; Status bleibt quarantine, kein Erfolgs-Audit.
- [ ] Speicherstatus-only-Änderung durch Cleanup bleibt möglich.
- [ ] Alte Review-SQL ohne neue ID bleibt auch nach späterer Wiederöffnung unzulässig.

```javascript
db.exec('UPDATE internal_review_control SET enabled=1 WHERE id=1');
assert.throws(() => attemptValidApprovalWithFreshReviewId(db), /review_unavailable/);
assert.equal(readUpload(db).security_status, 'quarantine');
assert.equal(countSuccessfulReviewAudits(db), 0);
```

Diese drei Helpers sind lokale Fixturefunktionen der Testdatei, keine Produkt-APIs.

```powershell
node --test tests/internal-review-gate.test.mjs
```

## Aufgabe 5 – 0006, Status-Guard und atomarer Datei-Audit

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\migrations\0006_upload_review_audit.sql`, `$P\functions\upload\employee-route.mjs`, `$P\functions\upload\state.mjs`, `$P\schema.sql`, `$P\tests\internal-review-gate.test.mjs`, `$P\tests\upload-state.test.mjs`, `$P\tests\upload-download.test.mjs`.

**Schnittstellen:** allowedUploadActions(upload) → Liste erlaubter Aktionen; validateRejectionReason(value) → normalisierter Grund oder neutraler Validierungsfehler. Bestehende Routen bleiben.

0006-Reihenfolge verbindlich:

1. Gate schließen.
2. Fachlichen Review-Guard installieren.
3. AFTER UPDATE-Erfolgs-Audit-Trigger installieren.
4. LETZTES Statement: `DROP TRIGGER upload_review_migration_block;` ohne IF EXISTS.

Fachlicher Guard: OLD und NEW storage_status=stored; OLD security_status=quarantine; NEW approved/rejected; reviewed_by/reviewed_at gesetzt; rejected mit gültigem begrenztem Grund, approved mit NULL-Grund. Unicode-Prüfung ergänzend im Handler. Erfolg in bestehendes upload_audit_log; separaten Erfolgs-Audit des Handlers entfernen, denied-Audit behalten. Neue serverseitige UUID pro Reviewversuch, kein neuer Clientvertrag.

- [ ] Red: Matrix aus Spezifikation; direkte API darf nicht umgehen; ungültiger Grund verändert nichts.
- [ ] Ein Erfolg genau ein Audit; Auditfehler rollt Status und Reviewfelder zurück.
- [ ] Alle vollständigen Statement-Präfixe von 0006 vor DROP gesperrt.
- [ ] Fehler beim Erstellen eines Pflicht-Triggers darf abschließenden DROP nicht erreichen.
- [ ] Executor muss beim ersten Fehler abbrechen; echte lokale D1-Verifikation in Aufgabe 13 erforderlich.
- [ ] Fehlendes Schema/geschlossenes Gate → neutral 503, fachlicher Konflikt → 409 invalid_state mit denied-Audit.
- [ ] Vollständige 0006 lässt Gate geschlossen; Öffnung erst eigener Betriebsschritt.

```powershell
node --test tests/internal-review-gate.test.mjs tests/upload-state.test.mjs tests/upload-download.test.mjs
```

**Garantie:** 0005 allein und unvollständiges 0006-Präfix bleiben geschlossen, auch bei irrtümlichem enabled=1. Kein Schutzversprechen gegen spätere privilegierte Schema-Manipulation. Triggernamen/Versionsflag sind kein Ersatz für funktionale Tests.

## Aufgabe 6 – Sicherheitshelfer und interne Middleware

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\functions\internal\security.mjs`, `$P\functions\internal\_middleware.js`, `$P\functions\internal\access-jwt.mjs`, `$P\tests\internal-security.test.mjs`, `$P\tests\access-jwt.test.mjs`.

**Schnittstellen:** requireInternalActor(request,env) → verifizierter Actor; requireInternalMutationOrigin(request,env) → void/Fehler; parseLeadId(value) → sichere positive Ganzzahl; parseUploadId(value) → UUID; readInternalJson(request,{maxBytes:4096}) → geprüftes Objekt; withInternalHeaders(response) → Response.

- [ ] Red: fehlende/falsche Signatur, Audience, Issuer, exp/nbf, Subject; falscher Origin; JWKS-Timeout; fehlende Runtime-Werte.
- [ ] RS256/JWKS tatsächlich prüfen, drei Sekunden Abruflimit, strict sub statt E-Mail-Fallback, sichere Team-Domain-Normalisierung.
- [ ] Bodygrenze nach echten Bytes, UTF-8/JSON/Content-Type/Methoden validieren.
- [ ] Header auch auf Fehlerantworten; kein fremdes CORS, kein öffentliches Script/Analytics.
- [ ] Middleware schützt statische/Unknown-Pfade; Handlerchecks bleiben bei direkten Aufrufen aktiv.
- [ ] Keine Kundendetails vor Autorisierung zum Anreichern eines Sicherheits-Audits lesen.

```powershell
node --test tests/internal-security.test.mjs tests/access-jwt.test.mjs
```

## Aufgabe 7 – Übersicht und Detail-API

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\functions\internal\leads-api.mjs`, `$P\functions\internal\api\leads\index.js`, `$P\functions\internal\api\leads\[leadId]\index.js`, `$P\tests\internal-leads-api.test.mjs`.

**Schnittstellen:** listLeads(db,{page,status,query}) → Promise<{items,page,has_more}>; getLeadDetails(db,leadId) → Promise<Detail oder nicht gefunden>.

- [ ] Red: Filter/Suche/Sortierung, 25er-Seite mit 26er-Abfrage, Grenzen 1–10000, q≤100 Codepoints, unbekannte/doppelte Parameter.
- [ ] Suche Firma/Name/E-Mail, gebundene Werte und LIKE-Escaping.
- [ ] Details mit erlaubten Metadaten/allowed_actions, ohne R2-Schlüssel, ai_analysis oder Secrets.
- [ ] Keine N+1-Abfrage für Dateizählung, keine globalen Gesamt-/Statuszähler erfinden.
- [ ] Verlauf nur anhand real verfügbarer created_at-/Audit-Belege; keine historische Rekonstruktion aus aktuellem Status. Auslieferung von Statusereignissen bei Anbindung der Detailansicht explizit testen.

```powershell
node --test tests/internal-leads-api.test.mjs
```

## Aufgabe 8 – Status-API anbinden

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\functions\internal\api\leads\[leadId]\status.js`, `$P\tests\internal-leads-api.test.mjs`, `$P\tests\internal-lead-status.test.mjs`.

- [ ] Red: Actor darf nicht aus Body kommen; fehlende/ungültige Ausgangsversion; unzulässiger Übergang; Replay/Konflikt/Auditfehler.
- [ ] Handler verwendet Sicherheitshelfer und ausschließlich changeLeadStatus für Mutation.
- [ ] Neue Antwort `{ok:true,status,version}` oder `{ok:false,error}`; gespeichertes Ergebnis maßgeblich, keine internen Ausnahmen ausgeben.

```powershell
node --test tests/internal-leads-api.test.mjs tests/internal-lead-status.test.mjs
```

## Aufgabe 9 – Vorhandene Datei-Endpunkte sichern

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\functions\upload\employee-route.mjs`, `$P\tests\upload-download.test.mjs`, `$P\tests\upload-routes.test.mjs`, `$P\tests\internal-security.test.mjs`. Nur nötige Anpassungen an vorhandenen Wrappern:

- `$P\functions\internal\leads\[leadId]\uploads\[uploadId]\index.js`
- `$P\functions\internal\leads\[leadId]\uploads\[uploadId]\approve.js`
- `$P\functions\internal\leads\[leadId]\uploads\[uploadId]\reject.js`

- [ ] Red: stored+quarantine/approved/rejected korrekt; pending/failed/deleted/delete_pending verweigert; keine erneute Freigabe/Ablehnung nach abgeschlossenem Review.
- [ ] Abgelehnte Datei nur Mitarbeiterdownload mit Warnhinweis.
- [ ] Attachment/no-store/nosniff, Dateiname ohne Headerinjection, kein öffentlicher Link.
- [ ] Status erneut vor Ausgabe prüfen, Pflicht-Audit vor Streaming; Auditfehler verhindert Download.
- [ ] Fehlendes R2-Objekt neutral; Audit nicht als Beweis vollständig heruntergeladener Bytes darstellen.

```powershell
node --test tests/upload-download.test.mjs tests/upload-routes.test.mjs tests/internal-security.test.mjs
```

## Aufgabe 10 – Lokaler visueller Entwurf VOR produktiver UI

**Status:** LOKAL UMGESETZT UND GETESTET. Nicht neu erstellen. Letzte visuelle Revision noch nicht ausdrücklich abschließend abgenommen.

Autorisiertes Ziel ausschließlich `$D`. Vorhanden:

- `$D\index.html`
- `$D\design.css`
- `$D\design.js`
- `$D\preview.mjs`
- `$D\design.test.mjs`
- `$D\README.md`
- `$D\screenshots.html`
- `$D\screenshots\` mit 22 PNGs

Alle Hilfen liegen im Entwurfsordner. Keine Verbindung zur Produkt-API, keine persistierten Kundendaten, keine echten Downloads. Node-Server liefert nur HTML/CSS/JS über 127.0.0.1, GET/HEAD, kein Listing/Traversal. Seite kann synthetische Mutationen ausführen, Reload setzt zurück.

Vorhandene Ansichten: Übersicht, Detail, Statuswechsel/Wiederöffnen, Freigabe, Ablehnung, Laden, Ladefehler, unbestätigte Mutation, Versionskonflikt, Sitzung abgelaufen, keine Treffer.

Jüngste Korrekturen NICHT zurücknehmen:

1. Titel „Anfragen“.
2. Smartphonekarten mit Eingangsdatum und Dateianzahl.
3. Kompakter Smartphone-Kopf.
4. Kleine graue Beschriftungen größer/dunkler.
5. Keine globalen Zähler; Verlauf nur Eingang und explizite Statusereignisse.
6. Unklarer Ausgang: „Die Aktion konnte nicht bestätigt werden. Bitte laden Sie den aktuellen Stand.“; Mutationen bis Aktualisierung deaktiviert, keine Behauptung „nichts gespeichert“.
7. Ablehnung: „Interne Entscheidung. Es wird keine Kunden-E-Mail versendet.“

```powershell
node "$D\preview.mjs" --port 8794
# Browser: http://127.0.0.1:8794/ ; Beenden mit Strg+C
node --test "$D\design.test.mjs"
```

Vorher dokumentierter Red-Test: fehlende Entwurfsdateien; Revision-Red: alter H1 „Alles im Blick.“ statt „Anfragen“. Letzter Green: 1 umfangreicher Browser-E2E-Test, 0 Fehler. 1440x1000 und 390x844 Screenshots, zusätzliche 360/1280-Breiten mit 200 % Textgröße. Dialoge als Viewportbilder, übrige Ansichten fullPage. Eigener Testserver/Browser werden beendet und Portfreigabe geprüft. Keine Produkt-/D1-/Pages-Abnahme daraus ableiten.

**Freigabegrenze:** produktive UI erst nach ausdrücklicher Freigabe der aktuellen Gestaltung UND Produktimplementierung. Prototyp ist Referenz, kein zu kopierendes Backend; globale demo.innerHTML-/Fixturelogik nicht ungeprüft in Kundendaten-UI übernehmen.

## Aufgabe 11 – Produktive UI nach visueller Freigabe

**Status:** NICHT begonnen.

**Dateien:** `$P\internal\index.html`, `$P\internal\internal.css`, `$P\internal\internal.js`, `$P\tests\internal-ui.test.mjs`, `$P\tests\browser\internal-ui.browser.test.mjs`, `$P\tests\helpers\internal-browser.mjs`, bei Bedarf `$P\tests\helpers\internal-test-server.mjs`.

**Schnittstelle:** createInternalApp({root,fetchImpl,uuid}) → UI-Controller mit entfernbaren Eventbindungen für Tests.

- [ ] Red: sichtbare Erfolg/Fehler/Konfliktzustände, Fokus, Tastaturdialog/Escape, XSS-Testtexte, verbotene Aktionen, 25er-Seite.
- [ ] Kundendaten sichere DOM-Ausgabe; keine Browser-Persistenz/Analytics.
- [ ] Neue ID nur für neue Aktion; unklarer Ausgang dieselbe ID bei gezieltem Replay. Kein blindes Überschreiben nach 409.
- [ ] Status-/Reviewdialoge exakt nach freigegebenem Entwurf; Ablehnungsgrund bewahren und validieren.
- [ ] Unklarer Ausgang und Ladefehler getrennt, bis Aktualisierung keine neue Mutation.
- [ ] Aufruf/Detailöffnung ändert keinen Status. No-JavaScript ehrlich.
- [ ] Keine erfundenen Zähler/Verlaufsereignisse; tatsächlich gelieferte API-Felder verwenden.

```powershell
node --test tests/internal-ui.test.mjs
node --test tests/browser/internal-ui.browser.test.mjs
```

## Aufgabe 12 – Build und echter Pages-Routing-Nachweis

**Status:** nicht umgesetzt/nicht ausgeführt. Enthält zweiten Sicherheitsnachtrag.

**Dateien:** `$P\_routes.json`, `$P\_headers`, `$P\eleventy.config.mjs`, `$P\functions\internal\api\[[path]].js`, `$P\tests\internal-build.test.mjs`, `$P\tests\integration\internal-pages-routing.test.mjs`, `$P\scripts\test-internal-pages.mjs`.

- [ ] Red: derzeit umfasst _routes.json nur /api/leads und /internal/leads/*; UI, statische Dateien und neue APIs fehlen.
- [ ] /internal UND /internal/* in Funktionsabdeckung aufnehmen, keine ungeschützte Ausnahme für CSS/JS.
- [ ] Build kopiert produktive interne UI, nicht Prototyp/Screenshots/Fixtures/Tests.
- [ ] Unbekannte interne API nach Autorisierung JSON-404, kein HTML-/SPA-Fallback.

### Tatsächliches Routing testen

Isolierte lokale Testkopie mit echtem Functions-Dateibaum, tatsächlich gebauter _routes.json und Assets. `wrangler pages dev`, KEIN manuell geschriebener Router. Echte HTTP-Anfragen. Eigener freier Port, nur 127.0.0.1, lokale Bindings und synthetische Daten. Test-JWT echt signiert; nur JWKS-Transport darf im isolierten Harness auf lokale Testschlüsselversorgung umgeleitet werden, keine Ersetzung der Autorisierung durch ok:true.

| Pfad | Ohne verifizierte Berechtigung | Berechtigt |
|---|---|---|
| /internal | keine internen Inhalte, Redirectziel geschützt | geschützter Übergang/Übersicht |
| /internal/ | abgewiesen | 200 |
| interne CSS/JS | abgewiesen | 200 |
| bekannte Lead-APIs | abgewiesen | Vertragsantwort |
| bestehende Datei-Endpunkte | abgewiesen | Matrix/Methodenvertrag |
| unbekannte interne API | Authprüfung zuerst | JSON-404 |
| unbekannte interne Datei | kein interner Inhalt | 404 |
| öffentliche Start-/Kontaktseite | öffentlich | öffentlich |

Redirects ohne automatisches Folgen und anschließend Ziel prüfen. GET/HEAD/nicht erlaubte Methoden, invalid/expired JWT, nicht erlaubtes Subject, no-store/noindex/CSP auf Fehlern, keine fachliche D1/R2-Nutzung vor Berechtigung. Middleware muss tatsächlich ausgelöst werden, nicht nur importiert sein.

```powershell
node --test tests/internal-build.test.mjs
node scripts/test-internal-pages.mjs
```

Der Harness startet die lokale installierte Wrangler-CLI mit `pages dev` und dem Assetordner; seine konkrete temporäre Konfiguration enthält ausschließlich lokale Ressourcen. Aktuelle CLI-Flags nach Werkzeugfreigabe gegen installierte Version prüfen. Fehlendes Wrangler bleibt offener Pflichtnachweis; nicht überspringen. Direkte Handler-Tests aus Aufgabe 13 ersetzen diesen Test ausdrücklich NICHT.

## Aufgabe 13 – Echte lokale D1-Integration

**Status:** nicht umgesetzt/nicht ausgeführt; Werkzeugfreigabe offen.

**Dateien:** `$P\tests\fixtures\internal\worker.mjs`, `$P\tests\fixtures\internal\wrangler.jsonc`, `$P\tests\fixtures\internal\seed.sql`, `$P\tests\integration\internal-d1.test.mjs`, `$P\scripts\test-internal-d1.mjs`.

Nur lokale Testkonfiguration:

```json
{
  "name": "internal-leads-local-tests",
  "main": "worker.mjs",
  "compatibility_date": "2026-09-25",
  "workers_dev": false,
  "d1_databases": [{
    "binding": "DB",
    "database_name": "internal-leads-local",
    "database_id": "00000000-0000-0000-0000-000000000001",
    "migrations_dir": "../../../migrations"
  }],
  "r2_buckets": [{"binding":"RFQ_UPLOADS","bucket_name":"internal-leads-local-private"}]
}
```

Die UUID ist ausdrücklich synthetischer lokaler Testwert, keine behauptete Cloudflare-ID. Nicht remote verwenden/deployen.

Nach Werkzeugfreigabe:

```powershell
Set-Location -LiteralPath $P
node .\node_modules\wrangler\bin\wrangler.js d1 migrations apply internal-leads-local --local --config tests/fixtures/internal/wrangler.jsonc --persist-to .tmp/internal-d1
node .\node_modules\wrangler\bin\wrangler.js d1 execute internal-leads-local --local --config tests/fixtures/internal/wrangler.jsonc --persist-to .tmp/internal-d1 --file tests/fixtures/internal/seed.sql
node .\node_modules\wrangler\bin\wrangler.js dev --config tests/fixtures/internal/wrangler.jsonc --local --ip 127.0.0.1 --port 8795 --local-protocol https --persist-to .tmp/internal-d1
```

Automatisierter Ablauf `node scripts/test-internal-d1.mjs` verwendet eindeutige temporäre Unterordner/freie Ports, beendet nur eigene Prozesse und prüft Portfreigabe. Kein --remote, kein Zugriff auf Produktionsfixtures. Server nur für lokale Fixture-APIs; keine Behauptung eines Pages-Routing-Tests.

- [ ] D1-batch Rollback bei Trigger-/Auditfehler.
- [ ] Gleichzeitige gleiche IDs und unterschiedliche IDs auf gleicher Ausgangsversion.
- [ ] Idempotenzkonflikt und Replay nach Lead-Löschung.
- [ ] 0005 allein, irrtümlich offenes Gate, unvollständige 0006, Fehler während 0006.
- [ ] Executor stoppt vor abschließendem DROP bei Fehler; falls das nicht gilt, keine Freigabe, konkrete Korrektur vor Fortsetzung verlangen.
- [ ] Alte Review-SQL bleibt nach Öffnung gesperrt.

## Aufgabe 14 – Zustands-/Versionsnachweise und Aufbewahrung

**Status:** nicht umgesetzt/nicht ausgeführt.

**Dateien:** `$P\tests\internal-lead-status.test.mjs`, `$P\tests\integration\internal-d1.test.mjs`, `$P\docs\internal-leads-rollout.md`.

Belegabfrage:

```sql
SELECT r.request_id, r.requested_lead_id,
 r.expected_status, r.expected_version,
 r.observed_status, r.observed_version,
 r.target_status, r.result_version, r.response_code,
 a.from_status, a.from_version, a.to_status, a.to_version,
 a.result, a.detail_code
FROM lead_status_requests r
JOIN lead_status_audit a ON a.request_id=r.request_id AND a.result='success'
WHERE r.request_id=?;
```

- [ ] Red/Green: expected=observed=from, target=to, result_version=to_version=from_version+1.
- [ ] Konflikt ohne Erfolgsbeleg/Zielversion, aber mit erwartetem und tatsächlichem Zustand.
- [ ] Lead später verändern: historische Belege unverändert.
- [ ] Lead löschen: nullable FK wird NULL, requested_lead_id und Belege bleiben; keine bestehenden anderen FKs abschwächen.
- [ ] Kein neuer Cleanup, keine erfundene gesetzliche Frist; 90-Tage-Organisationsprüfung nur VORSCHLAG, unbestätigt.

```powershell
node --test tests/internal-lead-status.test.mjs
node scripts/test-internal-d1.mjs
```

## Aufgabe 15 – Umstellungs- und Rückfallanleitung

**Status:** Dokumentation noch nicht im Produkt vorhanden; alle operativen Schritte NICHT ausgeführt/nicht freigegeben.

**Datei:** `$P\docs\internal-leads-rollout.md`.

Vor Online-Test getrennte Nachweise/Freigaben: Access für /internal und /internal/* auf verwendeten Hosts, Audience/Team/Subject, isolierte Preview-D1/R2, Sicherung/Wiederherstellungsweg, kompatibler Code, Migrationsprüfungen, kein versehentliches automatisches Produktionsdeployment.

Reihenfolge nach gesonderter Freigabe:

1. Kompatibler Code, der ohne vollständiges Schema fail-closed bleibt.
2. 0005 anwenden: Datenbank-Sperre aktiv.
3. Geschlossenes Gate und wirkliche Sperre nachweisen.
4. 0006 vollständig anwenden; keine Fortsetzung nach SQL-Fehler.
5. Funktionale Status-/Audit-/Rollbackprüfung, alte SQL blockiert.
6. Noch geschlossenes Gate bestätigen.
7. Erst gesondert freigegeben öffnen:

```sql
UPDATE internal_review_control
SET enabled=1, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1 AND enabled=0 AND protocol_version=2;
```

8. Geänderte Zeilenzahl prüfen; synthetischer Review mit genau einem Erfolgs-Audit.
9. Neue UI separat aktivieren.

Die UPDATE-Anweisung alleine prüft NICHT die Vollständigkeit von 0006. Vorherige Funktionsprüfungen sind Pflicht. Öffnung nicht automatisch Bestandteil der Migration.

Rückfall:

```sql
UPDATE internal_review_control
SET enabled=0, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1;
```

Danach UI deaktivieren, Access erhalten, additive Tabellen/Spalten/Trigger/Audits behalten. Nur schemakompatible Anwendungsversion verwenden. Falls keine kompatible Version verfügbar: Review geschlossen lassen. Keine Sicherheitsrücknahme durch Entfernen von Guards/Audittabellen oder Wiederzulassen alter SQL. Vor Sperrinstallation abgeschlossene Aktionen bleiben historische Vorgänge; keine erfundenen rückwirkenden Audits.

## Aufgabe 16 – Gesamtabnahme

**Status:** NICHT ausgeführt. Kein Produkt-PASS aus Prototyp-Test ableiten.

Nach Implementierungs- und Werkzeugfreigabe:

```powershell
Set-Location -LiteralPath $P
node --test tests/internal-security.test.mjs
node --test tests/internal-leads-api.test.mjs
node --test tests/internal-lead-status.test.mjs
node --test tests/internal-review-gate.test.mjs
node --test tests/internal-ui.test.mjs
node --test tests/internal-build.test.mjs
node --test tests/access-jwt.test.mjs
node --test tests/upload-download.test.mjs tests/upload-state.test.mjs tests/upload-routes.test.mjs tests/migration-schema.test.mjs
node --test "$D\design.test.mjs"
node --test tests/browser/internal-ui.browser.test.mjs
node scripts/test-internal-d1.mjs
node scripts/test-internal-pages.mjs
npm test
npm run build
git diff --check
git status --short --branch
```

Zusätzlich echte Build-Ausgabe prüfen: interne UI enthalten, Prototyp/Screenshots/Fixtures/Secrets nicht enthalten, öffentliche Seiten unverändert, keine lokalen Testprozesse/Ports zurückgelassen, Diff nur freigegebener Umfang.

**Abschlussbericht:** Red-Green pro Aufgabe, genaue Testzahlen, tatsächlich ausgeführte Befehle, ungeprüfte Fälle separat, geänderte Dateien, Gate-/Rollbackbefunde, Git-Status. Kein Commit/Push/Deployment ohne neue ausdrückliche Freigabe.

## 6. Offene Voraussetzungen und nächster Schritt

- Produktimplementierung nicht freigegeben; nur Übergabe jetzt autorisiert.
- Endgültige Benutzerabnahme der zuletzt korrigierten Prototyp-Screenshots nicht dokumentiert.
- Wrangler-Verfügbarkeit/Installation für lokale D1-/Pages-Tests offen, nicht heimlich installieren.
- Access /internal/* und /internal einschließlich www/Preview ungeprüft.
- Reale Preview-/Produktionswerte und Online-/Migrationsfreigabe getrennt bestätigen; keine Werte erfinden.
- 90-Tage-Vorschlag nicht bestätigt.
- Echte SQLite-/D1-/Pages-/Produktbrowser-Tests für neue Funktion noch ausstehend; SQL/Trigger sind Entwurf.

Neue Sitzung liest zuerst HANDOFF.md, Spezifikation und diesen Plan. Danach nur aktuellen Projektstand/Schreibgrenzen lesend prüfen, Übergabe bestätigen und auf konkrete nächste Implementierungsfreigabe warten. Keine neue Architekturabfrage und Aufgabe 10 nicht erneut bauen. Nach gesonderter Umsetzungsfreigabe mit Aufgabe 1 beginnen; bei produktiver UI gilt zusätzlich die visuelle Freigabegrenze.

## 7. Konsistenzprüfung dieser Fassung

Beide Sicherheitsnachträge enthalten (Aufgaben 4/5/13 und 12). Kein processing ohne Modell. expected/observed/from/to/version-Felder entsprechen der Spezifikation. Gate bleibt nach 0006 geschlossen. Local D1 und tatsächliches Pages-Routing getrennt. Prototyp-Pfade außerhalb oscnc verbindlich. Aktuelle visuelle Korrekturen enthalten. Keine organisatorische 90-Tage-Frist als bestätigt dargestellt. Installation/Cloudflare/Deployment nicht still freigegeben. Noch nicht ausgeführte Tests klar gekennzeichnet.
