# Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Vor jeder funktionalen Korrektur ist `superpowers:test-driven-development`, bei Fehlern `superpowers:systematic-debugging`, vor jeder Erfolgsmeldung `superpowers:verification-before-completion` und nach einer größeren abgeschlossenen Phase `superpowers:requesting-code-review` zu verwenden.

**Goal:** Den freigegebenen Website-Masterplan phasenweise umsetzen, beginnend mit einem korrekten, sicheren und transparenten Anfrageweg, ohne Marke, Unternehmensfakten oder externe Systeme eigenmächtig zu verändern.

**Architecture:** Die bestehende statische HTML-/CSS-/JavaScript-Website, ihre Modul-Fallbacks und die Cloudflare Pages Function mit D1 bleiben die Ausgangsbasis. Änderungen erfolgen in sechs getrennten Phasen mit Abnahmetests und einer ausdrücklichen Inhaberfreigabe nach jeder Phase; marken-, upload-, indexierungs- und extern kontoabhängige Schritte bleiben bis zur jeweiligen Entscheidung blockiert.

**Tech Stack:** Statisches HTML5, CSS, Browser-JavaScript, Cloudflare Pages Functions, Cloudflare D1, optional privates Cloudflare R2 bei freigegebenem Upload, Node.js 26 mit eingebautem `node:test`, PowerShell/Python-HTTP-Server für lokale Prüfungen.

**Spec:** `docs/WEBSITE_MASTER_PLAN.md`

## Global Constraints

- Nur im Projekt `C:\Users\Director\Documents\Italien Firma\oscnc - Kopie` arbeiten; das ERP-System bleibt außerhalb des Umfangs.
- Der aktuelle Repository-Stand ist die verbindliche Ausgangsbasis; vorhandene fremde Änderungen bleiben erhalten.
- Keine neue Website, kein Relaunch und keine allgemeine SEO-/Wettbewerbsanalyse.
- Marke, Logo, Markenname und das Verhältnis zu OS.MECHPLAST SRLS erst nach dokumentierter Inhaberentscheidung ändern.
- Keine Zertifizierungen, Toleranzen, Kapazitäten, Lieferzeiten, Maschinenfähigkeiten, Werkstoffe, Kundenbeziehungen oder Rechtsangaben erfinden.
- ISO 9001 bleibt bis zu einem gültigen Nachweis ausschließlich als geplant bezeichnet; Edelstahl bleibt kein Standardwerkstoff.
- Kein zweites Analytics-System und keine doppelte GA4-/Clarity-Installation.
- Keine Seiten wegen alter SEO-Reports und keine künstlichen Mindestwortzahlen.
- Keine externen Profile, Kontoänderungen, Veröffentlichung, Live-Tests mit realer Lead-Erzeugung, Deployment oder Commits ohne ausdrückliche Freigabe.
- Jede Phase beginnt mit Ist-Prüfung und Abnahmekriterien, verwendet kleine zusammenhängende Änderungen und endet mit Tests, Diff-Prüfung, Dokumentation und Freigabestopp.
- `docs/WEBSITE_IMPLEMENTATION_PLAN.md` wird nach jedem Arbeitspaket mit Datum, Status, Dateien, Tests, Ergebnissen, Risiken und Blockaden aktualisiert.
- `docs/TASK_LOG.md` wird nach abgeschlossenen Aufgaben fortgeführt; `docs/PROJECT_STATUS.md` nur bei tatsächlicher Statusänderung und `docs/SEO_PAGE_MAP.md` nur bei ausdrücklich freigegebener Seiten-/SEO-Positionierungsänderung aktualisieren.

---

## 1. Planungsstand und Statusregeln

Stand: 2026-08-29  
Aktuelle Aktivität: Umsetzungsplan erstellt; noch keine Website-Implementierung begonnen.  
Zulässige Maßnahmenstatus: **offen**, **in Arbeit**, **blockiert**, **abgeschlossen**.

Eine Maßnahme ist erst **abgeschlossen**, wenn alle zugehörigen Abnahmekriterien mit frischen Testbelegen erfüllt und im Änderungsprotokoll dieses Dokuments eingetragen sind. „Extern konfiguriert“ darf nur nach einem überprüfbaren Screenshot, Export oder Live-Test als abgeschlossen gelten.

### Bereits vorhandene, zu bewahrende Änderungen

Der Git-Stand war vor Erstellung dieses Plans bereits nicht sauber. Verändert sind die sieben SEO-Reports und `sitemap.xml`; zusätzlich liegen unversionierte Audit-/Archiv-/CSV-Dateien und `docs/WEBSITE_MASTER_PLAN.md` vor. Diese Änderungen gehören nicht zur Phase-1-Implementierung und dürfen nicht überschrieben oder bereinigt werden.

## 2. Entscheidungen des Inhabers

| ID | Entscheidung | dokumentierter Stand | blockierte Maßnahmen | Status |
|---|---|---|---|---|
| D01 | Verbindliche öffentliche Marke: ONCC oder OSMP, einschließlich exakter Schreibweise | **OSMP**, vom Inhaber am 2026-08-29 bestätigt. Keine Umbenennung auf ONCC. | spätere Markenausrollung muss OSMP bewahren | abgeschlossen |
| D02 | Verhältnis der Marke zum juristischen Namen OS.MECHPLAST SRLS | **OSMP** ist die öffentliche Marke; **OS.MECHPLAST SRLS** ist der vom Inhaber am 2026-08-29 bestätigte juristische Name. Rechtliche Bereiche verwenden den vollständigen Firmennamen. | M4.3/M5.1 dürfen diese Trennung nicht verändern | abgeschlossen |
| D03 | Zeichnungs-Upload als echte sichere Funktion umsetzen oder vorläufig vollständig entfernen | **Vorläufig vollständig entfernen**, vom Inhaber am 2026-08-29 bestätigt. Ein späterer echter Upload ist ein neuer, gesondert freizugebender Auftrag. | P1-T4A ist freigegeben; P1-T4B bleibt bewusst ungenutzt | abgeschlossen |

Wenn D03 „echter Upload“ lautet, müssen in derselben Inhaberentscheidung außerdem erlaubte Dateiformate, maximale Dateigröße, Aufbewahrungsdauer, interne Zugriffsrollen und verantwortliche Person festgelegt werden. Ohne diese Werte wird kein Upload-Code umgesetzt.

## 3. Datei- und Verantwortungsplan

### Bestehende Dateien

| Datei | Verantwortung im Plan |
|---|---|
| `docs/WEBSITE_MASTER_PLAN.md` | Verbindliche fachliche Spezifikation und Maßnahmenquelle. |
| `docs/WEBSITE_IMPLEMENTATION_PLAN.md` | Laufender Status, Entscheidungen, Testbelege, Risiken und Phasenfreigaben. |
| `js/app.js` | Formularablauf, API-Aufruf, Lade-/Fehler-/Erfolgszustand, Modulinitialisierung, Upload-UI. |
| `functions/api/leads.js` | Serverseitige Anfragevalidierung, D1-Schreibvorgang, neutrale HTTP-Antworten; optional R2-Verknüpfung. |
| `schema.sql` | Referenzschema für Neuinstallationen; keine Live-Migration ohne gesondertes Migrationsskript. |
| `modules/kontakt.html` | Kanonische Formularquelle und Upload-/Datenschutzhinweis. |
| `modules/footer.html` | Kanonische Footerquelle und dauerhafter Datenschutzlink. |
| `kontakt/index.html` | Statischer Kontakt-Fallback; bis Phase 3 muss jede Phase notwendige Formular-/Footeränderungen synchron halten. |
| acht kanonische `index.html`-Dateien | Statische Header-/Footer-Fallbacks; Datenschutz-/Branding-/Social-/Markupänderungen müssen konsistent ausgerollt werden. |
| `js/analytics.js` | Bestehendes Consent- und Ereignistracking; nur notwendige Ereigniskorrekturen, keine zweite Installation. |
| `_redirects`, `_headers`, `robots.txt`, `sitemap.xml` | Routing, Header, Crawling und Sitemap; Änderungen erst in freigegebener Phase 2/4. |
| `js/translations.js` | Sprachtexte; aktiven Key-Graph erst in Phase 3 inventarisieren, nicht vorher pauschal bereinigen. |

