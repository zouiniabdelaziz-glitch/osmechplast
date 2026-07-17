const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'outputs', 'business-card-mohammed');
const BRAND = path.join(ROOT, 'assets', 'brand');

fs.mkdirSync(OUT, { recursive: true });

const trimW = 85;
const trimH = 55;
const bleed = 3;
const W = trimW + bleed * 2;
const H = trimH + bleed * 2;

const C = {
  navy: '#061722',
  navy2: '#081E2D',
  red: '#E3000B',
  white: '#FFFFFF',
  paper: '#F6F7F8',
  silver: '#9AA3AD',
  line: '#D8DEE3',
  muted: '#56616B',
};

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : 'image/png';
  const b64 = fs.readFileSync(file).toString('base64');
  return `data:${mime};base64,${b64}`;
}

const logoHeader = dataUri(path.join(BRAND, 'osmechplast-logo-header.svg'));
const logoPrimary = dataUri(path.join(BRAND, 'osmechplast-logo-primary.svg'));

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(x, y, content, opt = {}) {
  const {
    size = 3,
    fill = C.navy,
    weight = 500,
    family = 'Afacad, Arial, Helvetica, sans-serif',
    spacing = 0,
    anchor = 'start',
    opacity = 1,
    transform = '',
  } = opt;
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="${family}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}" opacity="${opacity}"${transform ? ` transform="${transform}"` : ''}>${esc(content)}</text>`;
}

function mono(x, y, content, opt = {}) {
  return text(x, y, content, {
    family: 'JetBrains Mono, Consolas, monospace',
    size: opt.size || 2.05,
    fill: opt.fill || C.silver,
    weight: opt.weight || 600,
    spacing: opt.spacing ?? 0.18,
    anchor: opt.anchor || 'start',
    opacity: opt.opacity ?? 1,
  });
}

/* Minimal QR generator: QR Code Version 2-L, byte mode.
   Encodes https://osmechplast.com as vector modules. */
function makeQrMatrix(data) {
  const version = 2;
  const size = 21 + 4 * (version - 1);
  const dataCodewords = 34;
  const eccCodewords = 10;
  const bytes = [...Buffer.from(data, 'utf8')];
  const bits = [];
  const append = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, 8);
  bytes.forEach(b => append(b, 8));
  const maxBits = dataCodewords * 8;
  for (let i = 0; i < Math.min(4, maxBits - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  for (let pad = 0; codewords.length < dataCodewords; pad ^= 1) {
    codewords.push(pad ? 0x11 : 0xEC);
  }

  const gfExp = new Array(512);
  const gfLog = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
  const mul = (a, b) => (a && b) ? gfExp[gfLog[a] + gfLog[b]] : 0;
  let gen = [1];
  for (let i = 0; i < eccCodewords; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], gfExp[i]);
    }
    gen = next;
  }
  const msg = [...codewords, ...new Array(eccCodewords).fill(0)];
  for (let i = 0; i < codewords.length; i++) {
    const coef = msg[i];
    if (!coef) continue;
    for (let j = 0; j < gen.length; j++) msg[i + j] ^= mul(gen[j], coef);
  }
  const all = [...codewords, ...msg.slice(-eccCodewords)];
  const dataBits = [];
  all.forEach(b => appendTo(dataBits, b, 8));

  function appendTo(arr, val, len) {
    for (let i = len - 1; i >= 0; i--) arr.push((val >>> i) & 1);
  }

  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (xx, yy, val, res = true) => {
    if (xx < 0 || yy < 0 || xx >= size || yy >= size) return;
    matrix[yy][xx] = !!val;
    if (res) reserved[yy][xx] = true;
  };
  const reserve = (xx, yy) => {
    if (xx < 0 || yy < 0 || xx >= size || yy >= size) return;
    reserved[yy][xx] = true;
  };

  function finder(x0, y0) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const xx = x0 + x, yy = y0 + y;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const black = x >= 0 && y >= 0 && x <= 6 && y <= 6 &&
          (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        set(xx, yy, black);
      }
    }
  }
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i <= size - 9; i++) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const ax = 18 + x, ay = 18 + y;
      const black = Math.max(Math.abs(x), Math.abs(y)) === 2 || (x === 0 && y === 0);
      set(ax, ay, black);
    }
  }
  set(8, 17, true);
  for (let i = 0; i <= 5; i++) { reserve(8, i); reserve(i, 8); }
  reserve(8, 7); reserve(8, 8); reserve(7, 8);
  for (let i = 9; i < 15; i++) reserve(14 - i, 8);
  for (let i = 0; i < 8; i++) reserve(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) reserve(8, size - 15 + i);

  let bit = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const xx = col - c;
        if (!reserved[row][xx]) {
          matrix[row][xx] = !!dataBits[bit++];
        }
      }
    }
    upward = !upward;
  }

  const masks = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) === 0,
    (x, y) => (((x * y) % 2 + (x * y) % 3) % 2) === 0,
    (x, y) => (((x + y) % 2 + (x * y) % 3) % 2) === 0,
  ];
  function penalty(m) {
    let p = 0;
    for (let y = 0; y < size; y++) {
      let run = 1;
      for (let x = 1; x < size; x++) {
        if (m[y][x] === m[y][x - 1]) run++;
        else { if (run >= 5) p += 3 + run - 5; run = 1; }
      }
      if (run >= 5) p += 3 + run - 5;
    }
    for (let x = 0; x < size; x++) {
      let run = 1;
      for (let y = 1; y < size; y++) {
        if (m[y][x] === m[y - 1][x]) run++;
        else { if (run >= 5) p += 3 + run - 5; run = 1; }
      }
      if (run >= 5) p += 3 + run - 5;
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const v = m[y][x];
      if (m[y][x + 1] === v && m[y + 1][x] === v && m[y + 1][x + 1] === v) p += 3;
    }
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  }
  let bestMask = 0, best = null, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = matrix.map(row => row.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && masks[mask](x, y)) m[y][x] = !m[y][x];
    }
    const p = penalty(m);
    if (p < bestPenalty) { bestPenalty = p; bestMask = mask; best = m; }
  }

  function formatBits(mask) {
    const ecl = 1; // L
    const data = (ecl << 3) | mask;
    let bits = data << 10;
    const genPoly = 0x537;
    for (let i = 14; i >= 10; i--) {
      if ((bits >>> i) & 1) bits ^= genPoly << (i - 10);
    }
    return (((data << 10) | bits) ^ 0x5412) & 0x7FFF;
  }
  const fbits = formatBits(bestMask);
  const getBit = i => ((fbits >>> i) & 1) !== 0;
  const setFmt = (xx, yy, v) => { best[yy][xx] = v; };
  for (let i = 0; i <= 5; i++) setFmt(8, i, getBit(i));
  setFmt(8, 7, getBit(6));
  setFmt(8, 8, getBit(7));
  setFmt(7, 8, getBit(8));
  for (let i = 9; i < 15; i++) setFmt(14 - i, 8, getBit(i));
  for (let i = 0; i < 8; i++) setFmt(size - 1 - i, 8, getBit(i));
  for (let i = 8; i < 15; i++) setFmt(8, size - 15 + i, getBit(i));
  setFmt(8, size - 8, true);
  return best;
}

const qrMatrix = makeQrMatrix('https://osmechplast.com');

function qrSvg(x, y, sizeMm, dark = C.navy, bg = C.white) {
  const n = qrMatrix.length;
  const quiet = 4;
  const total = n + quiet * 2;
  const m = sizeMm / total;
  const rects = [];
  rects.push(`<rect x="${x}" y="${y}" width="${sizeMm}" height="${sizeMm}" fill="${bg}"/>`);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qrMatrix[r][c]) {
        rects.push(`<rect x="${(x + (c + quiet) * m).toFixed(3)}" y="${(y + (r + quiet) * m).toFixed(3)}" width="${m.toFixed(3)}" height="${m.toFixed(3)}" fill="${dark}"/>`);
      }
    }
  }
  return `<g shape-rendering="crispEdges">${rects.join('')}</g>`;
}

function wrap(name, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">
  <title>${esc(name)}</title>
  <desc>Business card 85 × 55 mm plus 3 mm bleed. Keep all critical content inside the 4 mm safety area from trim.</desc>
  <defs>
    <style>
      text { dominant-baseline: alphabetic; }
      .smallcaps { text-transform: uppercase; }
    </style>
  </defs>
  ${body}
</svg>`;
}

