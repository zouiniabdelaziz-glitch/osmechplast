const SITE_KEY_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export function sanitizeTurnstileSiteKey(value) {
  const candidate = String(value ?? '').trim();
  return SITE_KEY_PATTERN.test(candidate) ? candidate : '';
}

export function injectTurnstileSiteKey(html, value) {
  const siteKey = sanitizeTurnstileSiteKey(value);
  return String(html).replace(
    /data-turnstile-sitekey="[^"]*"/g,
    `data-turnstile-sitekey="${siteKey}"`,
  );
}

export function injectTurnstileSiteKeyIntoFiles(outputDir, readFile, writeFile, exists, value = process.env.OSMP_TURNSTILE_SITE_KEY) {
  for (const relativePath of ['kontakt/index.html', 'modules/kontakt.html']) {
    const filePath = `${outputDir}/${relativePath}`;
    if (exists(filePath)) writeFile(filePath, injectTurnstileSiteKey(readFile(filePath), value));
  }
}
