# Interne Leads – lokaler Rollout- und Rückfallnachweis

Stand: 05.10.2026. Dieses Protokoll trennt vorbereitete Rollout-Schritte von den tatsächlich belegten Preview-Nachweisen. Produktion, Cloudflare-Access-Konfiguration, Commits und Pushes wurden nicht verändert.

## Vor Online-Test getrennt freigeben

- Cloudflare Access für `/internal` und `/internal/*` auf Apex, `www` und dem tatsächlich verwendeten Preview-Host.
- Team-Domain, Audience und ausschließlich bestätigte Mitarbeiter-Subjects.
- Isolierte Preview-D1-/R2-Bindings, Sicherung und Wiederherstellungsweg.
- Kompatibler Code, lokale Migrations- und Routingnachweise, kein unbeabsichtigtes Produktionsdeployment.

## Reihenfolge

1. Produktions-Backup und lesende Ausgangsprüfung von Ledger und vollständigem Schema durchführen.
2. Die Baseline 0001–0004 einmalig erfassen; das Review-Gate bleibt geschlossen.
3. Ledger exakt bestätigen und ausschließlich 0005/0006 anwenden.
4. Vollständiges Schema, Trigger und geschlossenes Gate prüfen. Bei jedem Fehler Ledger und Schema lesen; nicht blind wiederholen.
5. Den geprüften Release-Code deployen und danach Access-Schutz sowie alle internen Pfade prüfen.
6. `INTERNAL_UI_ENABLED` erst nach ausdrücklicher Freigabe auf `1` setzen.
7. Erst danach die funktionale Live-Abnahme durchführen. Das Review-Gate bleibt während der gesamten Vorbereitung geschlossen.

Die frühere Aktivierungsreihenfolge mit einer vorgezogenen Codebereitstellung ist damit ersetzt. Die Review-Gate-Öffnung bleibt ein separat freizugebender Ausnahmevorgang und gehört nicht zur Produktionsaktivierung.

Für einen ausdrücklich freigegebenen Test gilt weiterhin:

```sql
UPDATE internal_review_control
SET enabled=1, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1 AND enabled=0 AND protocol_version=2;
```

Nach einem solchen Test ist das Gate wieder zu schließen und lesend zu bestätigen:

```sql
UPDATE internal_review_control
SET enabled=0, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1 AND protocol_version=2;
```

Die UPDATE-Anweisung allein beweist nicht die Vollständigkeit von 0006. Sie ist kein automatischer Bestandteil der Migration.

## Rückfall

```sql
UPDATE internal_review_control
SET enabled=0, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1;
```

Danach UI deaktivieren, Access erhalten und additive Tabellen/Spalten/Trigger/Audits beibehalten. Keine alten Review-SQLs wieder zulassen und keine historischen Audits erfinden. Falls keine kompatible Anwendungsversion vorhanden ist, bleibt das Review-Gate geschlossen.

## Aktueller Nachweis

- Lokale SQLite-, D1- und Pages-Routingtests wurden ausgeführt.
- Preview-Deployment `ed772bae-34d3-4cfb-b8b0-77ae9eefd362` auf dem Branch `rfq-upload-preview` wurde veröffentlicht.
- Unangemeldete Preview-Aufrufe von `/internal`, `/internal/`, `/internal/internal.css` und `/internal/api/leads` lieferten jeweils `302`; interne Inhalte wurden nicht ausgegeben.
- Das Preview-Review-Gate wurde für die manuelle Abnahme kontrolliert geöffnet und anschließend geschlossen. Der abschließende Zustand ist `enabled=0`, `protocol_version=2`, `changed_at=2026-10-03T22:04:22.122Z`.
- Preview-D1-Nachweis nach der Abnahme: Lead 4 ist `stored + approved`; Lead 5 ist `stored + rejected` mit der Begründung `OSMP manueller Ablehnungstest`.
- Für beide Uploads wurde jeweils genau ein passender Review-Erfolgs-Audit und separat genau ein `upload_stored/success/stored` nachgewiesen.
- Die Browserbeobachtung bestätigt die sichtbaren Zustände „Freigegeben“ und „Abgelehnt“. Ein separater HTTP-200-Nachweis der manuellen POST-Aktionen wurde nicht aufgezeichnet und wird nicht behauptet.
- Erneuter aktueller anonymer Hostnachlauf vom 04.10.2026: Auf `rfq-upload-preview.osmechplast.pages.dev`, `ed772bae.osmechplast.pages.dev`, `osmechplast.com` und `www.osmechplast.com` lieferten `/internal`, `/internal/`, `/internal/internal.css`, `/internal/internal.js` und `/internal/api/leads` jeweils `302` ohne Redirect-Following. Alle Ziele lagen auf `misty-bonus-5d3c.cloudflareaccess.com` mit dem jeweiligen `/cdn-cgi/access/login/<host>`-Pfad; Queryparameter wurden nicht dokumentiert.
- Die anonymen Redirect-Bodies enthielten bei keinem der 20 Aufrufe interne UI- oder Datenmarker; es wurden keine internen Inhalte oder Daten ausgeliefert. Diese Prüfung belegt Access-Umleitung für den geprüften Host-/Pfadumfang, nicht automatisch jeden möglichen alternativen Zugangsweg.
- Es gibt keine automatische Löschung der neuen Audit-/Requestbelege; die 90-Tage-Prüfung bleibt ein unbestätigter organisatorischer Vorschlag.

## Schritt 2 – Abgleich der Preview-Abnahmekriterien

