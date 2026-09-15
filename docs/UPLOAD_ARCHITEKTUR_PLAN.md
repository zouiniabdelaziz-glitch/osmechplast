# Architekturplan: privater Upload technischer Anfrageunterlagen

**Status:** Analyse und Planung, keine Implementierung (2026-09-15)

Dieser Plan betrifft ausschließlich einen später freizugebenden Upload. In diesem Arbeitsschritt wurden keine Website-Dateien, Cloudflare-Ressourcen, D1-Tabellen oder Abhängigkeiten geändert. Die vorhandenen uncommitteten Änderungen bleiben unangetastet.

## 1. Ist-Zustand

- Statische HTML-/CSS-/JavaScript-Website, Eleventy 3.1.6 (`package.json`), Auslieferung über Cloudflare Pages.
- Pages Functions enthalten serverseitiges JavaScript; `functions/api/leads.js` ist der einzige relevante API-Endpunkt. Persistenter Speicher ist aktuell D1 (`env.DB`), Referenz in `schema.sql`.
- `kontakt/index.html` und `modules/kontakt.html` enthalten ein Formular `#leadForm` mit `f_company`, `f_name`, `f_email`, `f_phone`, `f_service`, `f_msg`, aber kein Datei-Input.
- `js/app.js` (`saveLead`/`submitForm`) sendet ausschließlich JSON an `/api/leads`; kein `FormData`/Multipart.
- `functions/api/leads.js` akzeptiert nur `application/json`, streamt und begrenzt den Body auf 16.384 Bytes, validiert Felder und schreibt in `leads`. `GET` liefert 405, `OPTIONS` 204.
- `schema.sql` enthält aktuell `leads(id INTEGER PRIMARY KEY AUTOINCREMENT, company, name, email, phone, service, message, ai_analysis, language, source, status, created_at)`; keine Uploadtabelle.
- `modules/07_contact.html` enthält altes, nicht eingebundenes Markup (`#uploadZone`, `#sketchFile`, `handleFileUpload`, `accept="image/*,.pdf"`). Es ist kein aktiver Uploadpfad und wird nicht reaktiviert.
- `.pages.yml` konfiguriert nur Pages CMS für Wissen-Bilder/Inhalte. Es gibt kein R2-Binding und keine `wrangler.toml/json`-Datei. `_headers`/`_redirects` enthalten keinen Uploadspeicher oder Downloadpfad.
- `docs/WEBSITE_MASTER_PLAN.md` (M1.2/M1.5) und `docs/WEBSITE_IMPLEMENTATION_PLAN.md` (P1-T4B) sehen privaten R2-Speicher, Binding `RFQ_UPLOADS`, additive Metadatenmigration, Fakes und Cleanup vor; diese Dateien bleiben unverändert. Im Repository ist **weder eine aktive Rate-Limiting-Regel noch Turnstile** implementiert; offene Dokumentationspunkte sind kein Nachweis einer vorhandenen Regel.
- Arbeitsbaum vor diesem Plan: offene P0-Änderungen u. a. in `kontakt/index.html`, `modules/kontakt.html`, `modules/faq.html`, `modules/header.html`, `js/translations.js`, `leistungen/index.html`, `tests/site-integrity.test.mjs`. Sie sind nicht Uploadbestandteil.

## 2. Risiken

1. Technische Zeichnungen sind vertraulich; öffentliche R2-URLs, `r2.dev` oder öffentliche Buckets sind unzulässig.
2. Endung, Browser-MIME und deaktivierter Button sind nicht vertrauenswürdig; alles muss serverseitig geprüft werden.
3. R2 und D1 sind nicht atomar; nach Teilfehlern können Orphans entstehen.
4. Große/viele Dateien verursachen Laufzeit-, Speicher-, R2- und D1-Missbrauch.
5. Öffentliches Formular ist ohne Rate Limit/Turnstile automatisierbar.
6. Erlaubte Endungen können falsche Inhalte (HTML, SVG, EXE) verbergen.
7. Originalnamen können Firmen-/Personendaten enthalten und dürfen nicht in URLs/Logs erscheinen.
8. Eine Uploadänderung darf bestehende JSON-Clients nicht brechen.
9. Es gibt keinen authentifizierten Mitarbeiter-Download; eine öffentliche Downloadroute wäre ein Datenleck.
10. 90 Tage Aufbewahrung ist eine technische Empfehlung, keine Rechtsfreigabe.

## 3. Empfohlene Architektur

