import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import Image from '@11ty/eleventy-img';

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export function resolveKnowledgeImage(src, root = process.cwd()) {
  if (typeof src !== 'string' || !src.startsWith('/assets/images/wissen/')) {
    throw new Error(`Knowledge images must use /assets/images/wissen/: ${src}`);
  }
  const mediaRoot = path.resolve(root, 'assets', 'images', 'wissen');
  const sourcePath = path.resolve(root, src.replace(/^\/+/, ''));
  const allowedPrefix = `${mediaRoot}${path.sep}`;
  if (!sourcePath.startsWith(allowedPrefix) || !existsSync(sourcePath)) {
    throw new Error(`Knowledge image does not exist or escapes its media directory: ${src}`);
  }
  if (statSync(sourcePath).size > MAX_IMAGE_BYTES) {
    throw new Error(`Knowledge image exceeds the 12 MB source limit: ${src}`);
  }
  return sourcePath;
}

export async function renderKnowledgeImage(
  src,
  alt,
  variant = 'content',
  options = {},
) {
  const root = options.root || process.cwd();
  const sourcePath = resolveKnowledgeImage(src, root);
  const hero = variant === 'hero';
  const outputDir = options.outputDir
    || path.join(root, '_site', 'assets', 'images', 'wissen', 'generated');
  const metadata = await Image(sourcePath, {
    widths: hero ? [480, 800, 1200] : [360, 720, 1080],
    formats: ['webp', 'jpeg'],
    outputDir,
    urlPath: '/assets/images/wissen/generated/',
    fixOrientation: true,
  });

  const attributes = {
    alt,
    class: hero ? 'knowledge-article__hero-image' : 'knowledge-article__content-image',
    sizes: hero ? '(max-width: 700px) 100vw, 1180px' : '(max-width: 700px) 100vw, 820px',
    loading: hero ? 'eager' : 'lazy',
    decoding: 'async',
  };
  if (hero) attributes.fetchpriority = 'high';

  return Image.generateHTML(metadata, attributes, {
    whitespaceMode: 'inline',
    fallback: 'largest',
  });
}