| Kriterium | Vorhandener Nachweis | Bewertung |
|---|---|---|
| Anmeldung und Mitarbeiterberechtigung | Unangemeldete Zugriffe auf alle 20 geprüften Host-/Pfadkombinationen wurden zu Cloudflare Access umgeleitet. Die authentifizierte Browserabnahme zeigte die Mitarbeiteroberfläche; die Review-Datensätze enthalten ausgefüllte Bearbeiterfelder. | Funktional belegt im geprüften Preview-Umfang; die manuellen Review-POSTs haben keinen separat aufgezeichneten HTTP-Status. |
| Übersicht, Details, Suche und Filter | Echte Pages-/D1-/R2-Integration sowie manuelle Preview-Browserbeobachtung; Übersicht, Detailansicht, Suche und Statusfilter wurden benutzt. | Belegt; keine Wiederholung erforderlich. |
| Statusänderung und Speicherung | Browserbeobachtung mit Verlauf und Neuladen; bestehende echte Backend-/Browsernachweise prüfen die Statuspersistenz. | Belegt; kein neuer HTTP-Nachweis wird daraus abgeleitet. |
| Dateidownload | Manuell geöffnete PDF mit Warnhinweis sowie bestehende echte R2-/Browsernachweise für Dateiname und Inhalt. | Belegt; kein erneuter Downloadtest erforderlich. |
| Freigabe und Ablehnung mit Review-Feldern und Audit | Preview-D1: Lead 4 `stored + approved`, ausgefüllte Review-Felder, genau ein `file_approved/success/approved`; Lead 5 `stored + rejected`, ausgefüllte Review-Felder, dokumentierte Begründung, genau ein `file_rejected/success/rejected`. Je Upload zusätzlich genau ein separates `upload_stored/success/stored`. | Datenbankseitig vollständig belegt. Die fehlende HTTP-Aufzeichnung ist eine Nachweislücke, kein fehlender Funktionsnachweis. |
| Review-Gate abschließend geschlossen | Preview-D1: `enabled=0`, `protocol_version=2`, `changed_at=2026-10-03T22:04:22.122Z`. | Belegt. |
| Unangemeldeter Schutz aller geprüften Hosts und Pfade | Aktueller anonymer Lauf: alle 20 Antworten `302` zur Access-Anmeldung; keine internen UI-/Datenmarker in den Bodies. | Für genau diesen Host-/Pfadumfang belegt; alternative, nicht geprüfte Zugangswege bleiben außerhalb des Umfangs. |

**Schritt-2-Ergebnis:** Die Preview-Abnahmekriterien sind anhand der vorhandenen Browser- und Datenbanknachweise funktional abgedeckt. Als konkrete verbleibende Nachweislücke bleibt ausschließlich die fehlende Aufzeichnung von HTTP-Status und Antwortkörper der beiden manuellen Review-POSTs; daraus wird kein fehlender Funktionsnachweis abgeleitet.

## Noch offene Nachweise

- **Produktions-Rollout:** Der Nutzer-Nachweis vom 05.10.2026 bestätigt Release `21de608`, Deployment `a53bbef3.osmechplast.pages.dev`, angewendete und geprüfte Migrationen 0005/0006, aktivierte interne Oberfläche sowie den anonymen Schutz aller 20 Host-/Pfadkombinationen durch Access-`302` oder `401`. Offen bleibt ausschließlich die funktionale Produktionsabnahme der Dateifreigabe und -ablehnung; diese Aktionen werden vorerst nicht genutzt.
- **Manuelle HTTP-Belege:** Prüfziel: Status und Antwortkörper der beiden manuellen Review-POSTs. Vorhanden: Browserzustände und nachträgliche D1-/Auditnachweise. Nächste Prüfung: bei einer erneuten ausdrücklich freigegebenen Abnahme die beiden Netzwerkantworten aufzeichnen; kein erneuter Review ist für den bestehenden Nachweis erforderlich.
- **Weitere alternative Zugangswege:** Prüfziel: nicht geprüfte Hostnamen, Worker-/API-Aliase und sonstige alternative Domains. Vorhanden: anonyme `302`-Prüfung aller fünf geforderten Pfade auf Preview-Alias, Deployment-URL, Apex und `www`, ohne interne Marker. Nächste Prüfung: vor Produktionsrollout nur die tatsächlich zusätzlich verwendeten Zugangswege lesen und gegen dieselbe Access-Policy abgleichen.

## Aktueller Produktionsnachweis, 05.10.2026

Dieser Abschnitt trennt den aktuellen Nutzer-Nachweis von den historischen Preview- und lokalen Prüfungen:

- Release `21de60807273db7e739a080098bf9f19dc6e4820` wurde auf `a53bbef3.osmechplast.pages.dev` veröffentlicht.
- Migrationen 0005/0006 wurden angewendet und das Produktionsschema wurde anschließend geprüft.
- Die interne Oberfläche ist aktiviert.
- Die anonyme Schutzprüfung aller 20 Host-/Pfadkombinationen ergab ausschließlich Access-Anmeldung (`302`) oder `401`; interne Inhalte wurden dabei nicht unangemeldet bestätigt.
- Die neue synthetische Anfrage `#7` ist angekommen. Übersicht, Statusfilter und Suche für diese Anfrage wurden geprüft.
- Der Statuswechsel auf „In Bearbeitung“ blieb nach Neuladen erhalten und erschien im Verlauf.
- Der heruntergeladene PDF-Inhalt wurde visuell mit dem Test abgeglichen. Ein Datei-Hashvergleich wurde nicht durchgeführt.
- Die aktuelle Produktionsabfrage ergab `enabled=0`, `protocol_version=2`. Die Dateifreigabesperre bleibt damit geschlossen.
- Freigabe und Ablehnung wurden in Production vorerst nicht genutzt. Ihre funktionale Produktionsabnahme bleibt ausdrücklich offen; eine vollständige Abnahme aller Funktionen wird nicht behauptet.

## Schritt 3 – geprüfte Veröffentlichungsversion (lokal vorbereitet)

### Aktueller lokaler Stand

- Branch: `internal-leads-local`
- HEAD: `bb5bc8a8366911a7e9b370348858a9f495afd497`
- Arbeitsbaum: absichtlich nicht sauber; Produktcode, Tests, Dokumentation und untracked Dateien wurden vollständig inventarisiert.
- Der lokale Stand ist nicht automatisch identisch mit dem Preview-Deployment `ed772bae-34d3-4cfb-b8b0-77ae9eefd362`. Der gemeinsame HEAD-Commit ersetzt keinen Byte-/Manifestvergleich; ein solcher Vergleich wurde nicht durchgeführt.

### Release-Dateiliste für den Commit-Vorschlag

**Produktcode und Konfiguration:**

