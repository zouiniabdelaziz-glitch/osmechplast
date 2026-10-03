import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const playwrightPath = process.env.OSMP_PLAYWRIGHT_MODULE;
const browserPath = process.env.OSMP_BROWSER_EXECUTABLE;
function assertVisibleBox(box, viewportWidth, viewportHeight, label) {
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= viewportWidth && box.y + box.height <= viewportHeight, `${label} must be fully visible and reachable`);
}

test('internal UI renders accepted states in a browser without interpreting customer text as markup', { skip: !playwrightPath || !browserPath }, async () => {
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  let withFile = false;
  let statusConflict = false;
  let reviewExpired = false;
  let downloadMode = 'success';
  let reviewRequests = 0;
  let lead2Status = 'new';
  const statusRequests = [];
  const server = createServer((request, response) => {
    if (request.url === '/internal/' || request.url === '/internal') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(readFileSync('internal/index.html')); return; }
    if (request.url === '/internal/internal.js') { response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); response.end(readFileSync('internal/internal.js')); return; }
    if (request.url === '/internal/internal.css') { response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(readFileSync('internal/internal.css')); return; }
    if (/^\/internal\/api\/leads\/[12]\/status$/u.test(request.url) && request.method === 'POST') { let body = ''; request.on('data', (chunk) => { body += chunk; }); request.on('end', () => { const parsed = JSON.parse(body); statusRequests.push(parsed); const leadId = request.url.split('/')[4]; const conflict = leadId === '1' && statusConflict; if (!conflict && leadId === '2') lead2Status = parsed.target_status; response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' }); response.end(JSON.stringify(conflict ? { error: 'status_conflict' } : { ok: true, status: parsed.target_status, version: 1 })); }); return; }
    if (request.url === '/internal/leads/1/uploads/u1/approve' && request.method === 'POST') { reviewRequests += 1; setTimeout(() => { response.writeHead(reviewExpired ? 401 : 200, { 'content-type': 'application/json' }); response.end(JSON.stringify(reviewExpired ? { error: 'unauthorized' } : { ok: true })); }, 50); return; }
    if (request.url === '/internal/leads/1/uploads/u1') { if (downloadMode === 'network') { response.destroy(); return; } if (downloadMode === 'delayed-404') { setTimeout(() => { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'download_failed' })); }, 100); return; } if (downloadMode !== 'success') { response.writeHead(Number(downloadMode), { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'download_failed' })); return; } response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="part.pdf"' }); response.end('synthetic-pdf'); return; }
    if (request.url === '/internal/api/leads/1' || request.url === '/internal/api/leads/2') { const id = request.url.endsWith('/2') ? 2 : 1; response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ id, company: id === 1 ? '<img src=x onerror=alert(1)>' : 'Zweite Anfrage', name: 'Test', email: `test${id}@example.test`, service: 'CNC-Drehen', language: 'Deutsch', message: 'Synthetische Nachricht', created_at: '2026-09-25T00:00:00Z', workflow_status: id === 2 ? lead2Status : 'new', workflow_version: id === 2 && lead2Status !== 'new' ? 1 : 0, uploads: id === 1 && withFile ? [{ id: 'u1', original_name: 'part.pdf', extension: 'pdf', byte_size: 13, security_status: 'quarantine', allowed_actions: reviewExpired ? ['approve'] : ['download'] }] : [], events: [{ type: 'received', occurred_at: '2026-09-25T00:00:00Z' }] })); return; }
    if (request.url.startsWith('/internal/api/leads')) { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ items: [{ id: 1, company: '<img src=x onerror=alert(1)>', name: 'Test', email: 'test@example.test', file_count: 0, workflow_status: 'new', created_at: '2026-09-25T00:00:00Z' }, { id: 2, company: 'Zweite Anfrage', name: 'Test 2', email: 'test2@example.test', file_count: 0, workflow_status: lead2Status, created_at: '2026-09-25T00:00:01Z' }], page: 1, has_more: false })); return; }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  try {
    await page.goto(`http://127.0.0.1:${port}/internal/`);
    await page.locator('.lead-row').first().waitFor();
    withFile = true;
    await page.locator('.lead-row').first().click();
    await page.locator('h1').filter({ hasText: 'CNC-Drehen' }).waitFor();
    assert.equal(await page.locator('h1').first().textContent(), 'CNC-Drehen');
    assert.equal(await page.locator('img').count(), 0);
    assert.match(await page.locator('body').textContent(), /<img src=x onerror=alert\(1\)>/u);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'part.pdf');
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), 'synthetic-pdf');
    for (const mode of ['401', '404', '500', 'network']) {
      downloadMode = mode;
      await page.goto(`http://127.0.0.1:${port}/internal/`);
      await page.locator('.lead-row').first().waitFor();
      await page.locator('.lead-row').first().click();
      await page.getByRole('button', { name: 'Download' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();
      await page.getByRole('alert').waitFor();
      const message = await page.getByRole('alert').textContent();
      if (mode === '401') assert.match(message, /Anmeldung ist abgelaufen/u);
      else assert.match(message, /Download konnte nicht gestartet werden/u);
      assert.equal(await page.getByRole('dialog').count(), 0, `download dialog must close for ${mode}`);
    }
    assert.equal(pageErrors.length, 0, `download failures must not produce uncaught errors: ${pageErrors.map((error) => error.message).join('; ')}`);
    downloadMode = 'delayed-404';
    await page.goto(`http://127.0.0.1:${port}/internal/`);
    await page.locator('.lead-row').first().waitFor();
    await page.locator('.lead-row').first().click();
    await page.getByRole('button', { name: 'Download' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click();
    await page.goBack();
    await page.locator('.lead-row').first().waitFor();
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(await page.getByRole('alert').count(), 0, 'download error must not move to the overview');
    await page.locator('.lead-row').nth(1).click();
    await page.getByRole('button', { name: 'Status ändern' }).waitFor();
    assert.equal(await page.getByRole('alert').count(), 0, 'download error must not move to another lead');
    assert.equal(pageErrors.length, 0, `navigation during download must not produce uncaught errors: ${pageErrors.map((error) => error.message).join('; ')}`);
    downloadMode = 'success';
    await page.goto(`http://127.0.0.1:${port}/internal/`);
    await page.locator('.lead-row').first().waitFor();
    statusConflict = true;
    await page.locator('.lead-row').first().click();
    await page.getByRole('button', { name: 'Status ändern' }).click();
    assert.deepEqual(await page.getByRole('dialog').locator('select option').evaluateAll((options) => options.map((option) => option.value)), ['in_progress', 'completed']);
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(), /aktuellen Stand/u);
    assert.equal(await page.getByRole('button', { name: 'Status ändern' }).isDisabled(), true);
    const failedRequestId = statusRequests.at(-1).request_id;
    await page.goBack();
    await page.locator('.lead-row').nth(1).click();
    await page.goBack();
    await page.goForward();
    await page.getByRole('button', { name: 'Status ändern' }).waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Status ändern' }).isDisabled(), false);
    await page.getByRole('button', { name: 'Status ändern' }).click();
    assert.deepEqual(await page.getByRole('dialog').locator('select option').evaluateAll((options) => options.map((option) => option.value)), ['in_progress', 'completed']);
    await page.getByRole('dialog').locator('select').selectOption('in_progress');
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click();
    await page.getByRole('button', { name: 'Status ändern' }).waitFor();
    assert.equal(statusRequests.at(-1).target_status, 'in_progress');
    assert.notEqual(statusRequests.at(-1).request_id, failedRequestId);
    await page.getByRole('button', { name: 'Status ändern' }).click();
    assert.deepEqual(await page.getByRole('dialog').locator('select option').evaluateAll((options) => options.map((option) => option.value)), ['completed']);
    await page.getByRole('dialog').getByRole('button', { name: 'Übernehmen' }).click();
    await page.getByRole('button', { name: 'Wieder öffnen' }).waitFor();
    await page.getByRole('button', { name: 'Wieder öffnen' }).click();
    assert.deepEqual(await page.getByRole('dialog').locator('select option').evaluateAll((options) => options.map((option) => option.value)), ['in_progress']);
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    statusConflict = false;
    reviewExpired = true;
    await page.goto(`http://127.0.0.1:${port}/internal/`);
    await page.locator('.lead-row').first().waitFor();
    await page.locator('.lead-row').first().click();
    await page.getByRole('button', { name: 'Freigeben' }).click();
    const reviewSubmit = page.getByRole('dialog').getByRole('button', { name: 'Datei freigeben' });
    const reviewBox = await reviewSubmit.boundingBox();
    await Promise.all([page.mouse.click(reviewBox.x + reviewBox.width / 2, reviewBox.y + reviewBox.height / 2), page.mouse.click(reviewBox.x + reviewBox.width / 2, reviewBox.y + reviewBox.height / 2)]);
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(), /Anmeldung ist abgelaufen/u);
    assert.equal(reviewRequests, 1, 'review submit must not be sent twice');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `200% text must not create horizontal scrolling: ${await page.evaluate(() => JSON.stringify([...document.querySelectorAll('*')].map((node) => ({ tag: node.tagName, width: node.scrollWidth, right: node.getBoundingClientRect().right })).filter((item) => item.right > window.innerWidth + 1).slice(0, 5)))}`);
    withFile = true;
    statusConflict = false;
    reviewExpired = false;
    reviewRequests = 0;
    await page.goto(`http://127.0.0.1:${port}/internal/`);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '32px');
    await page.locator('.lead-row').first().waitFor();
    await page.locator('.lead-row').first().click();
    const mobileDownload = page.getByRole('button', { name: 'Download' });
    const mobileDownloadBox = await mobileDownload.boundingBox();
    assert.equal(await mobileDownload.isVisible(), true);
    assertVisibleBox(mobileDownloadBox, 390, 844, 'mobile download button');
    await mobileDownload.click();
    const mobileDialog = page.getByRole('dialog');
    assert.equal(await mobileDialog.isVisible(), true);
    const mobileDialogButtons = mobileDialog.getByRole('button');
    for (let index = 0; index < await mobileDialogButtons.count(); index += 1) {
      await mobileDialogButtons.nth(index).scrollIntoViewIfNeeded();
      const box = await mobileDialogButtons.nth(index).boundingBox();
      assertVisibleBox(box, 390, 844, `dialog button ${index}`);
    }
    await mobileDialog.getByRole('button', { name: 'Abbrechen' }).click();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('internal UI navigates beyond 25 leads and applies search/filter on mobile', { skip: !playwrightPath || !browserPath }, async () => {
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  const server = createServer((request, response) => {
    if (request.url === '/internal/' || request.url === '/internal') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(readFileSync('internal/index.html')); return; }
    if (request.url === '/internal/internal.js') { response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); response.end(readFileSync('internal/internal.js')); return; }
    if (request.url === '/internal/internal.css') { response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); response.end(readFileSync('internal/internal.css')); return; }
    if (request.url.startsWith('/internal/api/leads')) {
      const url = new URL(`http://local${request.url}`); const page = Number(url.searchParams.get('page') || 1); const query = url.searchParams.get('q') || ''; const filter = url.searchParams.get('status') || '';
      let items = Array.from({ length: 26 }, (_, index) => ({ id: index + 1, company: `Firma ${index + 1}`, name: `Kontakt ${index + 1}`, email: `kontakt${index + 1}@example.test`, file_count: 0, workflow_status: index % 2 ? 'completed' : 'new', created_at: '2026-09-25T00:00:00Z' }));
      if (query) items = items.filter((item) => `${item.company} ${item.name} ${item.email}`.includes(query));
      if (filter) items = items.filter((item) => item.workflow_status === filter);
      const pageItems = query || filter ? items : items.slice((page - 1) * 25, page * 25);
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ items: pageItems, page, has_more: !query && !filter && pageItems.length < items.length })); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: browserPath }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/internal/`);
    await page.locator('.lead-row').first().waitFor();
    assert.equal(await page.locator('.lead-row').count(), 25);
    await page.getByRole('button', { name: 'Nächste Seite' }).click();
    await page.locator('.lead-row').filter({ hasText: 'Firma 26' }).waitFor();
    assert.equal(await page.locator('.lead-row').count(), 1);
    assert.match(await page.locator('.lead-row').textContent(), /Firma 26/u);
    const search = page.locator('input[type="search"]'); await search.fill('26'); await search.dispatchEvent('change');
    await page.locator('.lead-row').filter({ hasText: 'Firma 26' }).waitFor();
    assert.equal(await page.locator('.lead-row').count(), 1);
    assert.match(await page.locator('.lead-row').textContent(), /Firma 26/u);
    await search.fill(''); await search.dispatchEvent('change'); await page.locator('select').selectOption('completed');
    await page.locator('.lead-row').first().waitFor();
    assert.equal(await page.locator('.lead-row').count(), 13);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const locator of [search, page.locator('select')]) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      assert.equal(await locator.isVisible(), true);
      assertVisibleBox(box, 390, 844, 'search/filter control');
    }
    const controls = page.getByRole('button', { name: 'Aktualisieren' });
    assert.equal(await controls.isVisible(), true);
    await controls.scrollIntoViewIfNeeded();
    assertVisibleBox(await controls.boundingBox(), 390, 844, 'refresh control');
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
});
