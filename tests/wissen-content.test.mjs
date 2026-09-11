import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CLUSTERS,
  articleUrl,
  isPublished,
  mergeKnowledgeSitemap,
  validateArticle,
} from '../scripts/wissen-content.mjs';

const validPublishedArticle = () => ({
  title: 'Fertigungsgerechte CNC-Anfrage vorbereiten',
  slug: 'cnc-anfrage-vorbereiten',
  meta_description: 'Technische Angaben für eine nachvollziehbare CNC-Anfrage zusammenstellen und Zeichnung, Werkstoff sowie Menge vollständig übermitteln.',
  summary: 'Welche Angaben Einkauf und Konstruktion für eine technische CNC-Anfrage bereitstellen sollten.',
  cluster: 'CNC-Anfragen, Einkauf und Kosten',
  author: 'OS.MECHPLAST Redaktion',
  published_at: '2026-08-31',
  hero_image: '/assets/images/wissen/cnc-anfrage.jpg',
  hero_alt: 'Technische Zeichnung für eine CNC-Anfrage',
  hero_approval: 'freigegeben',
  service_link: '/kontakt/',
  cta_label: 'CNC-Anfrage vorbereiten',
  cta_url: '/kontakt/',
  draft: false,
});

test('provides exactly the six approved knowledge clusters', () => {
  assert.deepEqual(CLUSTERS, [
    'Fertigungsgerechte Konstruktion',
    'Werkstoffe für CNC-Drehteile',
    'CNC-Drehen und Dreh-Fräsen',
    'Toleranzen, Oberflächen und Qualität',
    'Prototypen, Serien und Fertigungsplanung',
    'CNC-Anfragen, Einkauf und Kosten',
  ]);
});