```text
.gitignore
_headers
_routes.json
eleventy.config.mjs
schema.sql
package.json
package-lock.json
functions/_middleware.js
functions/internal/_middleware.js
functions/internal/access-jwt.mjs
functions/internal/api/[[path]].js
functions/internal/api/leads/index.js
functions/internal/api/leads/[leadId]/index.js
functions/internal/api/leads/[leadId]/status.js
functions/internal/lead-workflow.mjs
functions/internal/leads-api.mjs
functions/internal/security.mjs
functions/upload/employee-route.mjs
functions/upload/state.mjs
internal/index.html
internal/internal.css
internal/internal.js
migrations/0005_internal_lead_workflow.sql
migrations/0006_upload_review_audit.sql
```

**Tests und lokale Test-Harnesses:**

```text
tests/access-jwt.test.mjs
tests/migration-schema.test.mjs
tests/upload-download.test.mjs
tests/upload-routes.test.mjs
tests/upload-state.test.mjs
tests/browser/internal-ui.browser.test.mjs
tests/fixtures/internal/seed.sql
tests/fixtures/internal/worker.mjs
tests/fixtures/internal/wrangler.jsonc
tests/helpers/internal-sqlite.mjs
tests/internal-build.test.mjs
tests/internal-pages-routing.test.mjs
tests/internal-fixtures.mjs
tests/internal-lead-status.test.mjs
tests/internal-leads-api.test.mjs
tests/internal-review-gate.test.mjs
tests/internal-security.test.mjs
tests/internal-ui.test.mjs
scripts/test-internal-d1.mjs
scripts/test-internal-pages-data.mjs
scripts/test-internal-pages.mjs
```

**Dokumentation:**

```text
docs/internal-leads-design.md
docs/internal-leads-implementation.md
docs/internal-leads-local-verification.md
docs/internal-leads-rollout.md
```

Nicht Bestandteil des Commit-Vorschlags, aber erhalten bleiben: `docs/internal-leads-local-handoff-2026-09-26.zip`, `docs/internal-leads-screenshots/`, beide `preview-d1-*.sql`-Sicherungen, `outputs/knx-funktionslandkarte/`, `scripts/build-knx-function-landscape.mjs`, die Diagnose-/Minimalvergleichsskripte sowie `_site/`, `_preview/`, `.tmp/`, `.wrangler/`, `.npm-cache/` und `node_modules/`. Diese Dateien werden nicht gelöscht.

### Aktuelle lokale Verifikation

- `npm.cmd run build` mit dem bestätigten öffentlichen `OSMP_TURNSTILE_SITE_KEY`: bestanden.
- `_site/kontakt/index.html` und `_site/modules/kontakt.html` enthalten den bestätigten Sitekey.
- `npm.cmd test`: 187 bestanden, 0 fehlgeschlagen, 0 übersprungen.
- `node --test tests/browser/internal-ui.browser.test.mjs` mit den vorhandenen lokalen Playwright-/Chrome-Pfaden: 2 bestanden, 0 fehlgeschlagen, 0 übersprungen. Dies war ein lokaler automatisierter Regressionstest, keine Wiederholung der manuellen Preview-Abnahme.
- `node --check` für 80 JavaScript-/ESM-Dateien: bestanden.
- `git diff --check`: bestanden.
- Der gezielte Regressionstest `node --test tests/internal-pages-routing.test.mjs` prüft die explizite Route-Datei und ihren authentifizierten Listenhandler mit signierter synthetischer Testauthentifizierung und synthetischem Listen-Datensatz. Das ist ein direkter Modul-/Handlernachweis, kein echter Pages-HTTP-Routennachweis.
- **04.10.2026, vom Nutzer ausgeführter lokaler Pages-HTTP-Test:** Der aktuelle Git-Index wurde isoliert exportiert; ausschließlich lokale synthetische D1-Daten und ein lokal signiertes Test-JWT wurden verwendet. Ohne Authentifizierung: `401`, `{"error":"unauthorized"}`. Mit Testauthentifizierung: `200`, `ids=[42]`, `page=1`, `hasMore=false`. Der eigene Pages-Prozess und temporäre Daten wurden ohne Cleanup-Fehler beendet. Dies ist ein lokaler Nachweis für den exportierten Git-Index, kein Remote-Preview-Test.
- Build-Ausschlussprüfung: keine `.dev.vars`, Secrets, SQL-/DB-Dateien, Sicherungen, Caches oder `node_modules` in `_site`.
- Der Testlauf schreibt bei einem absichtlich simulierten D1-Fehler eine synthetische Fehlermeldung in die lokale Konsole; der Test besteht und die Meldung gelangt nicht in den Build. Kein bestätigter Produktcodefehler daraus.

### Korrektur des Release-Commits

Der Commit `bb5bc8a8366911a7e9b370348858a9f495afd497` war unvollständig: `functions/internal/api/leads/index.js` fehlte. Die frühere Testsuite prüfte `listLeads` direkt, aber nicht die Pages-Routenzuordnung; deshalb blieb die Lücke unentdeckt. Die Korrektur umfasst ausschließlich diese Route, den gezielten Routentest und diese Dokumentationsänderung. Der echte lokale Pages-HTTP-Nachweis für den exportierten Git-Index ist am 04.10.2026 bestanden; ein Remote-Preview-Nachweis ist damit nicht gemeint.

### Korrektur der `/internal`-Routenzuordnung

Ausgangsbefund im Release-Stand `ad7baac8194e2b35a453f8a566368b033656cdab`: `_routes.json` enthielt `/internal/*`, aber nicht den exakten Pfad `/internal`. Der neue Konfigurationsregressionstest schlug am unveränderten Stand deshalb gezielt fehl.

Die lokale Korrektur ergänzt ausschließlich `/internal` neben der bestehenden Regel `/internal/*`; bestehende Regeln bleiben erhalten. Der Test `node --test tests/internal-pages-routing.test.mjs` prüft nun getrennt die Konfiguration (beide Include-Regeln) und den authentifizierten Listenhandler.

**04.10.2026, echter lokaler Pages-HTTP-Nachweis in isolierter Kopie des Release-Commits:** Beide isolierten HTTP-Läufe wurden aus dem unveränderten Commit `ad7baac8194e2b35a453f8a566368b033656cdab` erzeugt. Sie verwendeten daher die ursprüngliche `_routes.json` mit `/internal/*`, nicht die spätere lokale Ergänzung `/internal`. Redirects wurden im vorhandenen Harness ausdrücklich mit `redirect: 'manual'` nicht verfolgt.

