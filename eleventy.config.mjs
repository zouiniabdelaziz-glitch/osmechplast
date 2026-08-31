import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  CLUSTERS,
  isPublished,
  mergeKnowledgeSitemap,
  validateArticle,
} from './scripts/wissen-content.mjs';
import { renderKnowledgeImage } from './scripts/wissen-image.mjs';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, '_site');

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
  eleventyConfig.addWatchTarget('modules/header.html');
  eleventyConfig.addWatchTarget('modules/footer.html');
  eleventyConfig.addWatchTarget('assets/images/wissen');
  eleventyConfig.amendLibrary('md', (markdownLibrary) => {
    markdownLibrary.set({ html: false, linkify: true, typographer: false });
  });

  for (const directory of publicDirectories) {
    if (existsSync(path.join(ROOT, directory))) eleventyConfig.addPassthroughCopy(directory);
  }
  for (const file of publicRootFiles) {
    if (existsSync(path.join(ROOT, file))) eleventyConfig.addPassthroughCopy(file);
  }
  eleventyConfig.addPassthroughCopy('*.html');

  eleventyConfig.addGlobalData('knowledgeClusters', CLUSTERS);
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
    }).format(new Date(`${value}T00:00:00Z`));
  });
  eleventyConfig.addFilter('json', (value) => JSON.stringify(value).replace(/</g, '\\u003c'));
  eleventyConfig.addFilter('relatedKnowledge', (articles, slugs = []) => {
    const selected = new Set(Array.isArray(slugs) ? slugs : []);
    return articles.filter((item) => selected.has(item.data.slug));
  });
  eleventyConfig.addFilter('knowledgeSitemap', (articles) => {
    const baseSitemap = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    return mergeKnowledgeSitemap(baseSitemap, articles);
  });

  eleventyConfig.addAsyncShortcode('knowledgeImage', async (src, alt, variant = 'content') => {
    return renderKnowledgeImage(src, alt, variant, {
      root: ROOT,
      outputDir: path.join(OUTPUT, 'assets', 'images', 'wissen', 'generated'),
    });
  });

  return {
    dir: {
      input: 'content',
      includes: '_includes',
      data: '_data',
      output: '_site',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['md', 'njk'],
  };
}
