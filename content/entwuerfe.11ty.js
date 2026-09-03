import { isLocalPreview, draftUrl, escapeHtml } from '../scripts/preview-mode.mjs';

export default class {
  data() {
    return { permalink: isLocalPreview() ? 'entwuerfe/index.html' : false, eleventyExcludeFromCollections: true };
  }

  render(data) {
    if (!isLocalPreview()) return '';
    const drafts = data.collections.wissenDrafts || [];
    const list = drafts.map((item) => `<li><a href="${escapeHtml(draftUrl(item.data))}">${escapeHtml(item.data.title || item.data.page.fileSlug)}</a></li>`).join('\n');
    return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>Lokale Wissen-Entwürfe</title></head>
<body><main><h1>ENTWURF – NICHT VERÖFFENTLICHT</h1>
<p>Nur lokal verfügbar. Änderungen speichern und diese Seite neu laden.</p>
${list ? `<ul>${list}</ul>` : '<p>Keine lokalen Entwürfe vorhanden. Entwurfsdateien gehören nach content/wissen/ und behalten draft: true.</p>'}
<a href="/wissen/">Veröffentlichte Wissensübersicht</a></main></body></html>`;
  }
}