### Geplante neue Dateien

| Datei | Phase | Zweck |
|---|---|---|
| `docs/PUBLIC_CLAIMS_REGISTER.md` | 0 | Prüfliste aller öffentlich verwendeten Unternehmens-/Leistungsbehauptungen mit Status und Belegverantwortung. |
| `docs/PRIVACY_DATA_FLOW.md` | 1 | Technisch verifizierter Datenfluss für Formular, D1, optional R2, Cloudflare, Analytics, Clarity, Fonts und gegebenenfalls E-Mail. |
| `tests/helpers/load-browser-script.mjs` | 1 | Browser-Skripte ohne Zusatzpakete in einem kontrollierten Node-VM-Kontext testen. |
| `tests/lead-form.test.mjs` | 1 | TDD-Tests für Erfolg, Validierung, Netzwerk, 4xx, 5xx, Ladezustand und Doppelklick. |
| `tests/leads-api.test.mjs` | 1 | TDD-Tests für Payload-Grenzen, Validierung, D1-Fehler und neutrale Antworten. |
| `tests/site-integrity.test.mjs` | 1–4 | Statische Prüfungen für Uploadreste, Datenschutzlinks, IDs, Anker, Canonicals, Sitemap und Assets. |
| `datenschutz/index.html` | 1 | Vollständiger technischer Entwurf mit klar markierten juristischen Prüfpunkten; erst nach D03 und realem Datenfluss öffentlich verlinken. |
| `404.html` | 2 | Oberste echte Cloudflare-Pages-404-Seite. |
| `docs/EXTERNAL_ACTIONS.md` | 0–5 | Exakte, nicht lokal ausführbare Cloudflare-/GSC-/GA4-/Rechts-/Profil-Schritte mit Verantwortlichem und Nachweis. |
| `migrations/0002_lead_uploads.sql` | 1, nur Upload-Zweig | Additive D1-Migration für private Objektmetadaten; CAD-Inhalt bleibt außerhalb D1. |

Es wird kein `package.json` nur für Tests angelegt. Die geplanten Tests verwenden die in Node.js 26 vorhandenen Module `node:test`, `node:assert`, `node:fs`, `node:path` und `node:vm`.

## 4. Maßnahmenregister und Traceability

| Maßnahme | Status | Arbeitspaket | betroffene Dateien/Systeme | vorgesehener Test/Nachweis | Abnahmekriterium | Abhängigkeit/Blockade |
|---|---|---|---|---|---|---|
| M0.1 Marke festlegen | abgeschlossen | P0-T1 | Plan, später Header/Footer/Metadaten/Schema/Assets/Übersetzungen | schriftliche Inhaberantwort und Fundstelleninventar | Marke, Schreibweise und juristischer Bezug sind für jede Verwendungsart eindeutig | D01 und D02 am 2026-08-29 beantwortet |
| M0.2 Fakten freigeben | abgeschlossen | P0-T2 | `docs/PUBLIC_CLAIMS_REGISTER.md`; acht Seiten, Module, aktive Übersetzungen read-only | 24 Registerzeilen und zulässige Statuswerte automatisiert geprüft | Jede Behauptung hat Fundstelle, Status, Belegverantwortlichen und zulässige Behandlung | Offene Inhaber-/Fertigungsbelege bleiben zeilenweise blockiert |
| M0.3 Messbaseline | abgeschlossen | P0-T3 | `docs/EXTERNAL_ACTIONS.md`; GSC, GA4, Cloudflare | 12 externe Aktionen sowie konkrete Nichtverfügbarkeiten dokumentiert | Jede externe Lücke hat System, benötigten Nachweis, Status und Phasenwirkung | Externe Beschaffung bleibt blockiert, lokale Phase 1 nicht |
| M1.1 Formularstatus korrigieren | offen | P1-T2 | `js/app.js`, `modules/kontakt.html`, `kontakt/index.html`, `js/translations.js`, Tests | `node --test tests/lead-form.test.mjs` | Nur 2xx zeigt Erfolg/Reset/Success-Event; Fehler behalten Eingaben; ein Request bei Doppelklick | keine Markenentscheidung nötig |
| M1.2 Zeichnungsweg | offen | P1-T4A | Kontaktmodul/-fallback, App/Analytics/Übersetzungen | Uploadreste-Nulltest und normales Formular als Regression | Kein Uploadversprechen und keine tote Uploadlogik; Anfrage ohne Datei funktioniert | D03: vorläufig vollständig entfernen |
| M1.3 Datenschutz | blockiert | P1-T5 | `docs/PRIVACY_DATA_FLOW.md`, `datenschutz/index.html`, Footer-/Kontaktmodule und Fallbacks, ggf. Analytics | Link-/Inhalts-/Consent-Prüfung plus juristischer Reviewstatus | Datenfluss und Entwurf stimmen überein; dauerhaft verlinkt; offene Rechtsangaben klar markiert | D03, realer Datenfluss, juristische Prüfung |
| M1.4 Uploadzugänglichkeit | offen | P1-T4A; entfällt nach vollständiger Entfernung | Kontaktmodul/-fallback, CSS/JS, Tests | Nachweis vollständiger Entfernung und Tastaturtest des verbleibenden Formulars | Keine unerreichbare Uploadbedienung verbleibt; Formular bleibt per Tastatur nutzbar | D03: vorläufig vollständig entfernen |
| M1.5 API-Schutz | offen | P1-T3/P1-T6 | `functions/api/leads.js`, API-Tests, `docs/EXTERNAL_ACTIONS.md`, externe Cloudflare-Regeln | `node --test tests/leads-api.test.mjs` plus Regel-Nachweis | Grenzen/Allowlist/neutrale Fehler bestehen; externe Schutzlücken sind ehrlich dokumentiert | Rate-Limit-Konfiguration extern teilweise blockiert |
| M2.1 echte 404 | blockiert | P2-T1 | `404.html`, Integritätstest, ggf. Cloudflare-Routing | Strukturtest und später Live-Test der sechs Fehlpfade | Alle Fehlpfade 404; acht kanonische URLs 200 | Freigabe nach Phase 1 |
| M2.2 www-Redirect | blockiert | P2-T2 | `docs/EXTERNAL_ACTIONS.md`, Cloudflare Redirect Rule, ggf. `_redirects` | HTTP/HTTPS × www/non-www × Pfaderhalt | genau eine dauerhafte Weiterleitung zur freigegebenen Hauptdomain | Freigabe und Cloudflare-Zugriff |
| M2.3 Sitemap | blockiert | P2-T3 | `sitemap.xml`, Integritätstest, ggf. `robots.txt` | XML-/Dubletten-/Canonical-/Statusprüfung | nur freigegebene kanonische 200-URLs; keine Redirects/noindex | Indexentscheidungen Impressum/Datenschutz |
| M2.4 GSC-Validierung | blockiert | P2-T4 | GSC, `docs/EXTERNAL_ACTIONS.md`, Plan | URL Inspection, Page Indexing und Sitemap-Nachweis | keine neuen Soft-404-/Hostduplikate; Sitemap verarbeitet | M2.1–M2.3, Deployment, GSC-Zugriff |
| M3.1 Fallback vereinheitlichen | blockiert | P3-T1 | betroffene kanonische HTML-Dateien, `js/app.js`, ggf. Sync-Skript | Raw-HTML-/No-JS-/DOM-Test | pro Slot genau eine Instanz; ohne JS benutzbar | Freigabe nach Phase 2 und Ursache geklärt |
| M3.2 IDs/Labels/Anker | blockiert | P3-T2 | acht HTML-Dateien, Module, Integritätstest | Doppel-ID-, `for`-, ARIA- und Fragmentprüfung | null Doppel-IDs und null ungelöste Referenzen | M3.1 |
| M3.3 visuelle/assistive QA | blockiert | P3-T3 | alle kanonischen Seiten; Plan/Testprotokoll | Viewport-/Tastatur-/Zoom-/Kontrast-/Reduced-Motion-/Screenreader-Matrix | keine Blocker; nicht verfügbare Tests ausdrücklich nicht verifiziert | Browser/Assistive-Technik-Umgebung |
| M3.4 Übersetzungsschlüssel | blockiert | P3-T4 | `js/translations.js`, Module, Claims-Register, Tests | Key-Nutzungs-/Overridebericht und Vier-Sprachen-Regression | jeder aktive risikorelevante Key freigegeben; keine Sprachregression | M0.1, M0.2, aktiver Key-Graph |
| M4.1 CWV messen | blockiert | P4-T1 | PSI/CrUX/GSC/Browser; Plan | Messprotokoll je repräsentativem Template, mobil/desktop | reproduzierbare Labordaten und verfügbare Felddaten dokumentiert | Freigabe, PSI/CrUX/Browser |
| M4.2 Bilder optimieren | blockiert | P4-T2 | nur gemessene Assets in `assets/`, zugehörige HTML/CSS | Vorher-/Nachher-Bytes, LCP/CLS und visueller Vergleich | sichtbare Qualität erhalten; gemessene Zielmetrik verbessert; Layout stabil | M4.1 |
| M4.3 Favicon/Social-Bild | blockiert | P4-T3 | neue Brandassets, acht HTML-Dateien/Template | Asset-/MIME-/Abmessungs-/Metadaten-/Linkpreview-Prüfung | Icons und absolute `og:image`-URL funktionieren konsistent | D01 und D02 |
| M4.4 Header härten | blockiert | P4-T4 | `_headers`/Cloudflare-Konfiguration, Consent/Form/Font/Analytics-Flows | Live-/Preview-Headervergleich und Funktionsregression | gewählte Regeln aktiv, ohne Form/Consent/Fonts/Analytics zu brechen | Diensteliste, Cloudflare-Zugriff |
| M5.1 Marke ausrollen | blockiert | P5-T1 | Header, Footer, acht Seiten, JSON-LD, OG, Übersetzungen, Assets | Brand-/Schema-/Metadaten-Fundstellentest | kein OSMP/ONCC-Widerspruch; juristischer Name korrekt getrennt | D01, D02, M0.2, Phasenfreigabe |
| M5.2 Content-Gaps | blockiert | P5-T2 | Analyse/Plan; danach nur freigegebene Zielseiten | Query-/Page-/Land-/CTR-/Conversion-Beleg pro Änderung | jede Änderung besitzt echten Such- und Geschäftsnutzen | M0.3, ausreichende echte Suchdaten |
| M5.3 technische Inhalte | blockiert | P5-T3 | nur ausgewählte Leistungs-/Technologie-/Werkstoff-/Qualitätsdateien | Claims-Registerabgleich und fachliches Textreview | jede Aussage belegt; ISO geplant; Edelstahl nicht Standard | M0.2, M5.2 |
| M5.4 Profile/Citations | blockiert | P5-T4 | externe Profile, `docs/EXTERNAL_ACTIONS.md` | Berechtigung-/NAP-/Kosten-/Verantwortlichenprüfung | nur einzeln freigegebene, konsistente, messbare Profile | D01, D02, Berechtigung und Einzelfreigabe |
| M5.5 Backlink-/Partnerarbeit | blockiert | P5-T5 | externe Domains/Partnerschaften, Entscheidungsunterlage | Zielkunden-/Kosten-/Aufnahme-/Leadwertprüfung | keine Kauf-/Automatiklinks; jede Quelle hat Verantwortlichen und Nutzen | M5.2, Vertriebspriorität, Einzelfreigabe |
| M5.6 Wettbewerber-/SERP-Stichprobe | blockiert | P5-T6 | neues Analyseartefakt; keine direkte Seitenänderung | reproduzierbare Tabelle mit Datum, Land/Sprache, Query, URL und Befund | konkrete belegte Gaps statt allgemeiner Wettbewerbermuster | M0.3, freigegebene Queries/Länder |