Der erste Lauf prüfte ohne JWT `/internal`, `/internal/`, `/internal/internal.css` und `/internal/api/unknown`; alle lieferten `401`. Der zweite Lauf erweiterte ausschließlich im temporären Harness die Prüfung auf die fünf verlangten Pfade. Ohne JWT lieferten `/internal`, `/internal/`, `/internal/internal.css`, `/internal/internal.js` und `/internal/api/leads` jeweils `401`. Mit lokaler signierter Testauthentifizierung lieferten `/internal/` `200` und das geschützte CSS `200` mit Sicherheitsheadern. `INTERNAL_UI_ENABLED=0` lieferte `404`. Es wurden ausschließlich synthetische lokale Daten verwendet; Pages-Prozesse und temporäre Daten wurden bereinigt. Dies ist ein lokaler Nachweis, kein Remote-Preview-Test.

Die ursprüngliche Schutzlücke ist damit nicht als ausnutzbarer HTTP-Bypass nachgewiesen: Auch die unveränderte Konfiguration aus `ad7baac` lieferte für alle fünf anonym geprüften Pfade `401`. Nachgewiesen war jedoch die fehlende explizite Include-Regel für den exakten Pfad `/internal`; die lokale Ergänzung macht die Routenkonfiguration eindeutig. Der Konfigurationsregressionstest schlug ohne `/internal` gezielt fehl und bestand nach der Ergänzung. Konfigurationsnachweis und echter HTTP-Nachweis bleiben getrennt.

**Produktions-Access-Nachweis, 04.10.2026:** Der aktuelle Dashboard-Nachweis ordnet `abdelaziz.zouini@osmechplast.com` eindeutig der User-ID `04833bf3-b356-59d9-bee2-7cb869f8d78e` zu. Diese User-ID stimmt exakt mit dem vorgesehenen Wert für `ACCESS_ALLOWED_SUBJECTS` überein. Die Zuordnung ist damit belegt; es wurde kein Tokeninhalt dokumentiert.

### Lokale Produktionssicherungsprüfung für Release `21de608`

Die vorhandene lokale Sicherung `osmechplast_leads-before-release-21de608-20261004-225609.sql` wurde unverändert geprüft: Größe `26644` Bytes, SHA-256 `6141B0F5906D518203044403382F8A75D837FDB3C17A51AFFABC3BC5D4323FA4`. Die Prüfung und alle folgenden Datenbankarbeiten erfolgten ausschließlich in temporären lokalen Wrangler-D1-Persistenzen außerhalb von Git und Build.

Die Sicherung wurde in einer frischen lokalen D1-Kopie wiederhergestellt. Das vorhandene Schema erfüllte die Voraussetzungen von 0001–0004; diese Migrationen wurden nicht erneut angewendet. Vor 0005/0006 waren keine Workflow-Tabellen, Workflow-Spalten oder Trigger vorhanden.

Auf einer zweiten frischen Kopie wurden ausschließlich die SQL-Dateien 0005 und 0006 aus Release `21de608` ausgeführt. Danach waren die Workflow-Tabellen und -Spalten, die Indizes sowie `lead_status_request_apply`, `upload_review_guard` und `upload_review_success_audit` vorhanden; `upload_review_migration_block` war entfernt. Das Gate war nach dem Test wieder `enabled=0`, `protocol_version=2`.

Mit synthetischen Testdaten wurden ein erfolgreicher Statuswechsel mit Erfolgs-Audit, ein widersprüchlicher Statusversuch mit genau einem Konflikt-Audit, die Sperre bei geschlossenem Review-Gate sowie ein erfolgreicher Review mit genau einem passenden Erfolgs-Audit geprüft. Status-, Upload- und Auditwerte blieben strukturell konsistent. Es wurden keine Sicherungsdaten oder Kundendaten ausgegeben.

**Produktionsstrategie für das fehlende Ledger:** Die lokale Prüfung verwendete direkte lokale D1-Ausführung der beiden freigegebenen SQL-Dateien, nicht den Wrangler-Migrationsexecutor. Wrangler `4.141.0` wurde lokal festgestellt; der Produktionsstand besitzt weiterhin kein belegtes `d1_migrations`-Ledger. Ein normaler Lauf über alle sechs Dateien wäre deshalb nicht sicher: Wrangler würde 0001–0004 ohne Ledger als offen ansehen und die bereits vorhandene Baseline erneut ausführen.

Es wird genau folgende einmalige Baseline-Strategie verwendet:

1. **Vorbereitung ohne Anwendung:** Einen frischen vollständigen Produktions-D1-Export außerhalb des Repositorys erzeugen, Existenz, Größe und SHA-256 prüfen und den unveränderten Backup-Pfad dokumentieren. Danach ausschließlich Schema-Metadaten lesen: Tabellen, Spalten, Indizes und vorhandene Trigger; keine Datenzeilen ausgeben. Die bereits geprüfte Sicherung `osmechplast_leads-before-release-21de608-20261004-225609.sql` und ihr Hash dienen als vorhandener lokaler Nachweis, ersetzen aber nicht den frischen Export direkt vor der Remote-Änderung.

2. **0001–0004 als Baseline erfassen:** In einer frischen lokalen Wrangler-4.141.0-D1-Kopie mit den Migrationen 0001–0004 wurde der von genau dieser Version erzeugte Ledger ermittelt:

