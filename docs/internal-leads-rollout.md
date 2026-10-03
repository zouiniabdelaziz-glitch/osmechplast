# Interne Leads – lokaler Rollout- und Rückfallnachweis

Stand: 04.10.2026. Dieses Protokoll trennt vorbereitete Rollout-Schritte von den tatsächlich belegten Preview-Nachweisen. Produktion, Cloudflare-Access-Konfiguration, Commits und Pushes wurden nicht verändert.

## Vor Online-Test getrennt freigeben

- Cloudflare Access für `/internal` und `/internal/*` auf Apex, `www` und dem tatsächlich verwendeten Preview-Host.
- Team-Domain, Audience und ausschließlich bestätigte Mitarbeiter-Subjects.
- Isolierte Preview-D1-/R2-Bindings, Sicherung und Wiederherstellungsweg.
- Kompatibler Code, lokale Migrations- und Routingnachweise, kein unbeabsichtigtes Produktionsdeployment.

## Reihenfolge

1. Kompatiblen Code bereitstellen, der ohne vollständiges Schema fail-closed bleibt.
2. Migration 0005 anwenden; das Review-Gate bleibt geschlossen.
3. Die unabhängige Sperre aus 0005 nachweisen.
4. Migration 0006 vollständig anwenden. Sie schließt das Gate, installiert Guard und Erfolgs-Audit und entfernt die unabhängige Sperre als letztes Statement.
5. Status-, Audit-, Review- und Rollbacktests ausführen. Bei SQL-Fehler nicht fortsetzen.
6. Geschlossenes Gate erneut bestätigen.
7. Erst nach separater Freigabe lokal/Preview öffnen:

```sql
UPDATE internal_review_control
SET enabled=1, changed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id=1 AND enabled=0 AND protocol_version=2;
```

8. Geänderte Zeilenzahl prüfen und genau einen synthetischen Erfolgs-Audit nachweisen.
9. Die neue UI separat aktivieren.

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
- Preview-Deployment `ed772bae-4f28-4bdb-8eb7-4f1c1f5f0a4b` auf dem Branch `rfq-upload-preview` wurde veröffentlicht.
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

- **Produktions-Rollout:** Prüfziel: produktive Bindings, Migrationen, Access-Schutz und Rückfallweg. Vorhanden: Preview-Deployment, Preview-D1-/R2- und Gate-Nachweise. Nächste Prüfung: separate Produktionsfreigabe mit Zielprojekt-, Binding-, Backup- und Access-Nachweis; bis dahin keine Produktionsänderung.
- **Manuelle HTTP-Belege:** Prüfziel: Status und Antwortkörper der beiden manuellen Review-POSTs. Vorhanden: Browserzustände und nachträgliche D1-/Auditnachweise. Nächste Prüfung: bei einer erneuten ausdrücklich freigegebenen Abnahme die beiden Netzwerkantworten aufzeichnen; kein erneuter Review ist für den bestehenden Nachweis erforderlich.
- **Weitere alternative Zugangswege:** Prüfziel: nicht geprüfte Hostnamen, Worker-/API-Aliase und sonstige alternative Domains. Vorhanden: anonyme `302`-Prüfung aller fünf geforderten Pfade auf Preview-Alias, Deployment-URL, Apex und `www`, ohne interne Marker. Nächste Prüfung: vor Produktionsrollout nur die tatsächlich zusätzlich verwendeten Zugangswege lesen und gegen dieselbe Access-Policy abgleichen.

## Schritt 3 – geprüfte Veröffentlichungsversion (lokal vorbereitet)

### Aktueller lokaler Stand

- Branch: `internal-leads-local`
- HEAD: `d597c433b9f7bf36c7f527b1b9957142812b99df`
- Arbeitsbaum: absichtlich nicht sauber; Produktcode, Tests, Dokumentation und untracked Dateien wurden vollständig inventarisiert.
- Der lokale Stand ist nicht automatisch identisch mit dem Preview-Deployment `ed772bae-4f28-4bdb-8eb7-4f1c1f5f0a4b`. Der gemeinsame HEAD-Commit ersetzt keinen Byte-/Manifestvergleich; ein solcher Vergleich wurde nicht durchgeführt.

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
- Build-Ausschlussprüfung: keine `.dev.vars`, Secrets, SQL-/DB-Dateien, Sicherungen, Caches oder `node_modules` in `_site`.
- Der Testlauf schreibt bei einem absichtlich simulierten D1-Fehler eine synthetische Fehlermeldung in die lokale Konsole; der Test besteht und die Meldung gelangt nicht in den Build. Kein bestätigter Produktcodefehler daraus.

### Commit-Vorschlag und Freigabestatus

Vorschlag: `feat(internal): add authenticated lead review workspace`

Der lokale Stand ist für einen lokalen Release-Commit technisch vorbereitet. Vor dem Commit müssen die oben genannten Ausschlüsse explizit aus dem Staging ferngehalten werden. Ein Commit, Push, Deployment, Remote-Migration oder Gate-Eingriff ist noch nicht erfolgt.

Verbleibender Release-Blocker vor einem Veröffentlichungs-Commit: Es fehlt nur die ausdrückliche Commit-Freigabe und die Bestätigung der finalen Staging-Dateiliste. Die Produktionsfreigabe bleibt ein separater Schritt; der lokale Build-/Teststand ist nicht als Identitätsnachweis für das Preview-Deployment zu behandeln.