## 5. Phase 0 – Entscheidungen und Baseline

### P0-T1: Marken- und Namensentscheidung dokumentieren

**Status:** abgeschlossen  
**Files:** Modify `docs/WEBSITE_IMPLEMENTATION_PLAN.md`; später Create/Modify `docs/PUBLIC_CLAIMS_REGISTER.md`  
**Consumes:** D01, D02  
**Produces:** Eine unverwechselbare öffentliche Schreibregel für Marke und juristischen Namen.

- [ ] Inhaberantwort wortgetreu unter Abschnitt 2 eintragen.
- [ ] Schreibregel für Logo/Header, Seitentitel/Fließtext, Footer/Impressum und Organization-Schema getrennt festhalten.
- [ ] Mit `rg -n -i 'ONCC|OSMP|OS\.MECHPLAST'` nur die später betroffenen Fundstellen inventarisieren; noch nichts ersetzen.
- [ ] M0.1 erst auf **abgeschlossen** setzen, wenn die Schreibregel ausdrücklich bestätigt ist.

**Abnahmekriterium:** Eine Person kann für jede sichtbare und maschinenlesbare Stelle eindeutig entscheiden, welcher Name dort erscheinen darf.

### P0-T2: Öffentliche Behauptungen registrieren

**Status:** abgeschlossen  
**Files:** Create `docs/PUBLIC_CLAIMS_REGISTER.md`; read-only scan der acht kanonischen HTML-Dateien, Module und aktiven Übersetzungen  
**Produces:** Tabelle `ID | Behauptung | Fundstelle | Sprache | Status | Beleg/Verantwortlicher | freigegebene Formulierung`.

- [ ] Zuerst alle Aussagen zu Ländern/Kunden, Sprachen, Maschinen, Werkstoffen, Toleranzen, Liefer-/Antwortzeiten, Qualität, Messmitteln, Zertifikaten und Nachweisen mit exakten Pfaden/Zeilen erfassen.
- [ ] Jede Zeile ausschließlich als **bestätigt**, **geplant**, **intern zu prüfen** oder **entfernen** klassifizieren; ohne Inhaberbeleg zunächst **intern zu prüfen**.
- [ ] Aktive Übersetzungswerte und spätere `Object.assign`-Overrides getrennt dokumentieren, damit historische Schlüssel nicht fälschlich als sichtbarer Text gelten.
- [ ] Keine Aussage im Website-Code ändern, bis der Inhaber die betroffenen Registerzeilen freigibt.
- [ ] Test: `rg -n -i '24h|24 h|0[,.]01|ISO 9001|Edelstahl|stainless|inox|fünf Ländern|five countries|cinque paesi|cinq pays'` gegen Registerabdeckung abgleichen.

**Abnahmekriterium:** Alle risikorelevanten öffentlichen Aussagen sind auffindbar, klassifiziert und ohne erfundene Belege dokumentiert.

### P0-T3: Fehlende externe Baseline dokumentieren

**Status:** abgeschlossen  
**Files:** Create `docs/EXTERNAL_ACTIONS.md`; Modify `docs/WEBSITE_IMPLEMENTATION_PLAN.md`  
**Produces:** Externe Aufgabenliste mit System, benötigtem Zugriff, exaktem Export/Nachweis, Verantwortlichem und Status.