```sql
CREATE TABLE "d1_migrations"(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

Die exakten Dateinamen sind `0001_leads.sql`, `0002_lead_uploads.sql`, `0003_lead_requests.sql` und `0004_upload_audit_log.sql`. Die ausführbare projektspezifische Baseline liegt außerhalb des Releases unter `.tmp/d1-baseline-0001-0004.sql` und enthält ausschließlich:

```sql
CREATE TABLE "d1_migrations"(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO "d1_migrations" (name) VALUES
  ('0001_leads.sql'),
  ('0002_lead_uploads.sql'),
  ('0003_lead_requests.sql'),
  ('0004_upload_audit_log.sql');
```

Die Baseline verwendet absichtlich keine historischen `applied_at`-Werte. Die lokale Ausführung zeigte außerdem, dass eine Version mit explizitem `BEGIN`/`COMMIT` bei `d1 execute --file` die Einträge nicht dauerhaft übernahm; die geprüfte Fassung verwendet deshalb zwei autocommit-fähige Anweisungen. Dies ist eine projektspezifische, einmalige Baseline-Methode und kein ausdrücklich dokumentierter Cloudflare-Befehl zum Nachtragen einer historischen Baseline. Vor einer Remote-Anwendung muss das SQL separat freigegeben werden; die SQL-Körper von 0001–0004 werden nicht erneut ausgeführt.

3. **Ledger vor Anwendung verifizieren:** Mit einer schema-only-Abfrage prüfen, dass `d1_migrations` genau 0001–0004 enthält, keine 0005/0006 vorgemerkt sind und die Baseline-Schemaobjekte unverändert vorhanden sind. Bei Abweichungen sofort stoppen; weder 0001–0004 erneut anwenden noch Einträge raten oder überschreiben.

4. **Nur 0005 und 0006 über Wrangler anwenden:** Danach aus Commit `21de60807273db7e739a080098bf9f19dc6e4820` und mit der geprüften Konfiguration den normalen interaktiven Lauf ausführen:

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Director\AppData\Roaming\xdg.config'
$env:WRANGLER_WRITE_LOGS='0'
node .\node_modules\wrangler\bin\wrangler.js d1 migrations apply osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote
```

Da 0001–0004 dann im Ledger stehen, betrachtet Wrangler nur 0005 und 0006 als offen und erfasst beide nach erfolgreicher Anwendung. Die Anwendung erfolgt mit sichtbarer interaktiver Bestätigung; ein erneuter Lauf wird nicht automatisch gestartet.

5. **Teilfehler und Wiederaufnahme:** Bei einem Fehler in 0005 oder 0006 stoppt der Ablauf. Nach der Wrangler-Dokumentation wird die fehlerhafte Migration zurückgerollt, während zuvor erfolgreich angewendete Migrationen bestehen bleiben. Vor jeder Wiederaufnahme oder Wiederherstellungsentscheidung werden deshalb sowohl `d1_migrations` als auch das vollständige betroffene Schema (Tabellen, Spalten, Indizes und Trigger) gelesen und miteinander abgeglichen. Bei Fehler in 0005 muss 0005 anhand dieses Abgleichs geprüft und wiederaufgenommen werden; bei erfolgreich eingetragenem 0005 und Fehler in 0006 wird nur 0006 erneut aufgenommen. 0001–0004 werden niemals erneut ausgeführt. Ein unerwarteter Schema- oder Ledgerzustand führt zum Abbruch und zur Wiederherstellung aus dem zuvor geprüften Backup nur nach separater Freigabe; kein blindes Wiederholen.

6. **Abschlussprüfung vor Anwendungscode:** Schema-only prüfen: Ledger 0001–0006, alle Tabellen/Spalten/Indizes, `lead_status_request_apply`, `upload_review_guard` und `upload_review_success_audit` vorhanden, `upload_review_migration_block` entfernt, Review-Gate `enabled=0` und `protocol_version=2`. Erst nach erfolgreicher Remote-Schema-Prüfung darf der passende Anwendungscode veröffentlicht werden. Danach folgen Access-/Schutzprüfung und erst anschließend die ausdrücklich freigegebene Aktivierung von `INTERNAL_UI_ENABLED`; die funktionale Live-Abnahme erfolgt danach. Das Review-Gate bleibt geschlossen.

Diese Methode ist eine kontrollierte einmalige Ledger-Baseline plus normaler Wrangler-Migrationslauf; sie ist noch nicht remote ausgeführt. Sie folgt dem dokumentierten Wrangler-Verhalten, wonach `d1 migrations apply` nicht eingetragene Migrationen anwendet und erfolgreiche Migrationen im `d1_migrations`-Ledger erfasst. Cloudflare beschreibt außerdem, dass eine fehlerhafte Migration zurückgerollt wird und die vorherige erfolgreiche Migration erhalten bleibt. (Siehe [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/) und [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/).)

### Lokaler Baseline-Nachweis

Die vorhandene Sicherung wurde in eine frische lokale D1-Kopie eingespielt. Danach wurde ausschließlich `.tmp/d1-baseline-0001-0004.sql` ausgeführt. `d1 migrations list --local` erkannte anschließend ausschließlich `0005_internal_lead_workflow.sql` und `0006_upload_review_audit.sql` als offen. Der anschließende echte Lauf

```powershell
node .\node_modules\wrangler\bin\wrangler.js d1 migrations apply oscnc-ledger-baseline-production-copy --local --config .tmp\ledger-baseline-production-copy\wrangler.jsonc --persist-to .tmp\ledger-baseline-production-copy\state
```

war mit Wrangler `4.141.0` erfolgreich. Danach enthielt das Ledger genau 0001–0006. Vorhanden waren die Tabellen `internal_review_control`, `lead_status_requests` und `lead_status_audit`, die Indizes aus 0005 sowie `lead_status_request_apply`, `upload_review_guard` und `upload_review_success_audit`. `upload_review_migration_block` war nicht vorhanden. Das Gate war `enabled=0`, `protocol_version=2`. Es wurden keine funktionalen Review-Tests wiederholt und keine Datenzeilen ausgegeben.

## Abschließender Produktionsablauf für Release `21de608`

Die folgenden Befehle sind nur vorbereitet und wurden nicht ausgeführt. Jeder Fehler beendet den Ablauf. Nach jedem Fehler werden zuerst Ledger **und** Schema gelesen; es gibt keine automatische Wiederholung und keine automatische Wiederherstellung.

### 1. Frischer Export unmittelbar vor der Änderung

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Director\AppData\Roaming\xdg.config'
$env:WRANGLER_WRITE_LOGS='0'
$backupRoot='C:\Users\Director\Documents\Italien Firma\oscnc-backups'
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$backup=Join-Path $backupRoot ("osmechplast_leads-before-production-21de608-$stamp.sql")
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
if (Test-Path -LiteralPath $backup) { throw "Backupziel existiert bereits: $backup" }
node .\node_modules\wrangler\bin\wrangler.js d1 export osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --output $backup
if ($LASTEXITCODE -ne 0) { throw "Produktions-Export fehlgeschlagen: Exitcode $LASTEXITCODE" }
$item=Get-Item -LiteralPath $backup
if ($item.Length -le 0) { throw 'Produktions-Export ist leer' }
Get-Item -LiteralPath $backup | Select-Object FullName,Length
Get-FileHash -LiteralPath $backup -Algorithm SHA256 | Select-Object Path,Hash
```

### 2. Ausgangsstand nur lesend prüfen

Aus dem Release-Checkout werden zunächst nur Schemaobjekte gelesen; keine Anwendungsdaten:

```powershell
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --json --command "SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY type,name; PRAGMA table_info(leads); PRAGMA table_info(lead_uploads); PRAGMA table_info(lead_requests); PRAGMA table_info(upload_audit_log); PRAGMA index_list('leads'); PRAGMA index_list('lead_uploads'); PRAGMA index_list('lead_requests'); PRAGMA index_list('upload_audit_log');"
```

Der erwartete Ausgang ist: Basisschema 0001–0004 vorhanden, mit vollständigen Spalten-, Index- und SQL-Definitionen; Workflowobjekte aus 0005/0006 noch nicht vorhanden und kein belegtes `d1_migrations`-Ledger. Falls `d1_migrations` bereits existiert, wird es separat gelesen; bei unerwarteten Einträgen stoppt der Ablauf. Eine reine `type/name`-Abfrage gilt nicht als vollständiger Schemavergleich.

### 3. Einmalige projektspezifische Baseline anwenden

Nur wenn Schritt 2 den erwarteten Ausgang bestätigt:

```powershell
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --file .\.tmp\d1-baseline-0001-0004.sql
if ($LASTEXITCODE -ne 0) { throw "Baseline fehlgeschlagen: Exitcode $LASTEXITCODE" }
```

Die Baseline verändert ausschließlich `d1_migrations`; sie führt keine SQL-Datei 0001–0004 erneut aus. Die Baseline-SQL darf niemals blind ein zweites Mal ausgeführt werden.

### 4. Ledger prüfen und nur 0005/0006 anwenden

```powershell
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --json --command "SELECT id,name FROM d1_migrations ORDER BY id;"
```

Nur bei exakt vier Einträgen in dieser Reihenfolge darf der interaktive Wrangler-Lauf aus dem unveränderten Release-Checkout gestartet werden:

```powershell
$release='21de60807273db7e739a080098bf9f19dc6e4820'
$actual=(git rev-parse HEAD).Trim()
if ($actual -ne $release) { throw "Falscher Release-Stand: $actual" }
$releaseFiles=@('_routes.json','functions','internal','migrations','package.json','package-lock.json','tests/internal-pages-routing.test.mjs')
$changed=@(git diff --name-only $release -- $releaseFiles)
if ($changed.Count -ne 0) { throw "Release-Dateien lokal verändert: $($changed -join ', ')" }
git ls-tree -r --name-only $release -- $releaseFiles
node .\node_modules\wrangler\bin\wrangler.js d1 migrations apply osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote
if ($LASTEXITCODE -ne 0) { throw "Migration 0005/0006 fehlgeschlagen: Exitcode $LASTEXITCODE" }
```

Die sichtbare Wrangler-Bestätigung bleibt erhalten. Untracked Dateien aus dem Arbeitsbaum gehören nicht zum Release und werden nicht veröffentlicht. Die Manifestausgabe aus `git ls-tree` und die Nullausgabe von `git diff` für die Releasepfade sichern die Dateiidentität; `HEAD` allein genügt nicht. Bei einem Fehler werden Ledger und Schema gelesen, bevor über Wiederaufnahme oder Wiederherstellung entschieden wird.

### 5. Abschlussprüfung von Schema, Triggern und Gate

```powershell
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --json --command "SELECT id,name,applied_at FROM d1_migrations ORDER BY id; SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') ORDER BY type,name; PRAGMA table_info(leads); PRAGMA table_info(lead_uploads); PRAGMA table_info(lead_requests); PRAGMA table_info(upload_audit_log); PRAGMA table_info(internal_review_control); PRAGMA table_info(lead_status_requests); PRAGMA table_info(lead_status_audit); PRAGMA index_list('leads'); PRAGMA index_list('lead_uploads'); PRAGMA index_list('lead_requests'); PRAGMA index_list('upload_audit_log'); PRAGMA index_list('internal_review_control'); PRAGMA index_list('lead_status_requests'); PRAGMA index_list('lead_status_audit'); SELECT enabled,protocol_version FROM internal_review_control WHERE id=1;"
```

Erwartet werden Ledger 0001–0006 mit den tatsächlich gesetzten `applied_at`-Werten, alle Tabellen/Spalten/Indizes und vollständigen SQL-Definitionen aus 0001–0006, die drei Pflichttrigger, kein `upload_review_migration_block` sowie `enabled=0` und `protocol_version=2`. Das Gate bleibt geschlossen. Bei Fehler oder Abweichung werden keine weiteren SQL-Anweisungen ausgeführt.

### 6. Produktionskonfiguration und Deployment vorbereiten

Für Production bleiben ausschließlich die bestätigten Access-Werte und Bindings unverändert:

```text
DB: osmechplast_leads / e2415049-5c46-4477-a88f-afe12cd8c59b
RFQ_UPLOADS: osmp-rfq-production-private
ACCESS_POLICY_AUD: 76d3e8bb9b6a19edf21aa716feaec5b7e8fe17460f7cf6208d4765ba9bffa325
ACCESS_TEAM_DOMAIN: misty-bonus-5d3c.cloudflareaccess.com
ACCESS_ALLOWED_SUBJECTS: 04833bf3-b356-59d9-bee2-7cb869f8d78e
```

`INTERNAL_ORIGIN=https://osmechplast.com` und `INTERNAL_UI_ENABLED=0` sind geplante neue Production-Einstellungen, nicht als unveränderter Bestand belegt. `INTERNAL_UI_ENABLED` bleibt während Migration, Schema-/Schutzprüfung und Deployment deaktiviert; erst nach ausdrücklicher Freigabe wird es auf `1` gesetzt.

Der öffentliche Produktions-Turnstile-Sitekey ist laut Dashboard-/Nutzernachweis vom 05.10.2026 `0x4AAAAAAFBnbhShbQo7XLnr`; der bekannte Preview-Key darf nicht verwendet werden. Vor dem Build ist daher zu prüfen:

```powershell
if ([string]::IsNullOrWhiteSpace($env:OSMP_TURNSTILE_SITE_KEY)) { throw 'Produktions-Turnstile-Sitekey fehlt' }
if ($env:OSMP_TURNSTILE_SITE_KEY -ne '0x4AAAAAAFBnbhShbQo7XLnr') { throw 'Falscher Produktions-Turnstile-Sitekey' }
npm.cmd run build
```

Danach werden `_site/kontakt/index.html` und `_site/modules/kontakt.html` auf den Produktions-Sitekey geprüft und der Build auf vertrauliche Dateien kontrolliert. Die vorbereitete Pages-Veröffentlichung lautet nach Bestätigung des tatsächlichen Produktionsbranchs:

```powershell
node .\node_modules\wrangler\bin\wrangler.js pages deploy .\_site --project-name osmechplast --branch master
```

Access-Schutz für `/internal`, `/internal/` und `/internal/*` wird vor Veröffentlichung separat bestätigt. `INTERNAL_UI_ENABLED` bleibt während Vorbereitung, Migration, Deployment und Schutzprüfung `0`; nach erfolgreicher Schutzprüfung wird es ausdrücklich auf `1` gesetzt. Erst danach folgt die funktionale Live-Abnahme; das Review-Gate bleibt `enabled=0`.

**Rückfallversion:** Die vor der Änderung festgehaltene immutable Produktionsversion ist Deployment `3ba19ed5-01cf-4b5f-9ecd-d5911da2241b` mit Source-Commit `23b1ee2`. Bei Datenbankproblemen wird nicht automatisch restauriert: Gate geschlossen halten, UI deaktiviert lassen, Ledger und Schema prüfen und eine Wiederherstellung aus dem frischen Backup erst nach separater Freigabe durchführen.

### Aktuelle Lesekontrolle der Produktionsmetadaten, 05.10.2026

**Dashboard-Nachweis vom 05.10.2026:** Produktionsbranch `master`; aktives Produktionsdeployment `3ba19ed5-01cf-4b5f-9ecd-d5911da2241b`; Source-Commit `23b1ee2`; öffentlicher Produktions-Turnstile-Sitekey `0x4AAAAAAFBnbhShbQo7XLnr`. Diese Werte ersetzen die zuvor nicht bestätigten historischen Angaben. Der aktive Produktions-Source-Commit `23b1ee2` ist nicht automatisch der geprüfte Release `21de608`; vor Veröffentlichung muss der Release-Identitätsnachweis erfolgreich sein.

**Freigegebene Produktionsmigration – Vorprüfung:** Die Sicherung `..\oscnc-backups\osmechplast_leads-before-release-21de608-20261005-123849.sql` wurde lokal geprüft: `26877` Bytes, SHA-256 `CF01660C461FBC301447C3637A7ED86AC349673A014CEB7E27F7F53886BC8CC2`. Ein weiterer Export wurde nicht gestartet. Die lesende Produktionsabfrage der Schema-/Ledger-Metadaten mit der vorhandenen OAuth-Konfiguration endete mit `fetch failed`. Deshalb wurden Baseline-SQL, 0005/0006 und jede weitere Remote-Schreibaktion nicht ausgeführt. Ein Tokenwechsel wurde nicht begonnen. In den geprüften lokalen Ablageorten lag keine separate Produktions-Schemadefinitionsdatei vor; `schema.sql` im isolierten Release ist keine unabhängige Remote-Produktionsbestätigung. Nächster Schritt ist ausschließlich eine erfolgreiche lesende Produktions-Schema-/Ledgerabfrage; bei Abweichung oder erneutem Zugriffsfehler bleibt die Migration blockiert.

**Bereitgestellter Nutzer-Nachweis, 05.10.2026 gegen 12:40 Uhr:** Die Produktionsabfrage meldete `success=true`, `rows_written=0` und `changed_db=false`. Die bereitgestellten Definitionen enthalten die Basistabellen und -indizes aus 0001–0004. `_cf_KV` ist eine lokale D1-Systemtabelle. `leads` enthält noch keine Workflowspalten, `lead_uploads` noch kein `review_request_id`; die Workflowtabellen, Workflowindizes und Trigger aus 0005/0006 fehlen erwartungsgemäß. Es gibt keine Tabelle `d1_migrations` und keine Trigger. Der Vergleich mit den Voraussetzungen und dem Ausgangszustand der bestandenen lokalen Migrationsprobe passt. Dieser Nutzer-Nachweis bleibt getrennt vom früheren Codex-Fehler `fetch failed`.

Die lokal getestete Baseline-Datei `.tmp\d1-baseline-0001-0004.sql` ist vorhanden, 308 Bytes groß und hat SHA-256 `CA6EB3CA9F65A01FE47B0CE54D5CB460F4E1F54C4894FCC46A538843EC511C16`. Ihr Inhalt entspricht dem dokumentierten lokalen Wrangler-4.141.0-Test: ausschließlich `d1_migrations`-Definition und die vier Einträge 0001–0004, ohne historische Zeitstempel oder Anwendungstabellen.

Nach Vorlage des tatsächlich enthaltenen JSON-Payloads und nur bei bestandenem Vergleich ist für die normale interaktive PowerShell ausschließlich dieser Baseline-Block vorgesehen; 0005/0006 sind absichtlich nicht enthalten:

```powershell
$expectedBaselineHash='CA6EB3CA9F65A01FE47B0CE54D5CB460F4E1F54C4894FCC46A538843EC511C16'
$baseline='.\.tmp\d1-baseline-0001-0004.sql'
if ((Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash -ne $expectedBaselineHash) { throw 'Baseline-Datei weicht vom lokal getesteten Stand ab' }
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --file $baseline
$baselineExit=$LASTEXITCODE
if ($baselineExit -ne 0) { exit $baselineExit }
node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --json --command "SELECT id,name,applied_at FROM d1_migrations ORDER BY id;"
```

Der Schemavergleich ist damit bestanden. Für die normale interaktive PowerShell ist ausschließlich dieser Baseline-Block vorbereitet; 0005/0006 sind absichtlich nicht enthalten und der Block wurde nicht ausgeführt:

```powershell
$baseline='.\.tmp\d1-baseline-0001-0004.sql'
$expectedBaselineHash='CA6EB3CA9F65A01FE47B0CE54D5CB460F4E1F54C4894FCC46A538843EC511C16'
$actualBaselineHash=(Get-FileHash -LiteralPath $baseline -Algorithm SHA256).Hash
if ($actualBaselineHash -ne $expectedBaselineHash) { throw 'Baseline-Datei weicht vom lokal getesteten Stand ab' }

node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --file $baseline
$baselineExit=$LASTEXITCODE
if ($baselineExit -ne 0) { throw "Baseline fehlgeschlagen: Exitcode $baselineExit" }

node .\node_modules\wrangler\bin\wrangler.js d1 execute osmechplast_leads --config .\wrangler.cleanup.jsonc --env production --remote --json --command "SELECT id,name,applied_at FROM d1_migrations ORDER BY id;"
$ledgerExit=$LASTEXITCODE
if ($ledgerExit -ne 0) { throw "Ledger-Abfrage fehlgeschlagen: Exitcode $ledgerExit" }
```

Die erwartete Ledger-Ausgabe nach dem Baseline-Schritt enthält ausschließlich 0001–0004. Erst nach ihrer Prüfung folgt ein separater, ausdrücklich freigegebener Block für 0005/0006.

**Letzte Vorbereitung vor Produktionsmigration, 05.10.2026:** Der direkte Export wurde mit Datenbank `osmechplast_leads`, `--config .\wrangler.cleanup.jsonc`, `--env production` und `--remote` versucht. Wrangler konnte die vorhandene OAuth-Sitzung in der nicht-interaktiven Umgebung nicht verwenden und verlangte ein `CLOUDFLARE_API_TOKEN`. Der Export wurde deshalb ohne erzeugte Sicherungsdatei abgebrochen; es wurden keine Download-URLs oder Datenzeilen ausgegeben. Gemäß Ablauf wurden keine Schema-/Ledger-Abfragen fortgesetzt und keine Remote-Schreibaktionen ausgeführt. Nächster erforderlicher Schritt ist ein erfolgreicher interaktiver Export in der normalen angemeldeten PowerShell; erst danach dürfen die lesende Schema-/Ledger-Prüfung, die Baseline und 0005/0006 vorbereitet werden.

Die Release-Identität ist lokal dagegen eingegrenzt: Branch `internal-leads-local`, `HEAD=21de60807273db7e739a080098bf9f19dc6e4820`; `git diff --name-only 21de608 --` enthält nur die lokale Dokumentationsänderung. Mehrere untracked Diagnose-, Sicherungs- und Übergabedateien bleiben außerhalb des Releases. Vor einem späteren Build müssen zusätzlich die im Ablauf genannten `git diff`-/`git ls-tree`-Prüfungen im isolierten Release-Checkout erfolgreich sein.

### Lokales Veröffentlichungsartefakt aus Release `21de608`, 05.10.2026

Eine frische isolierte Kopie wurde ausschließlich aus Commit `21de60807273db7e739a080098bf9f19dc6e4820` per `git archive` erzeugt. Untracked Dateien des Arbeitsbaums wurden nicht übernommen. Der Build lief in dieser Kopie mit dem prozesslokalen Wert `OSMP_TURNSTILE_SITE_KEY=0x4AAAAAAFBnbhShbQo7XLnr`:

```powershell
$env:OSMP_TURNSTILE_SITE_KEY='0x4AAAAAAFBnbhShbQo7XLnr'
Push-Location .\.tmp\production-release-20261005-120339
npm.cmd run build
Pop-Location
```

Geprüfter Ablageort der isolierten Kopie:
`C:\Users\Director\Documents\Italien Firma\oscnc\.tmp\production-release-20261005-120339`

Das vorbereitete Pages-Artefakt liegt unter:
`C:\Users\Director\Documents\Italien Firma\oscnc\.tmp\production-release-20261005-120339\production-release-21de608-pages-artifact.zip`

Geprüfte Hashes und Größen:

| Datei | Größe | SHA-256 |
|---|---:|---|
| `_site/kontakt/index.html` | 22445 | `FB5612A4D1E2434D0035E3869E730C9883877FD07F0E50820AF07893F5B24C38` |
| `_site/modules/kontakt.html` | 5664 | `D2C62F28E8D201320E45CD094E281A8BF5CA560E5120B1EC1EA67316E4DE6393` |
| `_site/internal/index.html` | 1389 | `2B3C8931185A277D622CE01DDDCAD1AF1E06E591E4D443492217EACA0DFD2CA3` |
| `_site/internal/internal.css` | 6009 | `1479683BE38D369C0B57158D459A51B02F231FB2A3B3D9739FA46B147FDB2424` |
| `_site/internal/internal.js` | 14431 | `CFC6C9723E33918204F0B5E50F56B3B3E28BFF9CB19C4183A24D859DA55A99E9` |
| `_site/_routes.json` | 98 | `1A29543C5A7850B74BAAC353D5BC8680D4E6B45022AA3D19311675CFCF5C2A1D` |
| `production-release-21de608-pages-artifact.zip` | 15754346 | `4887EBA36FED9D99F76560B084851F6B5EF97A46657B64DFF8D7C26ABABC644B` |

Belegt: Beide Kontaktartefakte enthalten jeweils den exakten Produktions-Sitekey; die interne Oberfläche, ihre CSS-/JavaScript-Dateien sowie `/internal` und `/internal/*` sind im Build vorhanden. Das ZIP enthält Functions und `_site`; es enthält keine `.dev.vars`, Secrets, Sicherungen, Datenbanken, Caches oder Diagnoseartefakte. Funktionstests wurden nicht wiederholt. Das Artefakt ist nur lokal vorbereitet und wurde nicht veröffentlicht.

### Commit-Vorschlag und Freigabestatus

Vorschlag: `feat(internal): add authenticated lead review workspace`

Der ursprüngliche Release-Commit ist erstellt; der Korrektur-Commit ist noch nicht erstellt. Vor dessen Erstellung müssen ausschließlich die drei Korrekturdateien einzeln gestaged werden. Push, Deployment, Remote-Migration und Gate-Eingriff bleiben ausgeschlossen.

Verbleibender Release-Blocker: Der Korrektur-Commit ist noch ausstehend; die Produktionsfreigabe bleibt ein separater Schritt und der lokale Stand ist nicht als Identitätsnachweis für das Preview-Deployment zu behandeln.