function logo(src, x, y, w, h) {
  return `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

function contactBlock(x, y, fill = C.navy, muted = C.muted, line = C.red) {
  const rows = [
    ['Telefon', '[Telefonnummer]'],
    ['E-Mail', '[E-Mail-Adresse]'],
    ['Web', 'osmechplast.com'],
    ['Adresse', 'Strada Romana 19, 38061 Ala TN, Italien'],
  ];
  let out = `<rect x="${x}" y="${y - 2.2}" width="20" height="0.55" fill="${line}"/>`;
  rows.forEach((r, i) => {
    const yy = y + 5 + i * 5.2;
    out += mono(x, yy, r[0].toUpperCase(), { fill: muted, size: 1.55, spacing: 0.12 });
    out += text(x + 13.4, yy, r[1], { fill, size: i === 3 ? 2.15 : 2.45, weight: 500 });
  });
  return out;
}

const files = {};

files['variante-1-vorderseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 1 Vorderseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.white}"/>
  <rect x="0" y="0" width="${W}" height="3.2" fill="${C.navy}"/>
  <rect x="7" y="8" width="9" height="0.7" fill="${C.red}"/>
  ${logo(logoHeader, 7, 11, 31, 12.6)}
  ${mono(7, 31.5, 'OS.MECHPLAST SRLS', { fill: C.red, size: 1.8, spacing: 0.18 })}
  ${text(7, 38.2, 'Mohammed [Nachname]', { size: 6.2, weight: 700, fill: C.navy })}
  ${text(7, 43.1, '[Offizielle Position]', { size: 2.75, weight: 600, fill: C.muted })}
  ${contactBlock(45, 17.4, C.navy, C.muted, C.red)}
  ${qrSvg(68.3, 38.2, 14.2)}
  ${mono(68.5, 55.5, 'osmechplast.com', { fill: C.muted, size: 1.45, spacing: 0.05 })}
`);