- [ ] GSC: Property-Typ, Sitemapstatus, Page Indexing, Queries, Pages, Länder, Geräte und CWV-Zeitraum anfordern.
- [ ] GA4: Property/Datenstream, Consent-Status, `lead_form_submit`, `lead_form_success`, Telefon-/E-Mail-Klicks und tatsächliche Conversiondefinition anfordern.
- [ ] Cloudflare: Pages-Projekt, Produktionsbranch, Domains, D1-Binding, bestehende Redirect/WAF/Rate-Limit/Header-Regeln und gegebenenfalls R2-Verfügbarkeit anfordern.
- [ ] Für nicht verfügbare Daten „extern blockiert“ mit Datum dokumentieren; M1.1/M1.5 nicht deswegen blockieren.

**Abnahmekriterium:** Jede externe Lücke hat einen konkreten Nachweisbedarf; keine fehlende Analyticszahl wird als technische Blockade missbraucht.

## 6. Phase 1 – Anfrageweg und Datenschutz

Vor Beginn von Phase 1 werden der aktuelle Diff der betroffenen Dateien, die einzelnen Syntaxprüfungen `node --check js/app.js`, `node --check js/analytics.js` und `node --check functions/api/leads.js` sowie die vorhandene Kontaktseite lokal dokumentiert. Nach Abschluss von Phase 1 wird gestoppt und `superpowers:requesting-code-review` ausgeführt; Phase 2 beginnt nur nach ausdrücklicher Inhaberfreigabe.

### P1-T1: Testharness ohne Zusatzpakete anlegen

**Status:** abgeschlossen  
**Files:** Create `tests/helpers/load-browser-script.mjs`, `tests/lead-form.test.mjs`, `tests/leads-api.test.mjs`, `tests/site-integrity.test.mjs`, `tests/analytics-consent.test.mjs`  
**Produces:** Reproduzierbare Node-Tests für Browserlogik, Pages Function und statische Dateien.

- [ ] `tests/helpers/load-browser-script.mjs` mit `node:vm` anlegen. Die Funktion `loadBrowserScript(relativePath, overrides = {})` liest den Quelltext, stellt standardmäßig `document.addEventListener`, `querySelectorAll`, `getElementById`, `localStorage`, `window`, `location`, `setTimeout`, `URLSearchParams` und `console` als kontrollierbare Fakes bereit und gibt den VM-Kontext zurück.
- [ ] Minimaler Kern:

```js
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function loadBrowserScript(relativePath, overrides = {}) {
  const elements = overrides.elements || {};
  const document = overrides.document || {
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getElementById(id) { return elements[id] || null; },
    createElement() { return { dataset: {}, style: {}, addEventListener() {} }; },
    documentElement: { dataset: {}, lang: 'de' },
    body: { appendChild() {}, classList: { toggle() {} } },
    head: { appendChild() {} }
  };
  const context = vm.createContext({
    document,
    window: overrides.window || {},
    localStorage: overrides.localStorage || { getItem() { return null; }, setItem() {} },
    location: overrides.location || { pathname: '/', hash: '', search: '', hostname: 'localhost' },
    fetch: overrides.fetch,
    setTimeout: overrides.setTimeout || (() => 0),
    clearTimeout() {}, URLSearchParams, console,
    T: overrides.T || { de: { f_success: 'Erfolg', f_error: 'Fehler', f_submit: 'Senden', f_submitting: 'Wird gesendet' } }
  });
  context.window.window = context.window;
  const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
  return context;
}
```

- [ ] `node --test tests/*.test.mjs` ausführen; die zunächst angelegten Ist-Zustands-/Fehlertests müssen die bekannten Fehler sichtbar machen, nicht grünmaskieren.
- [ ] Keine Testabhängigkeit installieren und keine bestehenden Produktionsdateien in diesem Arbeitspaket ändern.

**Abnahmekriterium:** Tests sind mit einem einzigen lokalen Befehl reproduzierbar und können Browser-/Function-Verhalten ohne Live-Lead prüfen.

### P1-T2: M1.1 Formularzustände testgetrieben korrigieren

**Status:** abgeschlossen  
**Files:** Modify `js/app.js`, `modules/kontakt.html`, `kontakt/index.html`, `js/translations.js`; Test `tests/lead-form.test.mjs`, `tests/site-integrity.test.mjs`  
**Consumes:** bestehende `/api/leads`-JSON-Schnittstelle  
**Produces:** Erfolg nur nach bestätigtem API-Erfolg; eindeutiger Lade-/Fehlerzustand ohne Eingabeverlust.

- [ ] Zuerst folgende Tests mit sprechenden Namen schreiben:

```js
test('shows success, tracks success and resets only after a 2xx response', async () => {});
test('keeps all values and shows a validation error after HTTP 400', async () => {});
test('keeps all values and shows a server error after HTTP 500', async () => {});
test('keeps all values and shows a network error when fetch rejects', async () => {});
test('ignores a second submit while the first request is pending', async () => {});
test('disables the submit button and exposes aria-busy only while pending', async () => {});
test('does not emit lead_form_success for any failed request', async () => {});
```

- [ ] `node --test tests/lead-form.test.mjs` ausführen. Erwartung: Die Fehlerfälle schlagen am alten Verhalten fehl; insbesondere werden aktuell Erfolg und Reset nach 400/500 ausgelöst.
- [ ] `saveLead(payload)` so ändern, dass es bei Nicht-2xx eine neutrale, typisierte Fehlerart liefert oder wirft und niemals rohe API-Antworttexte an Besucher weiterreicht.
- [ ] `submitForm(event)` so ändern, dass `form.dataset.submitting`, `aria-busy`, `button.disabled` und der übersetzte Ladetext gesetzt werden; im `finally` wird der Ausgangszustand zuverlässig wiederhergestellt.
- [ ] Einen separaten `errorBanner` mit `role="alert"`/`aria-live="assertive"` in Modul und statischem Fallback ergänzen. `successBanner` behält ausschließlich Erfolgsmeldungen.
- [ ] Übersetzungsschlüssel `f_submitting`, `f_error_validation`, `f_error_network`, `f_error_server` in DE/IT/EN/FR sachlich ergänzen; keine Antwortzeit versprechen.
- [ ] Nur nach bestätigtem 2xx: `lead_form_success` senden, Erfolg anzeigen, Formular zurücksetzen und gegebenenfalls Dateistatus leeren.
- [ ] Tests erneut ausführen. Erwartung: alle sieben Fälle PASS.
- [ ] `node --check js/app.js` und `node --check js/translations.js` einzeln sowie `node --test tests/*.test.mjs` ausführen.

**Abnahmekriterium:** Kein Fehlerpfad löscht Nutzerdaten oder erzeugt ein Success-Event; Doppelklick erzeugt höchstens einen Request; Lade- und Fehlerzustand sind zugänglich erkennbar.

### P1-T3: M1.5 API-Validierung testgetrieben härten

**Status:** abgeschlossen  
**Files:** Modify `functions/api/leads.js`; Test `tests/leads-api.test.mjs`  
**Produces:** Deterministische Validierung und neutrale Fehlerantworten bei unverändertem D1-Grundschema.

- [ ] Pages-Function über einen `data:`-Import oder eine kopierte temporäre Modul-URL im Test laden; `env.DB.prepare().bind().run()` als Fake mit aufgezeichneten Parametern bereitstellen.
- [ ] Vor Implementierung diese Tests schreiben:

```js
test('accepts one valid same-origin JSON lead and writes normalized values once', async () => {});
test('rejects malformed JSON with 400 and a public error code', async () => {});
test('rejects a missing or invalid email with 400 without touching D1', async () => {});
test('rejects fields above their limits with 413 without touching D1', async () => {});
test('rejects unsupported language and service values with 400', async () => {});
test('returns a generic 500 response when D1 fails and does not expose err.message', async () => {});
test('does not reflect arbitrary Origin values in CORS headers', async () => {});
```