Empfehlung: **privater R2-Bucket, Upload ausschließlich über die Pages Function**. `/api/leads` akzeptiert weiterhin JSON ohne Datei und zusätzlich `multipart/form-data`; so bleibt der vorhandene Browserweg kompatibel. Eine Cloudflare-Rate-Limit-Regel und Turnstile sind **neu einzurichtende Schutzmaßnahmen**, keine vorhandenen Funktionen. Browser-zu-R2-Presigned-URLs sind für diesen kleinen vertraulichen Upload nicht die erste Wahl: sie sind Bearer-Tokens und Cloudflare dokumentiert für Presigned URLs GET/HEAD/PUT/DELETE, nicht HTML-Multipart-POST. Quelle: [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

| Variante | Schutz | Voraussetzung | Risiko/Wartung | Entscheidung |
|---|---|---|---|---|
| Pages Function → privates R2 | zentrale Prüfung, keine öffentliche URL | R2-Bucket + Binding | eigener Cleanup-/Metadatenpfad | **Empfohlen** |
| Browser → Presigned R2 | weniger Function-Last | Presign-Endpoint, Ablauf-/Replaylogik | Bearer-Leak, komplexer | später prüfen |
| Externer Dienst | fertige Upload-/Malwarefunktionen | Vertrag, DPA, API/Webhook | Datenweitergabe/Kosten | nicht ohne Freigabe |

Empfohlene Anwendungslimits: **5 Dateien**, **8 MiB je Datei**, **16 MiB Multipart-Gesamtrequest** (bewusste Projektgrenzen, keine Cloudflare-Hardlimits), Endungen `.pdf`, **ASCII-`.dxf`**, `.step`, `.stp`, `.jpg`, `.jpeg`, `.png`. Binary-DXF wird im ersten Stand abgelehnt. JSON ohne Datei behält 16 KiB. R2 Storage Class Standard; eine differenzierte Aufbewahrungslogik wird in Abschnitt 6 festgelegt.

## 4. Datenfluss

1. Formular bleibt anonym nutzbar; Browserprüfung ist nur UX.
2. `js/app.js` sendet bei Dateien `FormData`, ohne Dateien weiterhin den vorhandenen JSON-Pfad.
3. `functions/api/leads.js` prüft Host/Methode/Content-Type, Content-Length soweit vorhanden, Streamgröße, Dateianzahl und Felder vor jedem Schreibvorgang.
4. Jede Datei wird nach Endung, MIME-Kandidaten, Größe und Signatur geprüft; Turnstile ist für JSON und Multipart Pflicht und wird serverseitig vor D1/R2 verifiziert.
5. Der Client erzeugt eine zufällige Request-ID; der Server validiert sie, erzeugt Lead-ID und Objekt-UUID. Jede Datei startet mit `security_status=quarantine`; der Originalname wird nur bereinigt als Metadatum gespeichert.
6. Lead zunächst mit `storage_status=pending`, danach R2-Puts über `env.RFQ_UPLOADS`, D1-Metadaten und Status `stored`.
7. Erfolg erst nach allen Schritten. Quarantäne bleibt bis zur autorisierten Freigabe bestehen. Im ersten Stand dürfen ausschließlich berechtigte Mitarbeiter Quarantäneobjekte über die Access-Route als Attachment zur manuellen Prüfung herunterladen; Kunden und Öffentlichkeit erhalten keinen Abruf. Der Access-geschützte Mitarbeiterabruf ist Bestandteil dieses Arbeitspakets.

## 5. Vorgeschlagenes D1-Schema

Additive Migration (Backup/Schemaexport und Freigabe vor live):

```sql
CREATE TABLE IF NOT EXISTS lead_uploads (
  id TEXT PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_status TEXT NOT NULL CHECK (storage_status IN ('pending','stored','delete_pending','deleted','failed')),
  security_status TEXT NOT NULL CHECK (security_status IN ('quarantine','approved','rejected')),
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  error_code TEXT,
  approved_by TEXT,
  approved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_uploads_lead_id ON lead_uploads(lead_id);
```

Kein Datei-BLOB in D1. `lead_id` referenziert die bestehende INTEGER-ID; `object_key` ist eindeutig; `error_code` enthält nur Kategorien. `storage_status` beschreibt den technischen Speicherzustand; `security_status` nur Quarantäne/Freigabe/Ablehnung. Geschäftsstatuswerte (`rejected`, `offer_open`, `offer_expired`, `order_active`, `order_closed`) gehören in `leads` oder ein Auftragsmodell, nie in `lead_uploads`.

## 6. Vorgeschlagene R2-Objektstruktur

Privater Bucket `osmp-rfq-uploads`, kein `r2.dev`, keine öffentliche Custom Domain:

```text
leads/{lead-id}/{random-uuid}.{allowlisted-extension}
```

Nie Originalnamen als Schlüssel verwenden; zufällige UUID und kollisionssicheres Put (z. B. `onlyIf`) verwenden. Ein pauschales „90 Tage alles löschen“ wird **nicht** eingerichtet. Lifecycle-Regeln dürfen nur einen ausdrücklich freigegebenen Quarantäne-/Orphan-Prefix betreffen; laufende Angebote und Aufträge bleiben von automatischer Löschung ausgenommen. Cloudflare nennt typischerweise bis zu 24 Stunden für Lifecycle-Löschungen. Quelle: [R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

### Aufbewahrungsmodell

| Zustand | Startregel | Automatische Löschung |
|---|---|---|
| Abgebrochener Upload | `storage_status=pending` ohne vollständige Zuordnung | nach 24 Stunden, nach Audit |
| R2-Orphan | Objekt ohne passende `lead_uploads`-Zeile | Quarantäne, täglicher Abgleich; nach 7 Tagen löschen |
| Abgelehnte Anfrage | Geschäftsstatus am Lead; Upload bleibt separat `storage_status=stored`, `security_status=quarantine/approved` | nach 30 Tagen nur nach Freigabe |
| Offenes Angebot | Geschäftsstatus am Lead/Auftrag, nicht an Uploadzeile | nicht automatisch löschen |
| Abgelaufenes Angebot | Geschäftsstatus am Lead/Auftrag | nach 90 Tagen nach Ablauf, nach Freigabe |
| Angenommener Auftrag | Geschäftsstatus am Lead/Auftrag | nicht automatisch löschen |
| Abgeschlossener Auftrag | Geschäftsstatus am Lead/Auftrag | Frist durch Inhaber/Datenschutz festlegen |

Alle Werte sind technische Vorschläge und benötigen fachliche/rechtliche Freigabe. Lifecycle darf nur Quarantäne-/Orphan-Objekte löschen; laufende Angebote und Aufträge sind ausgeschlossen.

## 7. Sicherheitsregeln

### Request und Dateien

- Maximal 5 Dateien/8 MiB je Datei/16 MiB gesamt; Überschreitung `413 payload_too_large`, kein D1-/R2-Schreiben.
- `Content-Length` früh prüfen, danach Body/Multipart begrenzen; nicht unbeschränkt `request.text()` verwenden.
- Unerwartete Multipart-Felder/Status-/ID-Felder ablehnen; bestehende Feld-Allowlisten beibehalten.
- MIME-/Formatentscheidung: `application/octet-stream` wird bei CAD-Dateien **nicht pauschal abgelehnt**, sondern nur zusammen mit zulässiger Endung, Größe, passender Struktur und fehlenden aktiven Signaturen akzeptiert.

| Endung | Gemeldeter MIME-Typ | erforderliche Signatur/Struktur | Ergebnis |
|---|---|---|---|
| `.pdf` | `application/pdf` | `%PDF-` | Quarantäne |
| `.png` | `image/png` oder `application/octet-stream` | PNG-Signatur | akzeptieren |
| `.jpg/.jpeg` | `image/jpeg` oder `application/octet-stream` | `FF D8 FF` | akzeptieren |
| `.step/.stp` | `model/step`, `application/step`, `text/plain` oder `application/octet-stream` | ASCII mit `ISO-10303-21;` und plausibelem Abschluss | akzeptieren |
| `.dxf` | `image/vnd.dxf`, `application/dxf`, `text/plain` oder `application/octet-stream` | ASCII mit `SECTION`/`ENDSEC` | akzeptieren |
| beliebig | beliebig | `MZ`, ELF, Shebang, HTML/SVG/JavaScript oder unpassend | ablehnen |

**DXF-Entscheidung:** Im ersten Stand wird ausschließlich ASCII-DXF akzeptiert. Binary-DXF wird abgelehnt, weil im schlanken Function-Pfad keine verlässliche Strukturprüfung vorgesehen ist; die Kundenmeldung nennt ausdrücklich „Binary-DXF wird derzeit nicht unterstützt; bitte ASCII-DXF senden“. Eine spätere Binary-DXF-Unterstützung benötigt einen geprüften Parser.
- `MZ`, ELF, Shebang, HTML/SVG/JavaScript und andere aktive Inhalte auch bei erlaubter Endung ablehnen. SHA-256 intern berechnen; nicht an Analytics senden.

### PDF- und Schadsoftware-Risiko

Magic Bytes bestätigen nur den Dateityp; sie erkennen **keine Schadsoftware**. PDFs können JavaScript oder eingebettete Dateien enthalten. Startschutz für **alle** Dateitypen: `security_status=quarantine`, keine Browser-Vorschau/Inline-Auslieferung, Abruf nur als `Content-Disposition: attachment` mit `X-Content-Type-Options: nosniff`, restriktiver CSP und ohne öffentliche URL. Eine Datei erhält `approved` ausschließlich nach manueller Prüfung durch einen berechtigten Mitarbeiter über die Access-Route; `rejected` setzt ebenfalls ein berechtigter Mitarbeiter. Es wird keine automatische Schadsoftwareprüfung behauptet. Ohne Scanner ist Malwarefreiheit nicht nachgewiesen; Mitarbeiter prüfen Downloads in geeigneter Umgebung.

### Abuse und Datenschutz

- **Neu einzurichten:** Cloudflare-Rate-Limit für `/api/leads`, zunächst pro IP. Das Repository belegt keine bestehende Regel.
- **Neu einzurichten:** Turnstile Managed Challenge. Tokens werden serverseitig über `https://challenges.cloudflare.com/turnstile/v0/siteverify` geprüft; sie sind fünf Minuten gültig und einmalig. Quelle: [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- Rückwärtskompatibilität: Das einzige aktive Browserformular erhält Turnstile für **alle** Browseranfragen. JSON ohne Datei und Multipart mit Datei werden gleich geprüft; beide werden ohne gültigen Token abgelehnt. Es gibt keinen Production-Bypass. Lokale Tests nutzen ausschließlich getrennte Testschlüssel/Testmodus.
- Secret nur als Pages Secret, niemals im Bundle/Git. Fehlermeldungen neutral, Logs ohne Datei-/Kontaktinhalte.
- Free-Rate-Limit hat eingeschränkte Ausdrucksfelder; aktuelle Methode-/Pfadfähigkeit vor Einrichtung prüfen. Quelle: [Cloudflare Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).
- Formularhinweis/Datenschutz müssen CAD-Dateien, Zweck, Empfänger, Zugriff und Löschfrist enthalten. R2 verschlüsselt at rest und nutzt TLS in transit: [R2 data security](https://developers.cloudflare.com/r2/reference/data-security/).

## 8. Fehler- und Wiederherstellungsverhalten

| Situation | Verhalten |
|---|---|
| Ungültige Felder/Endung/MIME/Signatur/Größe | 400/413, neutrale Meldung, kein Schreibvorgang |
| Rate Limit/Turnstile | 429/403, kein Schreibvorgang |
| D1 vor R2 fehlgeschlagen | Kein Lead, kein R2-Objekt, 503. |
| D1-Lead → R2 → D1-Metadaten erfolgreich | Lead entsteht mit Geschäftsstatus unverändert und Upload `storage_status=pending`; Objekte/Zeilen entstehen; danach `storage_status=stored`, `security_status=quarantine`; Erfolg erst nach Statusupdate. |
| R2 teilweise fehlgeschlagen | Bereits geschriebene Objekte synchron löschen; Uploadzeilen `storage_status=failed`; Lead bleibt ohne Erfolg; 503. Löschfehler werden als Orphan auditiert. |
| R2 vollständig, D1-Metadaten fehlgeschlagen | R2 synchron löschen; Uploadzeilen `delete_pending`/`failed`; Lead bleibt ohne Erfolg; 503. Objekt ohne Metadatenzeile ist Orphan. |
| Statusupdate fehlgeschlagen | Upload bleibt `storage_status=pending` und `security_status=quarantine`; Cleanup findet Einträge älter als 24 Stunden und löscht erst nach Audit. Kein Erfolg. |
| Antwortverlust | keine blinde Wiederholung ohne Idempotency-Key |
| Doppelklick | UI-Sperre plus serverseitige Idempotency-Strategie |

Die Reihenfolge D1-Lead → R2 → D1-Metadaten bleibt wegen der bestehenden INTEGER-Lead-ID praktikabel, wenn getrennte Storage-/Security-Status und Cleanup vorhanden sind. Eine R2-zuerst-Variante hätte ohne vorab erzeugte UUID-Lead-ID keine robuste Zuordnung. Keine Schlüssel, SQL-Fehler oder Stacktraces an Kunden senden; Erfolgsevent erst nach D1 **und** R2.

## 8a. Mitarbeiterzugriff (ab Betriebsstart)

| Lösung | Schutz | Aufwand | Empfehlung |
|---|---|---|---|
| Interne Pages-/Worker-Route mit Cloudflare Access | Access authentifiziert Mitarbeiter; Function prüft Gruppe/Rolle serverseitig, lädt privat aus R2 und protokolliert Downloads | mittel | **Empfohlen** |
| R2 S3/API mit verwalteten Mitarbeiter-Secrets | Bucket privat, aber Secret-/Clientbetrieb und Audit liegen vollständig beim Betrieb | höheres Leakrisiko | Alternative |

Minimal betriebsfähig bedeutet: privater Bucket, Access vor der internen Route, Rollenprüfung bei jedem Abruf, Auditlog mit Mitarbeiter-ID/Lead-ID/Objekt-ID/Zeit, Attachment-Download mit sicheren Headern, keine dauerhaften öffentlichen Links. Ohne diesen Zugriff ist der Upload nicht produktionsreif. Siehe [R2 Access tutorial](https://developers.cloudflare.com/r2/tutorials/cloudflare-access/).

Konkrete Route: `GET /internal/leads/{leadId}/uploads/{uploadId}` als separate Pages Function. Dafür wird eine Cloudflare-Access-**Self-hosted Application** auf dieser Route angelegt. Die Access-Policy lautet `Allow`, Include nur die ausdrücklich freigegebenen Mitarbeiter oder eine dedizierte Mitarbeitergruppe; kein Bypass. Die Function prüft den von Access gesetzten Header `Cf-Access-Jwt-Assertion` kryptografisch gegen `TEAM_DOMAIN/cdn-cgi/access/certs`, `iss=TEAM_DOMAIN`, `aud=POLICY_AUD` sowie Ablaufzeit. `TEAM_DOMAIN` (z. B. `https://<team>.cloudflareaccess.com`) und `POLICY_AUD` (Application-Audience-Tag) sind Secrets/Umgebungsvariablen, keine Bindings. Fehlender, ungültiger, abgelaufener oder falsch audience/issuer-bezogener JWT ergibt neutral `403`; erst danach wird anhand der Mitarbeitergruppe/Identität und der Lead-Zuordnung aus D1 autorisiert. Quellen: [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) und [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).

## 9. Notwendige Cloudflare-Bindings

| Binding | Typ | Zweck |
|---|---|---|
| `DB` | bestehendes D1 | Leads/Metadaten |
| `RFQ_UPLOADS` | privates R2 | technische Dateien |
| `TURNSTILE_SECRET` | Secret | Siteverify, neu einzurichten |

Dashboard: **Workers & Pages → Projekt → Settings → Bindings → Add → R2 bucket**, Name `RFQ_UPLOADS`, Bucket wählen, danach deployen. Production und Preview getrennt binden. Quelle: [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/). Lokal kann `wrangler pages dev _site --r2=RFQ_UPLOADS` genutzt werden; lokale Bindings ändern nicht automatisch Production/Preview: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

## 9a. Cleanup-Lösung

| Lösung | Eignung | Entscheidung |
|---|---|---|
| Separater Worker mit Cron Trigger | wiederholbar, begrenzte Batches, unabhängig vom Kundenverkehr | **Empfohlen** |
| Access-geschützter Wartungsendpunkt | einfach manuell, aber vergessens-/timeoutanfällig | Reserve |
| Lokales Wartungsskript | keine zusätzliche Runtime, aber Rechner/Secrets müssen verfügbar sein | nicht als Betriebsstandard |

Für den ersten Stand wird ein separater Worker `workers/upload-cleanup.js` mit täglichem Cron Trigger gewählt. Er erhält ein privates R2-Binding `RFQ_UPLOADS` und ein D1-Binding `DB`; keine öffentliche Route. Pro Lauf werden höchstens 100 Datensätze/Objekte bearbeitet. Die Auswahl ist deterministisch und wiederholbar:

- `storage_status=pending` älter als 24 Stunden: R2-Key prüfen, löschen, Zeile auf `deleted` setzen.
- `storage_status=failed` oder `delete_pending`: Löschung erneut versuchen; Erfolg → `deleted`, Fehler → `delete_pending` plus Fehlercode/Zeitstempel im Auditlog.
- R2-Objekte unter `leads/` ohne passende D1-Zeile: als Orphan markieren, nach 7 Tagen Quarantäne löschen.
- D1-Zeilen ohne R2-Objekt: `failed`/`deleted` dokumentieren; nicht erneut als vorhanden ausgeben.
- Geschäftsstatus des Leads/Auftrags wird gelesen; `offer_open`, `offer_expired`, `order_active` und `order_closed` sind keine Uploadstatus und schützen laufende/aufbewahrungspflichtige Objekte vor Lifecycle-Löschung.
- Jeder Löschversuch erhält eine eindeutige Audit-ID; Wiederholung ist idempotent, weil `DELETE` auf ein fehlendes Objekt als bereits erledigt behandelt wird.

Betroffene spätere Komponenten: `workers/upload-cleanup.js`, Worker-Cron-Konfiguration, `RFQ_UPLOADS`-/`DB`-Bindings und eine interne Audit-/Statusauswertung. Keine Cleanup-Lifecycle-Regel darf laufende Angebote oder Aufträge erfassen.

## 10. Betroffene Dateien

Nach Freigabe voraussichtlich: `modules/kontakt.html`, `kontakt/index.html`, `js/app.js`, `js/translations.js`, `functions/api/leads.js`, `functions/internal/leads-uploads.js`, `schema.sql`, neue `migrations/0002_lead_uploads.sql`, `workers/upload-cleanup.js`, `tests/lead-form.test.mjs`, `tests/leads-api.test.mjs`, `tests/upload-download.test.mjs`, `tests/upload-cleanup.test.mjs`, `tests/site-integrity.test.mjs`. Datenschutzfluss und `datenschutz/index.html` erst nach realer Datenfluss-/Rechtsprüfung. `modules/07_contact.html` bleibt ungenutzt.

## 10a. Idempotency

Der Client erzeugt pro Absendevorgang eine zufällige UUID als `request_id` (Format UUIDv4/`crypto.randomUUID()`) und sendet sie in FormData bzw. JSON. Der Server akzeptiert nur dieses Format und speichert es in einer eigenen Tabelle:

```sql
CREATE TABLE lead_requests (
  request_id TEXT PRIMARY KEY,
  lead_id INTEGER,
  state TEXT NOT NULL CHECK (state IN ('processing','succeeded','failed')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  error_code TEXT
);
```

Vor dem Lead-Insert wird `request_id` atomar eingefügt. Existiert sie bereits, wird bei `processing` neutral `409 request_in_progress`, bei `succeeded` das idempotente Erfolgsergebnis ohne zweiten Lead und bei `failed` nur nach neuer Request-ID erneut verarbeitet. Die Daten werden 30 Tage aufbewahrt; Cleanup löscht alte Zeilen in begrenzten Batches. Ein Doppelklick und Netzwerk-Retry mit derselben ID erzeugen daher keinen zweiten Lead. Tests: parallele gleiche IDs, Erfolg-Retry, laufender Retry, Fehler-Retry, ungültiges Format und Ablauf-Cleanup.

## 10b. Umsetzungspakete

| Paket | Dateien/Komponenten | Tests | Abnahme | Abhängigkeiten |
|---|---|---|---|---|
| A Datenmodell, Parser, Tests | `schema.sql`, `migrations/0002_lead_uploads.sql`, `tests/leads-api.test.mjs` | Status-/Idempotency-/Signatur-/Limit-Fakes | getrennte Statusfelder, rote Tests grün | keine Produktivänderung |
| B Upload-API/R2 | `functions/api/leads.js`, R2-Binding | R2-/D1-Erfolg/Teilfehler | privat zugeordnet, kein Erfolg bei Teilfehler | Paket A, Preview-Bucket |
| C Formular/Turnstile | `modules/kontakt.html`, `kontakt/index.html`, `js/app.js`, `js/translations.js` | FormData, Fehler, Turnstile vor Write | alle Browseranfragen geschützt | Paket B, neue Turnstile-Konfiguration |
| D Mitarbeiterdownload/Audit | `functions/internal/leads-uploads.js`, `tests/upload-download.test.mjs` | JWT fehlt/falsch, Gruppe, Header, Audit | Access + serverseitige Rolle + Attachment | Paket B, Access-App |
| E Cleanup | `workers/upload-cleanup.js`, `tests/upload-cleanup.test.mjs` | pending/failed/orphan/delete_pending, Batch, Retry | täglicher idempotenter Cleanup | Paket A/B, Cron |
| F Preview/Datenschutz/Freigabe | `docs/PRIVACY_DATA_FLOW.md`, `datenschutz/index.html`, Preview-/Production-Bindings | E2E synthetisch, Build, Privacy-Review | getrennte Bindings, Texte, keine öffentliche R2-Adresse | A–E, Inhaberfreigabe |

Kein Paket darf ohne gesonderte Cloudflare-Produktivfreigabe Bindings, Access-Apps, R2, Cron oder D1 live ändern.

## 11. Testplan

- JSON ohne Datei: genau ein Lead; GET 405; OPTIONS 204.
- Gültige synthetische PDF/DXF/STEP/STP/JPG/JPEG/PNG akzeptiert; falsche Endung, MIME, Magic Bytes, HTML/SVG, EXE, leere/beschädigte Dateien abgelehnt.
- 6. Datei, 8 MiB + 1 Byte, 16 MiB + 1 Byte und falscher/fehlender `Content-Length` sicher behandeln; Streaming zählt Bytes.
- Keine D1-/R2-Schreibvorgänge bei Ablehnung.
- R2-/D1-Fakes für Erfolg, Teilfehler, Cleanup und Doppelklick; zufällige Schlüssel, keine Originalnamen, kein Überschreiben.
- Turnstile gültig/ungültig/abgelaufen/Replay; Secret nie im Browser.
- Keine öffentliche GET-/Downloadroute; R2-Objektzugriff nur intern.
- Preview-Ende-zu-Ende ausschließlich mit synthetischen Dateien und separaten Preview-Bindings.

## 12. Lokale Prüfschritte

`git status --short --branch`/`git diff` prüfen; Fakes oder ausdrücklich konfigurierte lokale R2-Bindung verwenden; keine Secrets in Dateien speichern; `npm test`, `npm run build`; `wrangler pages dev _site --r2=RFQ_UPLOADS` nur nach Freigabe; synthetische Multipart-Requests testen; Server beenden, Port und `_site`/Testobjekte bereinigen.

## 13. Deployment-Schritte

1. Inhaber bestätigt Formate, 5/8/16-MiB-Grenzen, Status-/Aufbewahrungsmodell, Rollen und Datenschutz.
2. Preview-R2-Bucket privat anlegen, Lifecycle setzen, Preview-Bindings konfigurieren.
3. D1-Backup/Schemaexport, additive Migration reviewen und in Preview ausführen.
4. Rote Tests schreiben, Function-/FormData-Zweig und Cleanup implementieren.
5. **Neue** Turnstile- und Rate-Limit-Regeln einrichten; serverseitig testen.
6. Preview-Build/Ende-zu-Ende mit synthetischen Dateien abnehmen.
7. Datenschutz-/Formulartexte anhand des tatsächlichen Flusses aktualisieren.
8. Interne Access-Downloadroute mit serverseitiger Rollenprüfung und Auditlog bereitstellen.
9. Erst nach Freigabe Production-Binding/Lifecycle setzen und deployen; JSON und Multipart nur mit gültigem Turnstile unterstützen.

## 14. Aufwand

Grobe Schätzung: 0,5–1 Tag Review; 1–2 Tage Function/Migration/R2; 0,5–1 Tag Formular/Accessibility/Übersetzungen; 1–2 Tage Tests, Preview und Security-/Datenschutzreview; 0,5–1,5 Tage Access-Downloadroute und Auditlog. Keine verbindliche Zusage.

## Datenschutz vor Produktivstart

Zu dokumentieren und fachlich/rechtlich freizugeben sind: Zweck (technische Angebotsprüfung/Fertigungsanfrage), Dateitypen und Metadaten, Speicherort (privater R2-Bucket), berechtigte Mitarbeiterrollen, statusabhängige Aufbewahrung, Orphan-/Löschprozess, Zugriffsaudit, Turnstile/Cloudflare-Verarbeitung und ein klarer Hinweis direkt am Formular. Die Datenschutzerklärung muss den tatsächlichen Datenfluss abbilden. Rechtsgrundlage, Fristen, Auftragsverarbeiter und Drittlandangaben sind Inhaber-/Datenschutzfreigaben, keine Annahmen dieses Plans.

## Definition of Done

Betriebsfähig ist der Upload erst, wenn Kunden die sieben Formate innerhalb der 5/8/16-MiB-Grenzen senden können, Lead und Dateien privat und eindeutig verknüpft sind, Mitarbeiter über Access (oder gleichwertig) mit serverseitiger Rollenprüfung und protokolliertem Attachment-Download zugreifen, Erfolgs-/Validierungs-/Rate-Limit-/Turnstile-/R2-/D1-Teilfehler getestet sind, Datenschutztexte vor Production vorliegen, Preview und Production getrennte Bindings/Buckets besitzen, pending/orphan Cleanup getestet ist und keine öffentliche R2-Adresse oder dauerhafte öffentliche Links existieren.

## 15. Kosten und Free-Grenzen

Vor Umsetzung erneut prüfen. Laut [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) gelten derzeit 10 GB-month Standard, 1 Mio. Class-A- und 10 Mio. Class-B-Operationen monatlich kostenlos, Egress kostenlos; darüber 0,015 USD/GB-month, 4,50 USD/Mio. Class A und 0,36 USD/Mio. Class B. Standard ist für kleine seltene CNC-Anhänge sinnvoll; Infrequent Access hat Retrieval-/Mindesthaltungsregeln.

Laut [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) umfasst Workers Free derzeit 5 Mio. gelesene Zeilen/Tag, 100.000 geschriebene Zeilen/Tag und 5 GB Speicher; Überschreitungen können Queries bis zum Reset fehlschlagen. [R2 Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/) beschreibt Single Upload für kleine/mittlere Objekte (unter ca. 100 MB) und 5-GiB-Objektmaximum; die Projektgrenzen bleiben absichtlich viel kleiner. Tarif-/Nutzungsänderungen sind möglich; aus diesen Zahlen keine Kostenfreigabe ableiten.

## 16. Umsetzungsreihenfolge

1. Profil und Datenschutz/Rollen freigeben.
2. Privates Preview-R2 und `RFQ_UPLOADS` vorbereiten.
3. Additive `lead_uploads`-Migration mit Backup reviewen.
4. Rote Parser-, Signatur-, Größen-, R2-/D1- und Rückwärtskompatibilitätstests schreiben.
5. Multipart-Zweig, Status- und Cleanuplogik implementieren.
6. Native Datei-UI, FormData, Übersetzungen und neutrale Fehler ergänzen.
7. Turnstile/Rate Limit serverseitig integrieren.
8. Datenschutzfluss aktualisieren und juristisch prüfen.
9. Unit/Build/Preview/E2E mit synthetischen Dateien abnehmen.
10. Interne Zugriffsmethode und Löschaudit festlegen.
11. Production-Bindings/Lifecycle nach schriftlicher Freigabe setzen und deployen.
12. Monatlich Orphans, Löschungen, D1/R2-Nutzung und Abuse-Metriken prüfen.

**Nächste Entscheidung:** privates R2 über Pages Function, `RFQ_UPLOADS`, 5 Dateien, 8 MiB je Datei, 16 MiB je Anfrage, PDF/ASCII-DXF/STEP/STP/JPG/JPEG/PNG, getrennte `storage_status`-/`security_status`-Felder, Signatur-/Quarantäneprüfung, neu einzurichtendes Turnstile plus Rate Limit und geschützter Mitarbeiterzugriff. Bis zur ausdrücklichen Freigabe wird kein produktiver Code geschrieben.

## Widerspruchsprüfung dieses Plans

| Suchbegriff | Gefundene Stelle | Prüfung/Ergebnis |
|---|---|---|
| `optional` | Malware-/Sandbox-Scanner | Bewusst optional als spätere Zusatzmaßnahme; es wird keine automatische Prüfung behauptet. Turnstile ist nicht optional. |
| `später` | Presigned-R2-Variante, spätere Binary-DXF-Unterstützung, rechtliche Freigaben | Bewusst als nicht ausgewählte Folgeoption bzw. Freigabe formuliert; der Startumfang ist eindeutig. Mitarbeiterzugriff und Cleanup sind nicht auf später verschoben. |
| `quarantine` | R2-Objektstruktur, Security-Regel, Datenfluss, DoD | Vereinheitlicht: jede Datei startet `security_status=quarantine`; nur berechtigte Mitarbeiter dürfen sie als Attachment prüfen. |
| `status` | D1-Schema und Tabellen | Getrennt in `storage_status` und `security_status`; Geschäftsstatus bleibt am Lead/Auftrag. |
| `Binding` | Cloudflare-Bindings | Nur `DB` und `RFQ_UPLOADS` sind Bindings; `TEAM_DOMAIN`/`POLICY_AUD` sind Umgebungsvariablen/Secrets, kein `UPLOAD_ADMIN_ACCESS`-Binding. |
| `Cleanup` | Lifecycle und separater Worker | Festgelegt: `workers/upload-cleanup.js` mit täglichem Cron, maximal 100 Elemente je Lauf, idempotente Wiederholung, Orphan-/`delete_pending`-Audit. |
| `Idempotency` | `lead_requests` | Festgelegt: Client-UUID, eindeutiger D1-Schlüssel, Zustände `processing/succeeded/failed`, 30 Tage Aufbewahrung und definierte Retry-Antworten. |

Damit bestehen keine widersprüchlichen Aussagen mehr zu Turnstile, Quarantäne, Mitarbeiterzugriff, Statusfeldern oder Cleanup. Der einzige verbleibende Vorbehalt ist die ausdrücklich noch erforderliche Inhaber-/Datenschutzfreigabe der vorgeschlagenen Fristen und Rollen.