files['variante-1-rueckseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 1 Rückseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.navy}"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
  <rect x="7" y="8" width="15" height="0.7" fill="${C.red}"/>
  ${logo(logoPrimary, 19, 15, 53, 25.6)}
  ${text(45.5, 43.7, 'CNC-Drehen · Dreh-Fräsbearbeitung', { size: 2.65, fill: C.white, weight: 600, anchor: 'middle' })}
  ${text(45.5, 49.0, 'Prototypen · Kleinserien · Mittelserien', { size: 2.35, fill: C.silver, weight: 500, anchor: 'middle' })}
  ${text(45.5, 54.0, 'Kunststoff · Aluminium · zerspanbare Stahlwerkstoffe', { size: 2.2, fill: C.silver, weight: 500, anchor: 'middle' })}
`);

files['variante-2-vorderseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 2 Vorderseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.navy}"/>
  <rect x="0" y="0" width="3.2" height="${H}" fill="${C.red}"/>
  ${logo(logoHeader, 7, 8, 32, 13)}
  ${mono(7, 28.2, 'OS.MECHPLAST SRLS', { fill: C.red, size: 1.75, spacing: 0.18 })}
  ${text(7, 36.8, 'Mohammed [Nachname]', { size: 6.1, weight: 700, fill: C.white })}
  ${text(7, 41.9, '[Offizielle Position]', { size: 2.75, weight: 600, fill: C.silver })}
  ${contactBlock(45.5, 17.4, C.white, C.silver, C.red)}
  ${qrSvg(68.4, 38.2, 14.1, C.navy, C.white)}
`);

