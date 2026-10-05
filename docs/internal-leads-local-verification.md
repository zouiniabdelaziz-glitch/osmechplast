# Lokaler Prüfbericht — Internal Leads

Stand: 2026-10-04

## Ausgeführt

- `npm.cmd run build` erfolgreich.
- `npm.cmd test` im aktuellen lokalen Release-Stand: 187/187 bestanden, 0 fehlgeschlagen, 0 übersprungen.
- `node --test tests/internal-review-gate.test.mjs tests/internal-security.test.mjs`: 13/13 bestanden, einschließlich aller drei vollständigen Präfixe vor dem finalen `DROP TRIGGER`, eines injizierten Pflicht-Triggerfehlers, frühem Stream-Abbruch und `application/jsonBOGUS`.
- Lokaler Wrangler-D1-Test: Konkurrenzgewinner, Wiederholung, abweichende Identität, exakte Auditfolge, echter `changeLeadStatus`-Auditfehler mit vollständigem Rollback und geschlossenes Review-Gate für Freigabe/Ablehnung bestanden.
- Pages-/JWT-/JWKS-Test mit isolierter temporärer Kopie bestanden; Projekt-`.dev.vars` blieb unberührt.
- Lokaler D1-Review-Gate-Test bestätigt beide gesperrten Aktionen bei geschlossenem Gate; D1-Auditfehler lässt Status, Version, Aufträge und Audits unverändert.
- Der D1-Migrationsabbruchtest übergibt fehlerhaften Pflicht-Trigger und nachfolgendes `DROP TRIGGER` an denselben Batch; die Sperre bleibt aktiv.
- Das Übergabe-ZIP wurde frisch entpackt; daraus bestanden die zentralen Workflow-, Migrations- und Sicherheitsregressionen mit 24/24. Das Paket enthält 80 relative Einträge, Migrationen 0001–0006, keine doppelten Pfade und keine verbotenen Dateien.
- Playwright `1.63.0` ist lokal als Entwicklungsabhängigkeit installiert; der Browserdownload wurde übersprungen. Mit vorhandenem Chrome liefen die Browserregressionen tatsächlich mit 2/2 bestanden und 0 übersprungen: Downloadinhalt/-name, Dialoge, Konflikt-/Ablaufzustände, doppelte Übermittlung, 26 Anfragen, Suche, Filter, Pagination sowie Smartphonebreite und 200-%-Textgröße.
- Der Statusdialog zeigt ausschließlich `new → in_progress|completed`, `in_progress → completed` und `completed → in_progress`; die Browserregression prüft die tatsächlich gesendeten Zielwerte.
- Nach dem Konflikt von Anfrage 1 wird die Vorgangskennung beim Zurückkehren zur Übersicht verworfen. Anfrage 2 erhält beim gültigen Statuswechsel eine neue Kennung; Wiederholungen desselben vollständigen Auftrags behalten ihre Kennung.
- Browser-Zurück und -Vorwärts sowie der Wechsel über „Alle Anfragen“ verwenden getrennte Zustände je Anfrage; die Konfliktmeldung und Sperre von Anfrage 1 erscheinen nicht bei Anfrage 2.
- Der mobile Downloadfall setzt nach dem letzten `page.goto` erneut 200 % und prüft die berechnete Root-Schriftgröße `32px` vor Downloadbutton- und Dialoggeometrie.
- Der Downloadfehlerpfad wurde browserseitig für HTTP 401, 404, 500 und einen Netzwerkabbruch ausgeführt: jeweils passende sichtbare Meldung, geschlossener Dialog und kein unbehandelter JavaScript-Fehler. Der erfolgreiche Download mit Dateiname `part.pdf` und Inhalt `synthetic-pdf` bleibt bestanden.
- Ein verzögerter Downloadfehler während `page.goBack()` wurde ausgeführt; der Fehler blieb an Anfrage 1 gebunden und wurde weder in der Übersicht noch bei Anfrage 2 angezeigt.
- Die unabhängigen Browserfälle werden nach den Downloadfehlern durch eine vollständige Navigation isoliert; dadurch werden die per Anfrage gespeicherten Fehlerzustände nicht als Statusfehler des Folgefalls interpretiert.
- Echter lokaler Pages-/D1-/R2-Lauf mit signiertem synthetischem JWT und lokalem JWKS: unberechtigte Anfrage 401, Liste mit Anfrage ohne Datei und Anfrage mit Datei, Detail ohne Datei, Suche, Statuspersistenz nach Browser-Neuladen, R2-Download sowie Freigabe/Ablehnung mit Bearbeiter- und strukturierten Auditbelegen bestanden.
- Im isolierten Pages-Lauf war `meta.changes` tatsächlich vom Typ `number` und hatte den Wert `2` (Trigger zählen mit). Der Review-Erfolg wird deshalb nicht aus diesem Wert oder allein aus `security_status` abgeleitet, sondern nur bei übereinstimmendem Status, Bearbeiter, `review_request_id`, `reviewed_at` und dem zugehörigen Erfolgs-Audit gemeldet. Ein zweiter paralleler Vorgang meldete 409 und keinen fremden Erfolg.
- Der gezielte Nachlauf erfasste die echte Ablehnungs-POST-Antwort im Browser (`200`, `ok: true`, `security_status: rejected`) und prüfte den Statusfilter mit konkreten IDs (`Neu` → 2, `In Bearbeitung` → 1). Der gespeicherte Ablehnungsstatus und die zugehörigen Auditzeilen wurden anschließend weiterhin strukturiert aus D1 geprüft.
- Preview-Abnahme mit Deployment `ed772bae-4f28-4bdb-8eb7-4f1c1f5f0a4b`: Die Browserbeobachtung zeigte Lead 4 als „Freigegeben“ und Lead 5 als „Abgelehnt“. Die nachträgliche D1-Prüfung bestätigte für Upload `89e9d614-d5a5-41b1-933e-06df884edc69` `stored + approved`, ausgefüllte Review-Felder und genau ein `file_approved/success/approved`; für Upload `b16d981f-ace8-431f-a0fb-f54f31a45f1c` `stored + rejected`, ausgefüllte Review-Felder, die Begründung `OSMP manueller Ablehnungstest` und genau ein `file_rejected/success/rejected`. Je Upload wurde genau ein `upload_stored/success/stored` separat gezählt.
- Aktuelle lokale Release-Prüfung: `npm.cmd run build` mit dem bestätigten öffentlichen Turnstile-Sitekey bestanden; beide Kontaktartefakte enthalten den Sitekey. `node --check` für 80 JavaScript-/ESM-Dateien und `git diff --check` bestanden. Die Build-Ausgabe enthält keine `.dev.vars`, Secrets, SQL-/DB-Dateien, Sicherungen, Caches oder `node_modules`.
- Das Preview-Gate wurde nach der Abnahme geschlossen und abschließend als `enabled=0`, `protocol_version=2`, `changed_at=2026-10-03T22:04:22.122Z` gelesen. Ein HTTP-200-Nachweis der manuellen Freigabe-POST wurde nicht aufgezeichnet; der Browserzustand allein wird dafür nicht als HTTP-Nachweis ausgegeben.
- Der Abgleich von Schritt 2 ordnet die Preview-Kriterien getrennt nach Browserbeobachtung, echtem Pages-/D1-/R2-Nachweis und aktuellem anonymem Access-Nachlauf zu. Die funktionalen Kriterien sind damit belegt; offen bleibt nur die fehlende HTTP-Aufzeichnung der beiden manuellen Review-POSTs, nicht der Funktionsnachweis selbst.
- Erneuter aktueller anonymer Access-Nachlauf vom 04.10.2026: Für den Preview-Alias, die Deployment-URL, Apex und `www` wurden die fünf Pfade `/internal`, `/internal/`, `/internal/internal.css`, `/internal/internal.js` und `/internal/api/leads` ohne Cookies, Access-Header und Redirect-Following gelesen. Jeder Aufruf antwortete mit `302` zur Access-Domain `misty-bonus-5d3c.cloudflareaccess.com` und dem passenden Login-Pfad ohne dokumentierte Queryparameter. Die Body-Längen waren 143 Bytes auf den Pages-Hosts und 510 Bytes auf Apex/`www`; interne UI-/Datenmarker waren in allen 20 Bodies nicht vorhanden.

