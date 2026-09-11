import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

import {
  CLUSTERS,
  isPublished,
  mergeKnowledgeSitemap,
  publishedKnowledgeImagePaths,
  validateArticle,
} from './scripts/wissen-content.mjs';
import { renderKnowledgeImage } from './scripts/wissen-image.mjs';
import { PUBLIC_SITEMAP_XML } from './content/_data/public-sitemap.mjs';
import { isLocalPreview, draftUrl } from './scripts/preview-mode.mjs';
import { installEditorial, tocFromHtml, serviceLabel, imageLayout, imageSize } from './scripts/wissen-editorial.mjs';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, isLocalPreview() ? '_preview' : '_site');

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function cleanKnowledgeImageOutput(outputDir, articles) {
  const imageRoot = path.join(outputDir, 'assets', 'images', 'wissen');
  if (!existsSync(imageRoot)) return;

  const publishedPaths = publishedKnowledgeImagePaths(articles);
  const requiredSourceFiles = new Set([...publishedPaths].map((imagePath) => imagePath.slice(1).replaceAll('/', path.sep)));
  const generatedReferences = new Set();
  for (const htmlPath of walkFiles(outputDir).filter((filePath) => filePath.endsWith('.html'))) {
    const html = readFileSync(htmlPath, 'utf8');
    for (const match of html.matchAll(/\/assets\/images\/wissen\/(generated\/[^"'?#)\s]+)/g)) {
      generatedReferences.add(match[1].replaceAll('/', path.sep));
    }
  }

  for (const filePath of walkFiles(imageRoot)) {
    const relativePath = path.relative(imageRoot, filePath);
    const normalizedPath = relativePath.replaceAll('/', path.sep);
    const keep = normalizedPath.startsWith(`generated${path.sep}`)
      ? generatedReferences.has(normalizedPath)
      : requiredSourceFiles.has(path.join('assets', 'images', 'wissen', normalizedPath));
    if (!keep) rmSync(filePath, { force: true });
  }

  for (const imagePath of publishedPaths) {
    const relativeSource = imagePath.slice(1).replaceAll('/', path.sep);
    const sourcePath = path.resolve(ROOT, relativeSource);
    const relativeToRoot = path.relative(ROOT, sourcePath);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Published knowledge image escapes project root: ${imagePath}`);
    }
    if (!existsSync(sourcePath)) throw new Error(`Published knowledge image is missing: ${imagePath}`);
    const destinationPath = path.join(outputDir, relativeSource);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }
}

function asUtcDate(value) {
  if (value instanceof Date) return value;
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}

const publicDirectories = [
  'assets',
  'css',
  'js',
  'modules',
  'datenschutz',
  'impressum',
  'kontakt',
  'leistungen',
  'qualitaet',
  'technologie',
  'unternehmen',
  'werkstoffe',
];

const publicRootFiles = [
  '_headers',
  '_redirects',
  'robots.txt',
];

export default function (eleventyConfig) {
  let editorialMarkdown;
  let publishedKnowledgeItems = [];
  eleventyConfig.addFilter('editorialMarkdown', (value, index) => {
    if (!editorialMarkdown) throw new Error('Markdown renderer is not initialized');
    return editorialMarkdown.render(String(value || ''), { editorialPrefix: `bild-${Number(index) || 0}` });
  });
  eleventyConfig.addWatchTarget('modules/header.html');
  eleventyConfig.addWatchTarget('modules/footer.html');
  eleventyConfig.addWatchTarget('assets/images/wissen');
  eleventyConfig.amendLibrary('md', (markdownLibrary) => {
    markdownLibrary.set({ html: false, linkify: true, typographer: false });
    installEditorial(markdownLibrary);
    editorialMarkdown = markdownLibrary;
  });
  eleventyConfig.addFilter('articleToc', tocFromHtml);
  eleventyConfig.addFilter('serviceLabel', serviceLabel);
  eleventyConfig.addFilter('imageLayout', imageLayout);
  eleventyConfig.addFilter('imageSize', imageSize);

  for (const directory of publicDirectories) {
    if (existsSync(path.join(ROOT, directory))) eleventyConfig.addPassthroughCopy(directory);
  }
  for (const file of publicRootFiles) {
    if (existsSync(path.join(ROOT, file))) eleventyConfig.addPassthroughCopy(file);
  }
  eleventyConfig.addPassthroughCopy('*.html');

  eleventyConfig.addGlobalData('knowledgeClusters', CLUSTERS);
  eleventyConfig.addCollection('wissenDrafts', (collectionApi) => {
    if (!isLocalPreview()) return [];
    const all = collectionApi.getFilteredByTag('wissen');
    const urls = new Set();
    for (const item of all) {
      const url = draftUrl(item.data);
      if (urls.has(url)) throw new Error(`Duplicate knowledge URL: ${url}`);
      urls.add(url);
    }
    return all.filter((item) => !isPublished(item.data));
  });
  eleventyConfig.addAsyncShortcode('draftImage', async (src, alt) => {
    if (!isLocalPreview() || !src) return '';
    try {
      return await renderKnowledgeImage(src, alt || '', 'hero', {
        root: ROOT, outputDir: path.join(OUTPUT, 'assets', 'images', 'wissen', 'generated'),
      });
    } catch {
      return '<p>Entwurf: Bild fehlt oder ist für die Vorschau nicht verfügbar.</p>';
    }
  });
  eleventyConfig.addCollection('wissenPublished', (collectionApi) => {
    const articles = collectionApi
      .getFilteredByTag('wissen')
      .filter((item) => isPublished(item.data));

    const slugs = new Set();
    for (const item of articles) {
      validateArticle(item.data, item.inputPath);
      if (slugs.has(item.data.slug)) throw new Error(`Duplicate knowledge slug: ${item.data.slug}`);
      slugs.add(item.data.slug);
    }

    publishedKnowledgeItems = articles;

    return articles.sort((left, right) => {
      const leftDate = left.data.updated_at || left.data.published_at;
      const rightDate = right.data.updated_at || right.data.published_at;
      return rightDate.localeCompare(leftDate);
    });
  });

  eleventyConfig.addFilter('dateDE', (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(asUtcDate(value));
  });
  eleventyConfig.addFilter('dateISO', (value) => {
    if (!value) return '';
    return asUtcDate(value).toISOString().slice(0, 10);
  });
  eleventyConfig.addFilter('json', (value) => JSON.stringify(value).replace(/</g, '\\u003c'));
  eleventyConfig.addFilter('relatedKnowledge', (articles, slugs = []) => {
    const selected = new Set(Array.isArray(slugs) ? slugs : []);
    return articles.filter((item) => selected.has(item.data.slug));
  });
  eleventyConfig.addFilter('knowledgeSitemap', (articles) => {
    return mergeKnowledgeSitemap(PUBLIC_SITEMAP_XML, articles);
  });

  eleventyConfig.addAsyncShortcode('knowledgeImage', async (src, alt, variant = 'content') => {
    return renderKnowledgeImage(src, alt, variant, {
      root: ROOT,
      outputDir: path.join(OUTPUT, 'assets', 'images', 'wissen', 'generated'),
    });
  });

  eleventyConfig.on('eleventy.after', () => {
    cleanKnowledgeImageOutput(OUTPUT, publishedKnowledgeItems);
  });

  return {
    dir: {
      input: 'content',
      includes: '_includes',
      data: '_data',
      output: isLocalPreview() ? '_preview' : '_site',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['md', 'njk', '11ty.js'],
  };
}