files['variante-2-rueckseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 2 Rückseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.navy}"/>
  <rect x="7" y="52.8" width="77" height="0.6" fill="${C.silver}" opacity="0.55"/>
  <rect x="7" y="52.8" width="16" height="0.6" fill="${C.red}"/>
  ${logo(logoPrimary, 18.5, 12.2, 54, 26.1)}
  ${text(45.5, 43.1, 'CNC-Drehen · Dreh-Fräsbearbeitung', { size: 2.75, fill: C.white, weight: 600, anchor: 'middle' })}
  ${text(45.5, 48.0, 'Prototypen · Kleinserien · Mittelserien', { size: 2.35, fill: C.silver, weight: 500, anchor: 'middle' })}
  ${text(45.5, 55.6, 'Kunststoff · Aluminium · zerspanbare Stahlwerkstoffe', { size: 2.1, fill: C.silver, weight: 500, anchor: 'middle' })}
`);

files['variante-3-vorderseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 3 Vorderseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.paper}"/>
  <rect x="0" y="0" width="24" height="${H}" fill="${C.navy}"/>
  <rect x="21.4" y="7" width="0.65" height="16" fill="${C.red}"/>
  ${logo(logoHeader, 6.1, 8.5, 31.5, 12.8)}
  ${mono(30, 16.2, 'OS.MECHPLAST SRLS', { fill: C.red, size: 1.75, spacing: 0.18 })}
  ${text(30, 26.7, 'Mohammed', { size: 6.2, weight: 700, fill: C.navy })}
  ${text(30, 33.4, '[Nachname]', { size: 6.2, weight: 700, fill: C.navy })}
  ${text(30, 39.0, '[Offizielle Position]', { size: 2.75, weight: 600, fill: C.muted })}
  ${contactBlock(30, 46.0, C.navy, C.muted, C.red)}
  ${qrSvg(69.2, 10.6, 14.6)}
`);

files['variante-3-rueckseite.svg'] = wrap('OSMP Visitenkarte Mohammed Variante 3 Rückseite', `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.navy}"/>
  <rect x="61" y="0" width="30" height="${H}" fill="${C.white}"/>
  <rect x="61" y="0" width="2.2" height="${H}" fill="${C.red}"/>
  ${logo(logoPrimary, 7.8, 15.4, 48.5, 23.4)}
  ${mono(66, 16.8, 'FERTIGUNG', { fill: C.red, size: 1.75, spacing: 0.18 })}
  ${text(66, 25.2, 'CNC-Drehen', { size: 3.25, fill: C.navy, weight: 700 })}
  ${text(66, 31.4, 'Dreh-Fräsbearbeitung', { size: 3.05, fill: C.navy, weight: 700 })}
  ${text(66, 40.2, 'Prototypen', { size: 2.45, fill: C.muted, weight: 600 })}
  ${text(66, 45.2, 'Kleinserien', { size: 2.45, fill: C.muted, weight: 600 })}
  ${text(66, 50.2, 'Mittelserien', { size: 2.45, fill: C.muted, weight: 600 })}
  ${text(7.8, 51.5, 'Kunststoff · Aluminium · zerspanbare Stahlwerkstoffe', { size: 2.25, fill: C.silver, weight: 500 })}
`);

for (const [file, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, file), content, 'utf8');
}

