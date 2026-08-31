# Pages CMS und Wissensbereich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen browserbasiert pflegbaren, statisch erzeugten Wissensbereich unter `/wissen/` einrichten, ohne bestehende Website-Funktionen oder Inhalte außerhalb der freigegebenen Integrationspunkte zu verändern.

**Architecture:** Pages CMS schreibt Markdown und Bilder in das GitHub-Repository. Eleventy verarbeitet ausschließlich `content/`, übernimmt die bestehende statische Website per expliziter Freigabeliste und erzeugt veröffentlichte Wissensseiten in `_site`; Entwürfe erzeugen keine öffentliche Ausgabe. Cloudflare Pages baut `_site`, während `/functions` im Projektstamm erhalten bleibt.

**Tech Stack:** Node.js, Eleventy, `@11ty/eleventy-img`, Pages CMS, Node Test Runner, Cloudflare Pages.

**Spec:** Freigegebene Zielarchitektur aus der Unterhaltung vom 2026-08-31.

## Global Constraints

- Kein erster Artikel wird gesucht, angelegt oder veröffentlicht.
- Bestehende Inhalte dürfen nur für `/wissen/`, Navigation, Footer und Sitemap technisch angepasst werden.
- Analytics, Consent, Formulare, Cloudflare Functions, Mehrsprachigkeit und bestehende Seiten bleiben erhalten.
- Keine Zugangsdaten oder Tokens im Repository.
- Kein Commit und kein Deployment.

---

### Task 1: Content-Vertrag und Validierung

**Files:**
- Create: `tests/wissen-content.test.mjs`
- Create: `scripts/wissen-content.mjs`

**Interfaces:**
- Produces: `CLUSTERS`, `validateArticle(data, inputPath)`, `isPublished(data)`, `articleUrl(data)`.

- [x] Failing tests für Pflichtfelder, Slugs, Cluster, Bilder, Freigabe und Draft-Filter schreiben.
- [x] Tests ausführen und erwartetes Fehlschlagen bestätigen.
- [x] Minimale Validierungsfunktionen implementieren.
- [x] Tests erneut ausführen und Grün bestätigen.

### Task 2: Pages CMS und Build-Grundlage

**Files:**
- Create: `.pages.yml`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `eleventy.config.mjs`
- Modify: `.gitignore`
- Create: `content/wissen/wissen.11tydata.mjs`
- Create: `content/_data/site.mjs`

**Interfaces:**
- Consumes: Content-Vertrag aus Task 1.
- Produces: `npm run build`, `_site`, Pages-CMS-Sammlung `wissen`.

- [x] Integrationstest für Konfiguration, Medienpfad, Cluster und Build-Ausgabe schreiben.
- [x] Test ausführen und erwartetes Fehlschlagen bestätigen.
- [x] Pages-CMS- und Eleventy-Konfiguration implementieren.
- [x] Nur `@11ty/eleventy` und `@11ty/eleventy-img` installieren und Lockdatei erzeugen.
- [x] Integrationstest erneut ausführen.

### Task 3: Übersicht, Artikelvorlage und Bildpipeline

**Files:**
- Create: `content/wissen-index.njk`
- Create: `content/_includes/wissen/base.njk`
- Create: `content/_includes/wissen/article.njk`
- Create: `content/_includes/wissen/article-card.njk`
- Create: `assets/images/wissen/.gitkeep`
- Modify: `css/oncc-system.css`

**Interfaces:**
- Consumes: Collection `wissenPublished`, bestehende Header-/Footer-Module.
- Produces: `/wissen/index.html`, `/wissen/{slug}/index.html`, responsive Artikelbilder.

- [x] Failing Buildtests für leere Übersicht, Metadaten, statisches HTML und Draft-Ausschluss schreiben.
- [x] Buildtest ausführen und erwartetes Fehlschlagen bestätigen.
- [x] Templates und begrenzte Wissensbereich-Styles implementieren.
- [x] Buildtest erneut ausführen.

### Task 4: Website-Integration und Abschlussprüfung

**Files:**
- Modify: `modules/header.html`
- Modify: `modules/footer.html`
- Modify: kanonische HTML-Fallbacks für Header und Footer
- Modify: `js/translations.js`
- Modify: `sitemap.xml` über Build-Ausgabe
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/TASK_LOG.md`
- Create: `tests/wissen-build.test.mjs`

**Interfaces:**
- Produces: sichtbare Navigation zu `/wissen/`, Footer-Link, Sitemap mit `/wissen/` und nur veröffentlichten Artikeln.

- [x] Failing Tests für Navigation, Footer, Sitemap, bestehende Seiten und Functions-Erhalt schreiben.
- [x] Tests ausführen und erwartetes Fehlschlagen bestätigen.
- [x] Minimale Integrationsänderungen implementieren.
- [x] Gesamte Testsuite und Produktionsbuild ausführen.
- [x] Git-Diff auf erlaubten Umfang prüfen.