- [ ] Grenzen im Test und Code zentral definieren: gesamter JSON-Body maximal 16 KiB; `company` 200, `name` 150, `email` 254, `phone` 50, `service` 80, `message` 5.000 Zeichen; Sprachen nur `de`, `it`, `en`, `fr`. Leerraum an Feldrändern entfernen, aber Nutzertext im Inneren nicht umschreiben.
- [ ] Die existierenden Servicewerte aus den tatsächlichen `<option>`-/Übersetzungswerten ermitteln und als gemeinsame Allowlist dokumentieren; keinen neuen Leistungswert erfinden.
- [ ] Nicht-JSON, ungültige Typen, fehlende Pflichtfelder, überlange Werte und ungültige E-Mail mit 400/413 und stabilen öffentlichen Codes wie `invalid_request`, `invalid_email`, `payload_too_large` beantworten.
- [ ] Interne D1-Fehler ausschließlich serverseitig protokollieren; Besucher erhalten `{"ok":false,"error":"server_error"}`.
- [ ] CORS-Wildcard entfernen, sofern der Endpunkt ausschließlich same-origin bleibt; `OPTIONS` nur behalten, wenn ein belegter Client es benötigt.
- [ ] `node --test tests/leads-api.test.mjs` ausführen. Erwartung: alle Fälle PASS, D1 wird in Ablehnungsfällen nullmal aufgerufen.

**Abnahmekriterium:** Die API akzeptiert nur begrenzte, erwartete Nutzlasten, legt genau einen Datensatz an und gibt keine internen Fehlerdetails preis.

### P1-T4A: M1.2 Upload vollständig entfernen

**Status:** abgeschlossen; D03 „vorläufig entfernen“ wurde am 2026-08-29 freigegeben  
**Files:** Modify `modules/kontakt.html`, `kontakt/index.html`, `js/app.js`, `js/analytics.js`, `js/translations.js`, ggf. kontaktbezogene Texte/Schema; Test `tests/site-integrity.test.mjs`, `tests/lead-form.test.mjs`  
**Produces:** Normales Anfrageformular ohne falsches Upload-Versprechen oder tote Uploadlogik.

- [ ] Vor Änderung einen roten Integritätstest schreiben, der nach Freigabe verlangt, dass in aktiven Kontaktquellen keine IDs `uploadZone`, `sketchFile`, `uploadSelected`, kein `type="file"`, keine `handleFileUpload`-/`initDragDrop`-Funktionen und kein `drawing_upload_started`-Listener verbleiben.
- [ ] Uploadgruppe aus Modul und allen Kontakt-Fallbackkopien entfernen; nicht das übrige Formular, die Formular-IDs oder den Anfrage-Assistenten verändern.
- [ ] Uploadtexte/Versprechen in den tatsächlich aktiven DE/IT/EN/FR-Keys entfernen oder neutralisieren; historische, nachweislich inaktive Keys erst in Phase 3 löschen.
- [ ] Uploadfunktionen und Uploadtracking vollständig entfernen; Success-/Errorlogik darf keine Uploadelemente mehr erwarten.
- [ ] `node --test tests/*.test.mjs` sowie `node --check js/app.js`, `node --check js/analytics.js` und `node --check js/translations.js` jeweils einzeln ausführen.
- [ ] Lokaler Browser-Smoke-Test: normales Formular, Assistant-Prefill, Consent, Sprache und Fehlermeldungen funktionieren weiter.

**Abnahmekriterium:** Es gibt keinen sichtbaren oder technischen Uploadpfad mehr; eine Anfrage ohne Datei funktioniert vollständig.

### P1-T4B: M1.2/M1.4 echten privaten Upload umsetzen

**Status:** blockiert; nur ausführen, wenn D03 „echter Upload“ samt Formaten, Maximalgröße, Aufbewahrung und Rollen festlegt  
**Files:** Modify `modules/kontakt.html`, `kontakt/index.html`, `js/app.js`, `functions/api/leads.js`, `schema.sql`, `js/analytics.js`, `js/translations.js`; Create `migrations/0002_lead_uploads.sql`; Test `tests/lead-form.test.mjs`, `tests/leads-api.test.mjs`, `tests/site-integrity.test.mjs`; externe private R2-Bindung `RFQ_UPLOADS`  
**Produces:** Ein einzelner multipart Anfragevorgang, der erst nach D1- und privatem R2-Erfolg bestätigt wird.

