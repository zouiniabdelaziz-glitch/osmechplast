export const CLUSTERS = Object.freeze([
  'Fertigungsgerechte Konstruktion',
  'Werkstoffe für CNC-Drehteile',
  'CNC-Drehen und Dreh-Fräsen',
  'Toleranzen, Oberflächen und Qualität',
  'Prototypen, Serien und Fertigungsplanung',
  'CNC-Anfragen, Einkauf und Kosten',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KNOWLEDGE_IMAGE_PATTERN = /^\/assets\/images\/wissen\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp)$/i;
const INTERNAL_TARGET_PATTERN = /^\/(?:kontakt|leistungen|werkstoffe|technologie|qualitaet|unternehmen|wissen)(?:\/[a-z0-9-]+)?\/$/;

function requireString(data, field, inputPath, maxLength = Infinity) {
  const value = data[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${inputPath}: ${field} is required`);
  }
  if (value.trim().length > maxLength) {
    throw new Error(`${inputPath}: ${field} exceeds ${maxLength} characters`);
  }
}

function normalizeDate(value, field, inputPath) {
  let normalized = value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    normalized = value.toISOString().slice(0, 10);
  }
  if (typeof normalized !== 'string' || !DATE_PATTERN.test(normalized)) {
    throw new Error(`${inputPath}: ${field} must use YYYY-MM-DD`);
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${inputPath}: ${field} must use a valid calendar date`);
  }
  return normalized;
}

function validateImage(image, prefix, inputPath) {
  if (!image || typeof image !== 'object') {
    throw new Error(`${inputPath}: ${prefix} must be an object`);
  }
  if (!KNOWLEDGE_IMAGE_PATTERN.test(image.image || '')) {
    throw new Error(`${inputPath}: ${prefix}.image must be stored below /assets/images/wissen/`);
  }
  if (typeof image.alt !== 'string' || image.alt.trim() === '') {
    throw new Error(`${inputPath}: ${prefix}.alt is required`);
  }
  if (image.approval !== 'freigegeben') {
    throw new Error(`${inputPath}: ${prefix}.approval must be freigegeben`);
  }
}

export function isPublished(data) {
  return data?.draft === false;
}

export function articleUrl(data) {
  if (!isPublished(data)) return false;
  if (!SLUG_PATTERN.test(data?.slug || '')) {
    throw new Error('slug must contain lowercase letters, numbers and hyphens only');
  }
  return `/wissen/${data.slug}/`;
}

export function validateArticle(data, inputPath = 'knowledge article') {
  if (!isPublished(data)) return data;

  requireString(data, 'title', inputPath, 90);
  requireString(data, 'slug', inputPath, 80);
  requireString(data, 'meta_description', inputPath, 160);
  requireString(data, 'summary', inputPath, 320);
  requireString(data, 'author', inputPath, 100);
  data.published_at = normalizeDate(data.published_at, 'published_at', inputPath);

  if (!SLUG_PATTERN.test(data.slug)) {
    throw new Error(`${inputPath}: slug must contain lowercase letters, numbers and hyphens only`);
  }
  if (!CLUSTERS.includes(data.cluster)) {
    throw new Error(`${inputPath}: cluster is not approved`);
  }
  if (data.updated_at) {
    data.updated_at = normalizeDate(data.updated_at, 'updated_at', inputPath);
  }
  if (!KNOWLEDGE_IMAGE_PATTERN.test(data.hero_image || '')) {
    throw new Error(`${inputPath}: hero_image must be stored below /assets/images/wissen/`);
  }
  requireString(data, 'hero_alt', inputPath, 240);
  if (data.hero_approval !== 'freigegeben') {
    throw new Error(`${inputPath}: hero_approval must be freigegeben`);
  }
  if (!INTERNAL_TARGET_PATTERN.test(data.service_link || '')) {
    throw new Error(`${inputPath}: service_link must be an approved clean internal URL`);
  }
  requireString(data, 'cta_label', inputPath, 80);
  if (!INTERNAL_TARGET_PATTERN.test(data.cta_url || '')) {
    throw new Error(`${inputPath}: cta_url must be an approved clean internal URL`);
  }

  if (data.content_images !== undefined && !Array.isArray(data.content_images)) {
    throw new Error(`${inputPath}: content_images must be a list`);
  }
  for (const [index, image] of (data.content_images || []).entries()) {
    validateImage(image, `content_images[${index}]`, inputPath);
  }

  if (data.related_articles !== undefined && !Array.isArray(data.related_articles)) {
    throw new Error(`${inputPath}: related_articles must be a list`);
  }
  for (const slug of data.related_articles || []) {
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`${inputPath}: related_articles contains an invalid slug`);
    }
  }

  if (data.sources !== undefined && !Array.isArray(data.sources)) {
    throw new Error(`${inputPath}: sources must be a list`);
  }
  for (const [index, source] of (data.sources || []).entries()) {
    if (!source || typeof source.label !== 'string' || source.label.trim() === '') {
      throw new Error(`${inputPath}: sources[${index}].label is required`);
    }
    if (!/^https:\/\//i.test(source.url || '')) {
      throw new Error(`${inputPath}: sources[${index}].url must use HTTPS`);
    }
  }

  articleUrl(data);
  return data;
}

export function mergeKnowledgeSitemap(baseXml, articles = []) {
  if (typeof baseXml !== 'string' || !baseXml.includes('</urlset>')) {
    throw new Error('sitemap.xml must contain a closing </urlset> element');
  }

  const withoutKnowledgeUrls = baseXml.replace(
    /\s*<url>\s*<loc>https:\/\/osmechplast\.com\/wissen\/[^<]*<\/loc>[\s\S]*?<\/url>/gi,
    '',
  );
  const published = articles.filter((item) => isPublished(item?.data));
  const lastmod = published
    .map((item) => item.data.updated_at || item.data.published_at)
    .filter(Boolean)
    .sort()
    .at(-1) || '2026-08-31';

  const entries = [
    `  <url>\n    <loc>https://osmechplast.com/wissen/</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
    ...published.map((item) => {
      validateArticle(item.data, item.inputPath || 'knowledge article');
      const date = item.data.updated_at || item.data.published_at;
      return `  <url>\n    <loc>https://osmechplast.com${articleUrl(item.data)}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
    }),
  ];

  return `${withoutKnowledgeUrls.replace(/\s*<\/urlset>\s*$/, '')}\n\n  <!-- Wissen -->\n${entries.join('\n')}\n</urlset>\n`;
}
