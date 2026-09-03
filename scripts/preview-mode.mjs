// Process-local capability, deliberately NOT controlled by an environment flag.
// The ordinary Eleventy CLI / npm run build never activates this capability.
let active = false;

export function enableLocalPreview(env = process.env) {
  const hosted = Object.keys(env).some((key) => /^(CI$|CF_PAGES(?:_|$)|CLOUDFLARE|GITHUB_ACTIONS$)/i.test(key));
  if (env.npm_lifecycle_event !== 'dev:preview' || hosted) {
    throw new Error('Local preview denied: use npm run dev:preview locally, never in Cloudflare/CI.');
  }
  active = true;
}

export function isLocalPreview() {
  return active;
}

export function draftUrl(data) {
  const slug = data.slug || data.page?.fileSlug;
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Draft preview requires a safe lowercase slug or filename.');
  }
  return `/wissen/${slug}/`;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
