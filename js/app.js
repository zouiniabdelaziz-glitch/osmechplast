/* =============================================
   OS. CNC MECHPLAST — CORE APP
   Datei: js/app.js
   Enthält: Sprache, Cloudflare API, AI-Analyse, Formular
   ============================================= */

/* ── KONFIGURATION ───────────────────────────── */
const CONFIG = {
  defaultLang: 'de',
};

/* ── SPRACHE ─────────────────────────────────── */
let currentLang = CONFIG.defaultLang;

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === lang)
  );
  applyTranslations();
  document.documentElement.lang = lang;
}

function applyTranslations() {
  const t = T[currentLang];
  if (!t) return;

  // Texte
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    if (!t[key]) return;
    if (key === 'hero_h1_html' || key === 'contact_h2') {
      el.innerHTML = t[key];
    } else {
      el.textContent = t[key];
    }
  });

  // Select-Optionen
  const sel = document.getElementById('f_service');
  if (sel) {
    ['f_service_opt0','f_service_opt1','f_service_opt2','f_service_opt3','f_service_opt4']
      .forEach((k, i) => { if (sel.options[i] && t[k]) sel.options[i].text = t[k]; });
  }

  // Ticker neu befüllen
  const ticker = document.getElementById('tickerInner');
  if (ticker && t.ticker_items) {
    const doubled = [...t.ticker_items, ...t.ticker_items];
    ticker.innerHTML = doubled.map(i => `<span class="ticker-item">${i}</span>`).join('');
  }
}

/* ── CLOUDFLARE D1 LEAD SPEICHERN ────────────── */
async function saveLead(payload) {
  const res = await fetch("/api/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Lead konnte nicht gespeichert werden:", errorText);
    return false;
  }

  return true;
}

/* ── FORMULAR ABSENDEN ───────────────────────── */
async function submitForm(e) {
  e.preventDefault();
  const aiContent = document.getElementById('aiResultContent')?.textContent || '';
  const payload = {
    company:     document.getElementById('f_company')?.value || '',
    name:        document.getElementById('f_name')?.value || '',
    email:       document.getElementById('f_email')?.value || '',
    phone:       document.getElementById('f_phone')?.value || '',
    service:     document.getElementById('f_service')?.value || '',
    message:     document.getElementById('f_msg')?.value || '',
    ai_analysis: aiContent || null,
    language:    currentLang,
    source:      'website',
    status:      'new',
    created_at:  new Date().toISOString()
  };
  await saveLead(payload);
  const banner = document.getElementById('successBanner');
  if (banner) {
    banner.textContent = T[currentLang]?.f_success || '✓ Danke!';
    banner.style.display = 'block';
    setTimeout(() => banner.style.display = 'none', 5000);
  }
  e.target.reset();
  const result = document.getElementById('aiResult');
  if (result) result.style.display = 'none';
}

/* ── AI SKIZZEN-ANALYSE ──────────────────────── */
async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const loading = document.getElementById('aiLoading');
  const result  = document.getElementById('aiResult');
  const content = document.getElementById('aiResultContent');
  const uploadText = document.querySelector('.upload-text');
  if (uploadText) uploadText.textContent = '✓ ' + file.name;
  if (loading) loading.style.display = 'block';
  if (result)  result.style.display  = 'none';

  try {
    const base64    = await fileToBase64(file);
    const isImage   = file.type.startsWith('image/');
    const langLabel = { de:'German', it:'Italian', en:'English', fr:'French' }[currentLang] || 'English';

    const userContent = isImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
          { type: 'text', text:
            `You are a CNC machining cost estimator for OS. CNC Mechplast in Italy.
Analyze this technical drawing or sketch and provide in ${langLabel}:
1. Likely material (aluminium, steel, brass, titanium, plastic)
2. Machining operations needed (milling / turning / drilling)
3. Complexity: simple / medium / complex
4. Estimated price range in EUR — 1 piece and 10 pieces
5. Estimated lead time
Be concise. Start with a 1-line summary, then list the 5 points with short bullet lines.`
          }
        ]
      : [{ type: 'text', text:
          `A PDF drawing file was uploaded (${file.name}).
As CNC cost estimator for OS. CNC Mechplast Italy, provide a general CNC price estimate range (1 pc / 10 pcs) in EUR and advise the user to also upload a photo or image for more accurate AI analysis.
Reply in ${langLabel}.`
        }];

    const res  = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: userContent }]
      })
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === 'text')?.text || 'Keine Antwort.';
    if (content) content.innerHTML = text.replace(/\n/g, '<br>');
    if (result)  result.style.display = 'block';

    // Nachricht vorausfüllen
    const msgField = document.getElementById('f_msg');
    if (msgField && !msgField.value) msgField.value = '[KI-Analyse beigefügt] ';

  } catch (err) {
    if (content) content.textContent = 'Fehler bei der KI-Analyse. Bitte beschreiben Sie Ihr Bauteil manuell.';
    if (result)  result.style.display = 'block';
    console.error(err);
  }
  if (loading) loading.style.display = 'none';
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ── DRAG & DROP ─────────────────────────────── */
function initDragDrop() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) {
      document.getElementById('sketchFile').files = e.dataTransfer.files;
      handleFileUpload({ target: { files: [f] } });
    }
  });
}

/* ── INIT ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  initDragDrop();
});