## Teststatus

### Tatsächlich ausgeführt und bestanden

- Browser: 2 Tests ausgeführt, 2 bestanden, 0 fehlgeschlagen, 0 übersprungen; einschließlich Download 401/404/500/Netzwerk, verzögerter Navigation, `page.goBack()`/`page.goForward()` und eigener Request-ID für Anfrage 2.
- Betroffener UI-Unit-Test: 1 ausgeführt, 1 bestanden.
- Vollsuite: 185 Tests bestanden.
- ZIP-Kopie: 24 zentrale Tests bestanden; die Downloadfehlerregression wurde anschließend ebenfalls aus der frisch entpackten Kopie ausgeführt.
- Echte Pages-/D1-/R2-/Browser-Datenintegration: bestanden. `q=Datei` liefert korrekt die Lead-IDs 1 und 2, weil sowohl Firmenname als auch Anzeigename durchsucht werden; `q=Synthetik` liefert nur ID 1, eine Suche ohne Treffer liefert eine leere Liste.
- Derselbe echte Browserlauf prüfte Suche, Statusfilter/Detailnavigation, Statuswechsel mit Neuladen, R2-Download mit Dateiname/Inhalt sowie Freigabe und Ablehnung; es wurden keine simulierten API-Antworten verwendet.
- Lokale Vorschau für die manuelle Abnahme läuft unter `https://127.0.0.1:8901/internal/` mit sichtbarem Chrome, echtem JWT-Header und isolierten synthetischen D1-/R2-Daten.