- [ ] Vor Codeänderung das freigegebene Format-/Größen-/Aufbewahrungs-/Rollenprofil wortgetreu in Abschnitt 2 und `docs/PRIVACY_DATA_FLOW.md` eintragen.
- [ ] Sicherheitsdesign festschreiben: R2-Bucket ohne öffentliche Domain; Binding `RFQ_UPLOADS`; zufälliger Objektkey ohne Originaldateinamen; Originalname nur als bereinigte Metadaten; keine dauerhafte öffentliche URL; serverseitige Größen-, Endungs-, MIME- und Signaturprüfung; Lifecycle-Regel nach Inhaberfrist.
- [ ] Cloudflare-Grenzen gegen [Pages R2 Bindings](https://developers.cloudflare.com/pages/functions/bindings/), [R2 Uploads](https://developers.cloudflare.com/r2/objects/upload-objects/), [Workers Request Limits](https://developers.cloudflare.com/workers/platform/limits/) und [R2 Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/) dokumentieren. Die Websitegrenze muss kleiner als die Konto-/Requestgrenze sein.
- [ ] Rote Tests für erlaubte Datei, zu große Datei, falsche Endung, manipulierten MIME-Type, falsche Magics/Signatur, R2-Fehler, D1-Fehler nach R2-Put, Doppelklick und Erfolg erst nach beiden Speicherschritten schreiben.
- [ ] Additive Migration planen: `upload_object_key`, `upload_original_name`, `upload_media_type`, `upload_size`, `upload_sha256`, `upload_status`; kein Datei-BLOB in D1. Vor Live-Migration D1-Backup/Schemaexport und explizite Freigabe einholen.
- [ ] Client auf `FormData` umstellen, Lade-/Fehlerzustände aus P1-T2 wiederverwenden und Clientprüfung nur als frühe UX-Hilfe behandeln.
- [ ] Upload-UI als natives `<label for="sketchFile">` oder Button/Input-Muster umsetzen; Tastatur, sichtbarer Fokus, Dateistatus, Fehlerzuordnung und Entfernen/Neu-Auswählen unterstützen.
- [ ] Function validiert Felder und Datei erneut, erzeugt UUID/Hash, schreibt privat nach R2 und verknüpft Objektmetadaten mit dem Lead. Scheitert D1 nach R2-Put, wird das Objekt im Catch-Pfad gelöscht; verbleibende Crash-Orphans werden durch dokumentierten Audit-/Lifecycle-Prozess behandelt.
- [ ] Keine Downloadroute für Besucher erstellen. Interner Zugriff bleibt ein separat freizugebender administrativer Prozess außerhalb dieser Websitephase.
- [ ] R2-/D1-Fakes testen; danach nur mit ausdrücklich freigegebener Preview-Umgebung einen Ende-zu-Ende-Test durchführen. Keine reale Kundendatei verwenden.

**Abnahmekriterium:** Ein erlaubtes Testdokument ist privat gespeichert und eindeutig mit genau einem Lead verknüpft; alle Ablehnungs-/Fehlerfälle zeigen keinen Erfolg, verlieren keine Eingaben und hinterlassen nach kontrollierbaren Fehlern keine Datei.

### P1-T5: M1.3 technischen Datenschutzentwurf erstellen und verlinken

**Status:** abgeschlossen als technischer, klar ungeprüfter Entwurf; juristische Finalität extern blockiert  
**Files:** Create `docs/PRIVACY_DATA_FLOW.md`, `datenschutz/index.html`; Modify `modules/footer.html`, `modules/kontakt.html`, acht kanonische Footer-Fallbacks, Kontakt-Fallback, ggf. `js/analytics.js`; Test `tests/site-integrity.test.mjs`  
**Produces:** Transparente technische Grundlage und sichtbarer vollständiger Entwurf mit klarer juristischer Prüfkennzeichnung.

- [ ] Datenfluss inventarisieren: Formularfelder, D1, optional R2, Cloudflare Pages/Logs/Security, Google Analytics, Microsoft Clarity, Google Fonts, eventuelle E-Mail-/Benachrichtigungsdienste, Local Storage und Cookies.
- [ ] Für jeden Fluss Quelle, Zweck laut Technik, Datenkategorien, Zielsystem, Zugriff, Transport, Löschung/Aufbewahrung, Drittlandbezug und offene Rechtsprüfung dokumentieren. Fehlende Fakten ausdrücklich als „Inhaberangabe erforderlich“ markieren.
- [ ] Datenschutzseite aus realen Unternehmensangaben und technischen Fakten erstellen. Rechtsgrundlagen, Fristen, Auftragsverarbeiter-/Drittlandangaben, Datenschutzkontakt und Betroffenenrechte nur mit Inhaber-/Fachprüfung finalisieren; keine Rechtsangabe erfinden.
- [ ] Sichtbar und oben auf der Entwurfsseite kennzeichnen: „Entwurf – juristische Prüfung vor Veröffentlichung erforderlich“, solange keine Freigabe vorliegt.
- [ ] Footer-Platzhalter erst ersetzen, wenn der Entwurf alle tatsächlich aktiven Datenflüsse abdeckt; dann dauerhaften Link `/datenschutz/` in Modul und allen Fallbacks ergänzen.
- [ ] Formularhinweis auf `/datenschutz/` verlinken und knapp erklären, dass die Angaben zur Bearbeitung der Anfrage verarbeitet werden; keine Einwilligungscheckbox als pauschalen Ersatz für eine Rechtsgrundlagenprüfung erfinden.
- [ ] Consent technisch testen: vor Zustimmung keine GA-/Clarity-Netzwerkskripte; Ablehnen lädt sie nicht; Akzeptieren lädt je einmal; Einstellungen sind erneut erreichbar; Widerruf löscht bekannte Cookies soweit technisch möglich.
- [ ] Integritätstest verlangt genau einen Footerlink je gerendertem Footer, einen Formularlink und keine sichtbaren Texte „Datenschutz folgt“/„TODO – Datenschutzhinweis ergänzen“ nach Freigabe.

**Abnahmekriterium:** Datenfluss und Websiteentwurf stimmen überein, alle offenen Rechtsangaben sind klar markiert, und kein Platzhalter wird durch scheinbar finalen unbelegten Rechtstext ersetzt.

### P1-T6: Rate-Limiting und Missbrauchsschutz prüfen

**Status:** abgeschlossen im Repository; externe Cloudflare-Kontoprüfung blockiert  
**Files:** Modify `docs/EXTERNAL_ACTIONS.md`, ggf. `functions/api/leads.js`; keine Cloudflare-Kontoänderung ohne Freigabe  
**Produces:** Nachweis, welche Schutzschicht im Code und welche extern existiert.

- [ ] Bestehende Cloudflare WAF-/Rate-Limit-/Bot-Regeln mit Kontozugriff erfassen; ohne Zugriff als extern blockiert dokumentieren.
- [ ] Anwendungsschicht aus P1-T3 als Mindestschutz verifizieren: Body-/Feldlimits, Allowlist, neutrale Fehler, nur POST, keine CORS-Wildcard.
- [ ] Keine CAPTCHA-Abhängigkeit blind hinzufügen. Erst bei belegtem Spamrisiko Anbieter, Datenschutzfolge, Accessibility und Kosten entscheiden.
- [ ] Für eine spätere Cloudflare-Regel Zielpfad `/api/leads`, Methode POST, gewünschtes Verhalten, verantwortliche Person und Preview-/Produktionsprüfung dokumentieren; konkrete Schwellenwerte erst anhand Traffic/Spam und Inhaberfreigabe festlegen.

**Abnahmekriterium:** Repository-Schutz ist getestet; externe Schutzlücken sind mit Besitzer und Nachweisbedarf dokumentiert, nicht als angeblich gelöst markiert.

### P1-T7: Phase-1-Gesamtprüfung und Freigabestopp

**Status:** blockiert; automatisierte und lokale HTTP-Prüfung abgeschlossen, visuelle Browserprüfung mangels Browser-Instanz offen  
**Files:** Modify `docs/WEBSITE_IMPLEMENTATION_PLAN.md`, `docs/PROJECT_STATUS.md`, `docs/TASK_LOG.md`; keine neue Funktionsänderung  
**Produces:** Reproduzierbarer Phase-1-Abnahmebericht im laufenden Plan.

- [ ] `node --test tests/*.test.mjs` vollständig ausführen und Anzahl PASS/FAIL dokumentieren.
- [ ] `node --check js/app.js`, `node --check js/analytics.js`, `node --check js/translations.js` und `node --check functions/api/leads.js` jeweils einzeln ausführen.
- [ ] Lokalen Server auf `127.0.0.1:8099` starten und Kontaktseite in DE/IT/EN/FR prüfen; keine Live-Daten erzeugen.
- [ ] Erfolgs-, Clientvalidierungs-, Netzwerk-, 400-, 500- und Doppelklickfall mit Fakes/Preview durchspielen; bei Upload zusätzlich Auswahl/Tastatur/Fehlertypen, bei Entfernung normalen Formularfluss.
- [ ] Consent vor/nach Akzeptieren/Ablehnen prüfen; Netzwerkbeobachtung dokumentieren.
- [ ] `git diff --check`, `git diff -- <betroffene Dateien>` und `git status --short` prüfen; fremde Änderungen unverändert lassen.
- [ ] `superpowers:verification-before-completion` und anschließend `superpowers:requesting-code-review` ausführen; Befunde korrigieren und Tests wiederholen.
- [ ] Geänderte Dateien, Testergebnisse, offene Punkte, Risiken und verbleibende Entscheidungen im Plan und Task-Log eintragen.
- [ ] **STOP:** Phase 2 erst nach ausdrücklicher Freigabe des Inhabers beginnen.

## 7. Phase 2 – Routing und Indexierung

**Gesamtstatus:** blockiert bis Phase-1-Freigabe.

### P2-T1: M2.1 echte 404 testgetrieben einführen

**Files:** Create `404.html`; Modify `tests/site-integrity.test.mjs`, ggf. gemeinsame Assets/Module nur soweit nötig  
**Steps:** Zuerst Test auf oberste `404.html`, eigenes `noindex`, hilfreiche Links und fehlenden Startseiten-Canonical schreiben; dann minimale statische Seite erstellen. Lokal mit Python statisch prüfen; Cloudflare-Verhalten erst nach freigegebenem Deployment live verifizieren.  
**Abnahme:** Zufallspfad sowie `/cnc-drehen/`, `/cnc-dreh-fraesen/`, `/prototypen-serien/`, `/pruefung-dokumentation/`, `/anfrage-vorbereiten/` liefern live 404; gültige Seiten bleiben 200.

### P2-T2: M2.2 www-Weiterleitung spezifizieren

**Files:** Modify `docs/EXTERNAL_ACTIONS.md`; `_redirects` nur ändern, wenn Cloudflare Pages dies für beide Hosts nachweislich unterstützt  
**Steps:** Hauptdomain nicht selbst wählen; nach Freigabe exakte Cloudflare Bulk Redirect/Redirect Rule dokumentieren. Testmatrix für HTTP/HTTPS × www/non-www × Pfaderhalt erstellen. Keine Kontoänderung ohne Freigabe.  
**Abnahme:** Jede www-URL folgt genau einer dauerhaften Weiterleitung auf denselben Pfad der freigegebenen HTTPS-Hauptdomain.

### P2-T3: M2.3 Sitemap bereinigen

**Files:** Modify `sitemap.xml`, `tests/site-integrity.test.mjs`; eventuell `robots.txt` nur bei geändertem Sitemap-Pfad  
**Steps:** Inhaber entscheidet separat über Impressum und Datenschutz. Zuerst XML-/URL-Test schreiben; veralteten Kommentar entfernen; nur freigegebene kanonische 200-URLs eintragen; `lastmod` nur bei echter Seitenänderung setzen.  
**Abnahme:** XML parsebar, keine Dubletten/404/Redirect/noindex-URLs, Canonical jeder URL entspricht `<loc>`.

### P2-T4: M2.4 Routing-/GSC-Abnahme

**Files:** Modify `docs/EXTERNAL_ACTIONS.md`, `docs/WEBSITE_IMPLEMENTATION_PLAN.md`, Projektdokumentation  
**Tests:** Alle acht kanonischen Seiten; alle 22 `_redirects`-Quellpfade; Zufallspfad und fünf Beispiele; HTTP/HTTPS; www/non-www; `robots.txt`; `sitemap.xml`; Canonicals. Nach Deployment GSC URL Inspection, Page Indexing und Sitemapstatus dokumentieren.  
**STOP:** Code-Review und Inhaberfreigabe vor Phase 3.

## 8. Phase 3 – Markup und Zugänglichkeit

**Gesamtstatus:** blockiert bis Phase-2-Freigabe.

### P3-T1: M3.1 eine Fallbackinstanz je Modul

**Files:** Modify betroffene kanonische HTML-Dateien, `js/app.js`; gegebenenfalls Create `scripts/sync-module-fallbacks.mjs`; Test `tests/site-integrity.test.mjs`  
**Approach:** Vor Änderung bestimmen, ob die dreifachen Inhalte durch fehlerhafte Generierung oder manuelle Kopien entstanden. Ein deterministisches Synchronisationsskript ist nur zulässig, wenn es bestehende Slots gezielt ersetzt und einen `--check`-Modus besitzt. Zuerst Tests für genau eine Instanz und nutzbares No-JS-HTML schreiben.  
**Abnahme:** Raw HTML und gerenderter DOM enthalten pro Slot genau eine Instanz; ohne JS bleiben Navigation, Inhalte und Kontaktformular nutzbar.

### P3-T2: M3.2 IDs, Labels, Anker und ARIA

**Files:** Modify nur durch Test gefundene HTML-/Modulstellen; Test `tests/site-integrity.test.mjs`  
**Tests:** Einzigartige IDs pro Dokument; jedes `label[for]` hat ein Steuerelement; `aria-labelledby`/`aria-describedby` lösen auf; interne Fragmente existieren; Formularelemente haben Namen/Labels; keine Regression am Anfrage-Assistenten.  
**Abnahme:** Statischer Test und gerenderter DOM-Test melden null Doppel-IDs und null Fehlreferenzen.

### P3-T3: M3.3 Browser-/A11y-Matrix

**Files:** Modify Plan/Testprotokoll; Code nur bei reproduzierbarem Befund  
**Tests:** 320, 375, 768, 1024 und große Breite; Tastaturreihenfolge; sichtbarer Fokus; Escape/Mobilmenü; 200%-Zoom; Kontrast; Reduced Motion; Screenreader-Smoke-Test für Header, H1, Formular, Status und Footer.  
**Abnahme:** Alle durchführbaren Fälle dokumentiert; nicht verfügbare Browser-/Screenreaderprüfungen ausdrücklich „nicht verifiziert“, nicht „bestanden“.

### P3-T4: M3.4 aktive Übersetzungen inventarisieren

**Files:** Modify `js/translations.js` nur nach Nutzungsnachweis; Create/Modify `docs/PUBLIC_CLAIMS_REGISTER.md`; Test `tests/site-integrity.test.mjs`  
**Tests:** Key-Nutzung in Modulen/Seiten, Override-Reihenfolge, vier Sprachen, gefährliche 24h-/Toleranz-/Materialaussagen. Inaktive Keys erst nach Beweis und Inhaberfreigabe entfernen.  
**Abnahme:** Jeder aktive risikorelevante Key ist freigegeben; Sprachumschaltung und Formulartexte funktionieren.  
**STOP:** Review und Inhaberfreigabe vor Phase 4.

## 9. Phase 4 – Performance und technische Härtung

**Gesamtstatus:** blockiert bis Phase-3-Freigabe.

### P4-T1: M4.1 messen

Je Template mindestens Start, Leistung, bildlastige Seite, Unternehmen, Kontakt und Recht messen. Mobile/Desktop-Lighthouse sowie verfügbare CrUX-/GSC-CWV-Felddaten mit Datum, Netzwerkprofil und 75. Perzentil dokumentieren. Bei API-Limitierung keinen Messwert erfinden.

### P4-T2: M4.2 nur gemessene Bildprobleme korrigieren

Vor jeder Konvertierung Dateibytes, gerenderte Abmessung und LCP-Relevanz festhalten. Zuerst Test auf `width`/`height` oder stabiles `aspect-ratio`; danach nur priorisierte Assets verlustarm/visuell geprüft optimieren. Abnahme erfordert Vorher-/Nachher-Messung und visuellen Vergleich, nicht nur kleinere Datei.

### P4-T3: M4.3 Brandassets

Erst nach D01/D02 Faviconvarianten und ein Social-Share-Bild aus freigegebenen Assets erzeugen. Tests prüfen existierende Dateien, korrekte MIME/Abmessungen, absolute `og:image`-URL und konsistente Referenz in acht kanonischen Seiten.

### P4-T4: M4.4 Header

Aktuellen Live-Headerbestand erfassen. CSP/HSTS/Frame-/Permissions-/Cache-Regeln einzeln begründen und zunächst in Preview testen. Erlaubte Quellen müssen Cloudflare, eigene Assets, Google Fonts, GA4 und Clarity korrekt abbilden. Form, Consent, Fonts und Analytics nach jeder Headeränderung regressionsprüfen.  
**STOP:** Review und Inhaberfreigabe vor Phase 5.

## 10. Phase 5 – Inhalte und Autorität

**Gesamtstatus:** blockiert bis Phase-4-Freigabe und erforderliche Daten/Freigaben vorliegen.

### P5-T1: M5.1 Marke konsistent ausrollen

Aus D01/D02 eine exakte Such-/Ersetzungsmatrix erstellen; Logo, Alttexte, Header, Footer, Title, OG, JSON-LD und Übersetzungen getrennt behandeln. Juristischen Namen niemals durch die Marke ersetzen. Vor Umsetzung Brand-Fundstellen-Snapshot, danach Null-Widerspruchstest.

### P5-T2: M5.2 echte Content-Gaps

Nur GSC-/Analytics-/aktuelle Suchdaten verwenden. Jede vorgeschlagene Änderung braucht Query, Land, Sprache, Zielseite, aktuelle Impression/Position/CTR, Nutzerfrage und Conversionziel. Ohne Daten bleibt die Maßnahme blockiert.

### P5-T3: M5.3 technische Inhalte

Nur Registerzeilen mit Status **bestätigt** oder klar als **geplant** freigegebene Aussagen verwenden. Kein Edelstahl als Standard, keine ISO-Zertifizierung, keine Toleranz-/Lieferzeit-/Kapazitätsangabe ohne Beleg. Änderungen durch Fakten-Diff und fachliche Inhaberabnahme testen.

### P5-T4: M5.4 Profile/Citations

Pro Profil Berechtigung, Zielkundenbezug, Kosten, NAP, Pflegeverantwortung und Messweg dokumentieren. Kein Profil anlegen oder ändern ohne Einzelfreigabe.

### P5-T5: M5.5 Backlinks/Partner

Keine gekauften oder automatisierten Links. VDMA/VDA/Xing/Verzeichnisse nicht als Checkliste behandeln; nur Quellen mit belegter Aufnahmefähigkeit, Zielkundenbezug und Nutzen in eine Entscheidungsvorlage aufnehmen.

### P5-T6: M5.6 SERP-/Wettbewerberstichprobe

Nur nach freigegebenen Zielqueries/-ländern. Für jede Stichprobe Datum, Standort/Sprache, Query, Ergebnis-URL, Seitentyp, belegte Lücke und geschäftliche Relevanz dokumentieren. Keine neue Seite allein aufgrund eines Konkurrenten anlegen.

**Abschluss:** Nach allen freigegebenen und umgesetzten Phasen `docs/WEBSITE_IMPLEMENTATION_REPORT.md` mit Maßnahmen, Nichtumsetzungen, Dateien, Fehlern, Tests, Risiken, Cloudflare-/GSC-/Rechtsschritten, Unternehmensfreigaben und nächstem Arbeitsblock erstellen.

## 11. Bewusst nicht umgesetzte Empfehlungen

Diese Punkte bleiben unabhängig vom Phasenfortschritt ausgeschlossen, solange kein neuer, belegter Auftrag vorliegt:

- keine fünf Scheineseiten für Soft-404-Beispielpfade;
- keine 1.500-/2.000-Wörter-Pflicht;
- keine zweite GA4-/Clarity-/Analytics-Installation;
- keine pauschale Open-Graph-/Schema-Neuerstellung;
- keine separate Maschinenparkseite ohne Suchbedarf und freigegebene Maschinendaten;
- kein redundantes `index,follow` auf jeder Seite;
- keine Entfernung funktionierender Anker aufgrund der alten Reports;
- keine pauschale Breadcrumb-Neuentwicklung;
- keine automatisierte Verzeichnis-/Backlink-Abarbeitung und keine Kauflinks;
- keine unbestätigten ISO-, Toleranz-, 24h-, Lieferzeit-, Material- oder Kapazitätsversprechen;
- keine internationalen SEO-URLs ohne freigegebene Spracharchitektur;
- keine Änderung der AI-Crawler-Regeln als vermeintliche SEO-P0-Maßnahme;
- keine Massenänderung von Titles/Descriptions nur wegen Zeichenanzahl oder HTML-Entities.

## 12. Offene externe Arbeiten

| System/Person | Arbeit | lokal möglich | Blockade/Nachweis |
|---|---|---|---|
| Inhaber | D01–D03 und später Fakten-/Indexierungs-/Profilfreigaben | nein | schriftliche Entscheidung erforderlich |
| Fertigungsverantwortliche | Maschinen, Werkstoffe, Messmittel, Nachweise, Länder-/Kundenaussagen bestätigen | nein | Beleg oder freigegebene Formulierung |
| Datenschutz-Fachperson | Datenschutzentwurf, Rechtsgrundlagen, Auftragsverarbeiter, Drittland, Fristen prüfen | nein | datierte Freigabe/Korrekturliste |
| Cloudflare | Pages-Projekt/D1-Bindings, Redirect, WAF/Rate Limit, Header; optional private R2-Bindung/Lifecycle | teilweise | Dashboardzugriff, Export/Screenshot, später Live-Test |
| Google Search Console | Sitemap, Page Indexing, URL Inspection, Queries/Pages/Länder/Geräte/CWV | nein | Propertyzugriff und Export |
| Google Analytics 4 | Eventeingang, Consent, Conversiondefinition | nein | Propertyzugriff und Test-/Debugnachweis |
| Browser/Assistive Technik | echte visuelle, mobile, Tastatur-, Kontrast- und Screenreaderprüfung | teilweise | verfügbare Browser-/AT-Umgebung |

## 13. Prüfkommandos pro Phase

Die Befehle werden nur ausgeführt, wenn die dazugehörigen Dateien existieren und die Phase freigegeben ist:

```powershell
node --test tests/*.test.mjs
node --check js/app.js
node --check js/analytics.js
node --check js/translations.js
node --check functions/api/leads.js
git diff --check
git status --short
```

Lokaler statischer Smoke-Test:

```powershell
python -m http.server 8099 --bind 127.0.0.1
```

Cloudflare-spezifische Preview-Tests mit Functions/D1/R2 benötigen eine ausdrücklich freigegebene Wrangler-/Dashboard-Konfiguration. Es wird kein `npx`-Download und keine externe Bindung ohne Freigabe eingerichtet.

## 14. Laufendes Änderungs- und Testprotokoll

| Datum | Phase/Task | Status | tatsächlich geänderte Dateien | ausgeführte Tests und Ergebnis | Risiken/Blockaden |
|---|---|---|---|---|---|
| 2026-08-29 | Planung | abgeschlossen | `docs/WEBSITE_IMPLEMENTATION_PLAN.md` | 26/26 Mastermaßnahmen abgedeckt; Pflichtspalten, sechs Phasen, D01–D03, Statusvokabular und verbotene Platzhalter automatisiert geprüft: PASS | D01, D02 und D03 ausstehend; noch keine Websiteänderung |
| 2026-08-29 | Phase 0 | abgeschlossen | `docs/PUBLIC_CLAIMS_REGISTER.md`, `docs/EXTERNAL_ACTIONS.md`, Plan-/Statusdokumente | 24 Claims und 12 externe Aktionen strukturell geprüft; JavaScript-Baseline 4/4 PASS | GSC, GA4, Cloudflare, Fakten- und Rechtsprüfung extern blockiert |
| 2026-08-29 | Phase 1 | blockiert | Formular/API, Kontaktmodul und -fallbacks, Footerfallbacks, Datenschutzentwurf/-datenfluss, Tests | TDD-Rotlauf 17 erwartete Fehler; danach 24/24 Tests PASS, Syntax 4/4 PASS, `git diff --check` ohne Inhaltsfehler, sieben lokale HTTP-Routen 200 | Technische Umsetzung abgeschlossen; In-App-Browser nicht verfügbar, deshalb visuelle/mobil/assistive Abnahme E12 offen. Kein Deployment/Commit. |

## 15. Freigabegates

| Gate | Voraussetzung | aktueller Status |
|---|---|---|
| Start Phase 0/1 | D01–D03 gesammelt beantwortet; Uploadparameter bei echtem Upload vollständig | freigegeben am 2026-08-29 |
| Start Phase 2 | Phase-1-Tests, Diff, Review, visuelle Browserprüfung und ausdrückliche Inhaberfreigabe | blockiert; E12 und Inhaberfreigabe fehlen |
| Start Phase 3 | Phase-2-Abnahme und ausdrückliche Inhaberfreigabe | blockiert |
| Start Phase 4 | Phase-3-Abnahme und ausdrückliche Inhaberfreigabe | blockiert |
| Start Phase 5 | Phase-4-Abnahme, Daten/Fakten und ausdrückliche Inhaberfreigabe | blockiert |
| Deployment | ausdrückliche separate Veröffentlichungsfreigabe | blockiert |
| Commit | ausdrückliche separate Commitfreigabe | blockiert |

Phase 0 ist abgeschlossen. Die technische Umsetzung von Phase 1 ist abgeschlossen; der Freigabestopp ist aktiv, während E12 (visuelle Browser-/Assistive-Technik-Prüfung) offen bleibt. Phase 2 beginnt ausschließlich nach dokumentierter E12-Prüfung und ausdrücklicher Inhaberfreigabe. Kein Deployment und kein Commit ohne separate Freigabe.