const preview = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OSMP Visitenkarte Mohammed – Varianten</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Afacad:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    :root { --navy:${C.navy}; --red:${C.red}; --paper:#f3f5f6; --ink:#0b1720; --muted:#5a6570; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:Afacad, Arial, sans-serif; }
    main { max-width:1380px; margin:0 auto; padding:38px 28px 60px; }
    h1 { margin:0 0 8px; font-size:34px; line-height:1.05; letter-spacing:-.03em; }
    .lead { max-width:820px; margin:0 0 28px; color:var(--muted); font-size:18px; }
    .variant { margin:28px 0 42px; padding:24px; background:#fff; border:1px solid #d8dee3; }
    .variant-head { display:flex; justify-content:space-between; gap:24px; align-items:end; margin-bottom:18px; }
    h2 { margin:0; font-size:24px; letter-spacing:-.02em; }
    .note { margin:0; color:var(--muted); font-size:15px; }
    .cards { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:20px; align-items:start; }
    figure { margin:0; }
    figcaption { margin:10px 0 0; font:600 12px/1.2 'JetBrains Mono', Consolas, monospace; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
    .card { width:100%; aspect-ratio:91 / 61; background:#fff; border:1px solid #ccd3da; display:block; }
    .recommendation { padding:22px 24px; background:var(--navy); color:white; border-left:7px solid var(--red); }
    .recommendation h2 { color:white; }
    .recommendation p { margin:10px 0 0; color:#c6ced5; font-size:17px; max-width:900px; }
    .files { margin-top:26px; color:var(--muted); font-size:15px; }
    .files code { color:var(--ink); }
    @media (max-width: 900px) { .cards { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>OSMP Visitenkarte Mohammed – 3 Varianten</h1>
    <p class="lead">Format 85 × 55 mm quer, angelegt mit 3 mm Beschnitt als 91 × 61 mm SVG. Keine Schnittmarken im Design. QR-Code führt direkt auf https://osmechplast.com.</p>

    ${[1,2,3].map(i => `
    <section class="variant">
      <div class="variant-head">
        <div>
          <h2>Variante ${i}</h2>
          <p class="note">${i === 1 ? 'Helle Kontaktseite, dunkle Rückseite – sehr seriös und gut lesbar.' : i === 2 ? 'Beide Seiten dunkel – stärkste Markenwirkung, sehr kompakt.' : 'Asymmetrisches Raster – technisch, moderner, etwas markanter.'}</p>
        </div>
      </div>
      <div class="cards">
        <figure>
          <img class="card" src="variante-${i}-vorderseite.svg" alt="Variante ${i} Vorderseite">
          <figcaption>Vorderseite</figcaption>
        </figure>
        <figure>
          <img class="card" src="variante-${i}-rueckseite.svg" alt="Variante ${i} Rückseite">
          <figcaption>Rückseite</figcaption>
        </figure>
      </div>
    </section>`).join('')}

    <section class="recommendation">
      <h2>Empfehlung: Variante 1</h2>
      <p>Variante 1 ist für technische Einkäufer und Industriekunden am stärksten: Der Name ist sofort lesbar, die Kontaktseite wirkt ruhig und professionell, die dunkle Rückseite trägt die Marke klar. Sie passt am besten zu einem CNC-Zulieferer, weil sie präzise, nicht laut und sehr vertrauenswürdig wirkt.</p>
    </section>

    <p class="files">Produktionsdateien liegen in <code>outputs/business-card-mohammed/</code>. Für echte Druckfreigabe bitte Telefonnummer, E-Mail, Nachname und Position ersetzen, danach als PDF/X beim Druckdienst exportieren.</p>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(OUT, 'preview.html'), preview, 'utf8');

const notes = `OSMP Visitenkarte Mohammed

Format:
- Produktions-SVG je Seite: 91 × 61 mm
- Endformat: 85 × 55 mm
- Beschnitt: 3 mm umlaufend
- Sicherheitsabstand: Elemente bewusst innerhalb der sicheren Zone platziert

Farben:
- Navy: ${C.navy}
- Rot: ${C.red}
- Weiß: ${C.white}
- Silber/Grau: ${C.silver}

Offene Platzhalter:
- Mohammed [Nachname]
- [Offizielle Position]
- [Telefonnummer]
- [E-Mail-Adresse]

Empfehlung:
Variante 1.
Sie ist am besten lesbar, seriös und für B2B-CNC-Kunden am vertrauenswürdigsten.
`;
fs.writeFileSync(path.join(OUT, 'README.txt'), notes, 'utf8');

console.log(`Created ${Object.keys(files).length} SVG files plus preview.html in ${OUT}`);
