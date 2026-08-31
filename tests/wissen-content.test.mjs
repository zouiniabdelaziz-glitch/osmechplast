import assert from 'node:assert/strict';
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