test('uses consistent cluster translations across all supported languages', () => {
  const source = readFileSync(new URL('../js/translations.js', import.meta.url), 'utf8');

  const deTranslations = [
    "cluster_design: 'Fertigungsgerechte Konstruktion'",
    "cluster_materials: 'Werkstoffe für CNC-Drehteile'",
    "cluster_turning: 'CNC-Drehen und Dreh-Fräsen'",
    "cluster_quality: 'Toleranzen, Oberflächen und Qualität'",
    "cluster_series: 'Prototypen, Serien und Fertigungsplanung'",
    "cluster_request: 'CNC-Anfragen, Einkauf und Kosten'",
  ];

  for (const translation of deTranslations) {
    assert.match(source, new RegExp(translation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing German cluster label: ${translation}`);
  }

  const languageTranslations = {
    it: {
      'Fertigungsgerechte Konstruktion': 'Progettazione per la lavorazione',
      'Werkstoffe für CNC-Drehteile': 'Materiali per particolari torniti CNC',
      'CNC-Drehen und Dreh-Fräsen': 'Tornitura CNC e tornio-fresatura',
      'Toleranzen, Oberflächen und Qualität': 'Tolleranze, superfici e qualità',
      'Prototypen, Serien und Fertigungsplanung': 'Prototipi, serie e pianificazione della produzione',
      'CNC-Anfragen, Einkauf und Kosten': 'Richieste CNC, acquisti e costi',
    },
    en: {
      'Fertigungsgerechte Konstruktion': 'Design for manufacturability',
      'Werkstoffe für CNC-Drehteile': 'Materials for CNC turned parts',
      'CNC-Drehen und Dreh-Fräsen': 'CNC turning and turn-milling',
      'Toleranzen, Oberflächen und Qualität': 'Tolerances, surfaces and quality',
      'Prototypen, Serien und Fertigungsplanung': 'Prototypes, series and production planning',
      'CNC-Anfragen, Einkauf und Kosten': 'CNC inquiries, purchasing and costs',
    },
    fr: {
      'Fertigungsgerechte Konstruktion': 'Conception pour l’usinage',
      'Werkstoffe für CNC-Drehteile': 'Matières pour pièces tournées CNC',
      'CNC-Drehen und Dreh-Fräsen': 'Tournage CNC et tournage-fraisage',
      'Toleranzen, Oberflächen und Qualität': 'Tolérances, surfaces et qualité',
      'Prototypen, Serien und Fertigungsplanung': 'Prototypes, séries et planification de production',
      'CNC-Anfragen, Einkauf und Kosten': 'Demandes CNC, achats et coûts',
    },
  };

  for (const [lang, values] of Object.entries(languageTranslations)) {
    for (const [sourceText, targetText] of Object.entries(values)) {
      assert.match(source, new RegExp(`'${sourceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'${targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `missing ${lang} translation for ${sourceText}`);
    }
  }
});

test('accepts a complete published article and returns its clean URL', () => {
  const article = validPublishedArticle();
  assert.doesNotThrow(() => validateArticle(article, 'content/wissen/test.md'));
  assert.equal(isPublished(article), true);
  assert.equal(articleUrl(article), '/wissen/cnc-anfrage-vorbereiten/');
});

test('treats only explicit draft false as published', () => {
  assert.equal(isPublished({ draft: false }), true);
  assert.equal(isPublished({ draft: true }), false);
  assert.equal(isPublished({}), false);
});

test('allows incomplete drafts without exposing a URL', () => {
  const draft = { draft: true, title: 'Arbeitsstand' };
  assert.doesNotThrow(() => validateArticle(draft, 'content/wissen/arbeitsstand.md'));
  assert.equal(articleUrl(draft), false);
});

test('rejects published articles with missing required metadata', () => {
  const article = validPublishedArticle();
  delete article.author;
  assert.throws(
    () => validateArticle(article, 'content/wissen/test.md'),
    /author/,
  );
});

test('normalizes YAML date objects and rejects impossible calendar dates', () => {
  const parsedYamlArticle = validPublishedArticle();
  parsedYamlArticle.published_at = new Date('2026-08-31T00:00:00.000Z');
  parsedYamlArticle.updated_at = new Date('2026-09-01T00:00:00.000Z');
  validateArticle(parsedYamlArticle, 'content/wissen/yaml-date.md');
  assert.equal(parsedYamlArticle.published_at, '2026-08-31');
  assert.equal(parsedYamlArticle.updated_at, '2026-09-01');

  const impossibleDate = validPublishedArticle();
  impossibleDate.published_at = '2026-02-31';
  assert.throws(
    () => validateArticle(impossibleDate, 'content/wissen/impossible-date.md'),
    /published_at/,
  );
});

test('rejects unsafe slugs and unapproved clusters', () => {
  const unsafeSlug = validPublishedArticle();
  unsafeSlug.slug = '../Interner Ordner';
  assert.throws(() => validateArticle(unsafeSlug, 'unsafe.md'), /slug/);

  const unknownCluster = validPublishedArticle();
  unknownCluster.cluster = 'Nicht freigegeben';
  assert.throws(() => validateArticle(unknownCluster, 'cluster.md'), /cluster/);
});

test('rejects unapproved or externally hosted hero images', () => {
  const externalImage = validPublishedArticle();
  externalImage.hero_image = 'https://example.com/image.jpg';
  assert.throws(() => validateArticle(externalImage, 'image.md'), /hero_image/);

  const traversalImage = validPublishedArticle();
  traversalImage.hero_image = '/assets/images/wissen/../private.jpg';
  assert.throws(() => validateArticle(traversalImage, 'traversal.md'), /hero_image/);

  const absoluteImage = validPublishedArticle();
  absoluteImage.hero_image = 'C:/private/image.png';
  assert.throws(() => validateArticle(absoluteImage, 'absolute.md'), /hero_image/);

  const pendingImage = validPublishedArticle();
  pendingImage.hero_approval = 'intern';
  assert.throws(() => validateArticle(pendingImage, 'approval.md'), /hero_approval/);
});

test('validates optional content images with alt text and approval', () => {
  const article = validPublishedArticle();
  article.content_images = [{
    image: '/assets/images/wissen/detail.webp',
    alt: '',
    caption: 'Bauteildetail',
    credit: 'OS.MECHPLAST',
    approval: 'freigegeben',
  }];
  assert.throws(() => validateArticle(article, 'content-image.md'), /content_images\[0\]\.alt/);
});

test('adds the overview and published articles to a sitemap without duplicates', () => {
  const base = '<?xml version="1.0"?><urlset><url><loc>https://osmechplast.com/</loc></url></urlset>';
  const article = validPublishedArticle();
  const merged = mergeKnowledgeSitemap(base, [{ data: article }]);
  assert.equal((merged.match(/https:\/\/osmechplast\.com\/wissen\//g) || []).length, 2);
  assert.match(merged, /https:\/\/osmechplast\.com\/wissen\/cnc-anfrage-vorbereiten\//);

  const mergedAgain = mergeKnowledgeSitemap(merged, [{ data: article }]);
  assert.equal((mergedAgain.match(/https:\/\/osmechplast\.com\/wissen\//g) || []).length, 2);
});