### Übersprungen

- 0 Tests übersprungen.

## Pflichtnachweise

Chrome wurde unter `C:\Program Files\Google\Chrome\Application\chrome.exe` verwendet. Die lokalen D1-, R2-, Auth-, Review- und Browsernachweise sind ausgeführt. Die manuelle Abnahme bleibt als separate Nutzerprüfung offen; der automatisierte echte Backend-/Browsernachweis ist kein Ersatz dafür.

Keine produktiven Daten, Zugangsdaten, Access-Konfigurationsänderungen, Remote-Migrationen, Commits oder Pushes wurden verwendet. Das genannte Preview-Deployment und die zeitlich begrenzte Preview-Gate-Öffnung sind als tatsächliche Preview-Nachweise dokumentiert; die aktuelle lokale Release-Prüfung ist davon getrennt und beweist keine Identität mit diesem Deployment.

## Noch offene Pflichtnachweise

- Prüfziel: HTTP-Status und Antwortkörper der manuellen Freigabe- und Ablehnungs-POSTs. Vorhanden: Browserbeobachtung und strukturierte D1-/Auditnachweise; die Ablehnungsantwort `200/ok/security_status=rejected` wurde in einem früheren lokalen Pages-/D1-/R2-Lauf aufgezeichnet, nicht für diese beiden Preview-Aktionen. Nächste Prüfung: nur bei einer ausdrücklich neuen Abnahme die beiden Netzwerkantworten erfassen.
- Prüfziel: Produktionsfreigabe einschließlich produktiver Bindings, Migrationen und Rückfall. Vorhanden: aktuelle anonyme Access-Prüfung für Preview, Deployment-URL, Apex und `www`; interne Inhalte wurden nicht ausgeliefert. Nächste Prüfung: separater Produktions-Readiness- und Freigabeablauf für produktive Bindings und Migrationen.
