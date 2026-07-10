/* =============================================
   OS. CNC MECHPLAST â€” CORE APP
   Datei: js/app.js
   EnthÃ¤lt: Sprache, Cloudflare API, AI-Analyse, Formular
   ============================================= */

/* â”€â”€ KONFIGURATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CONFIG = {
  defaultLang: 'de',
  siteVersion: '20260621-technology-hub-v1',
};

/* â”€â”€ SPRACHE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let currentLang = CONFIG.defaultLang;

function setLang(lang) {
  currentLang = lang;
  try { localStorage.setItem('oscnc_lang', lang); } catch(e) {}
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

  // Ticker neu befÃ¼llen
  const ticker = document.getElementById('tickerInner');
  if (ticker && t.ticker_items) {
    const doubled = [...t.ticker_items, ...t.ticker_items];
    ticker.innerHTML = doubled.map(i => `<span class="ticker-item">${i}</span>`).join('');
  }
}

/* â”€â”€ CLOUDFLARE D1 LEAD SPEICHERN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ FORMULAR ABSENDEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function submitForm(e) {
  e.preventDefault();
  const payload = {
    company:     document.getElementById('f_company')?.value || '',
    name:        document.getElementById('f_name')?.value || '',
    email:       document.getElementById('f_email')?.value || '',
    phone:       document.getElementById('f_phone')?.value || '',
    service:     document.getElementById('f_service')?.value || '',
    message:     document.getElementById('f_msg')?.value || '',
    ai_analysis: null,
    language:    currentLang,
    source:      'website',
    status:      'new',
    created_at:  new Date().toISOString()
  };
  await saveLead(payload);
  const banner = document.getElementById('successBanner');
  if (banner) {
    banner.textContent = T[currentLang]?.f_success || 'âœ“ Danke!';
    banner.style.display = 'block';
    setTimeout(() => banner.style.display = 'none', 5000);
  }
  e.target.reset();
  const uploadSelected = document.getElementById('uploadSelected');
  if (uploadSelected) uploadSelected.textContent = '';
}

/* â”€â”€ DATEI-UPLOAD HINWEIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const uploadText = document.querySelector('.upload-text');
  const selected = document.getElementById('uploadSelected');
  if (uploadText) uploadText.textContent = 'Datei ausgewählt';
  if (selected) selected.textContent = file.name + ' ist für die Anfrage vorgemerkt.';
}

/* â”€â”€ DRAG & DROP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* â”€â”€ MODUL-LADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Jede Seite besteht aus Modulen: <div data-include="header"></div>
   lÃ¤dt modules/header.html. Modul Ã¤ndern = Ã¼berall geÃ¤ndert. */
async function loadModules() {
  const slots = [...document.querySelectorAll('[data-include]')];
  await Promise.all(slots.map(async el => {
    try {
      const res = await fetch('modules/' + el.dataset.include + '.html?v=' + CONFIG.siteVersion);
      if (res.ok) el.innerHTML = await res.text();
      else el.innerHTML = '<!-- Modul fehlt: ' + el.dataset.include + ' -->';
    } catch (e) { console.error('Modul-Fehler:', el.dataset.include, e); }
  }));
}

function scrollToHashTarget() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

/* Aktiven MenÃ¼punkt markieren */
function markActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  const hash = location.hash || '';
  document.querySelectorAll('.nav a, .dropdown a, .oncc-nav a, .oncc-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const parts = href.split('#');
    const hrefPage = parts[0] || 'index.html';
    const hrefHash = parts[1] ? '#' + parts[1] : '';
    const samePage = hrefPage === page || (page === '' && hrefPage === 'index.html');
    const sameAnchor = hrefHash && hrefHash === hash;
    if (samePage && (!hrefHash || sameAnchor)) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

function initRequestAssistant() {
  const form = document.getElementById('requestAssistant');
  if (!form) return;

  form.addEventListener('submit', event => {
    event.preventDefault();
    const params = new URLSearchParams({
      assistant: '1',
      service: document.getElementById('assistantService')?.value || 'unsicher',
      material: document.getElementById('assistantMaterial')?.value || 'Noch offen',
      quantity: document.getElementById('assistantQuantity')?.value || 'Noch offen',
      drawing: document.getElementById('assistantDrawing')?.value || 'Noch in Vorbereitung'
    });
    window.location.href = 'kontakt.html?' + params.toString();
  });
}

function prefillContactFormFromAssistant() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('assistant') !== '1') return;

  const service = params.get('service') || 'unsicher';
  const material = params.get('material') || 'Noch offen';
  const quantity = params.get('quantity') || 'Noch offen';
  const drawing = params.get('drawing') || 'Noch in Vorbereitung';
  const serviceSelect = document.getElementById('f_service');
  const serviceIndex = { drehen: 1, drehfraesen: 2, unsicher: 4 };
  if (serviceSelect && serviceIndex[service] !== undefined) {
    serviceSelect.selectedIndex = serviceIndex[service];
  }

  const message = document.getElementById('f_msg');
  if (message && !message.value) {
    const serviceLabel = { drehen: 'CNC-Drehen', drehfraesen: 'Dreh-Fräsbearbeitung', unsicher: 'Noch nicht sicher' }[service];
    message.value = [
      'Vorbereitete Anfrage aus dem Anfrage-Assistenten:',
      'Bearbeitung: ' + serviceLabel,
      'Werkstoff: ' + material,
      'Menge: ' + quantity,
      'Zeichnungsstand: ' + drawing,
      '',
      'Weitere Angaben zum Bauteil:'
    ].join('\n');
  }
}

function initHeaderNav() {
  const mobileButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.getElementById('oncc-mobile-menu');
  if (mobileButton && mobileMenu) {
    mobileButton.addEventListener('click', () => {
      const isOpen = mobileButton.getAttribute('aria-expanded') === 'true';
      mobileButton.setAttribute('aria-expanded', String(!isOpen));
      mobileMenu.hidden = isOpen;
      document.body.classList.toggle('mobile-menu-open', !isOpen);
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileButton.setAttribute('aria-expanded', 'false');
        mobileMenu.hidden = true;
        document.body.classList.remove('mobile-menu-open');
      });
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (mobileButton && mobileMenu) {
      mobileButton.setAttribute('aria-expanded', 'false');
      mobileMenu.hidden = true;
      document.body.classList.remove('mobile-menu-open');
    }
  });
}

/* â”€â”€ SCROLL-REVEAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function initReveal() {
  const els = document.querySelectorAll(
    '.svc-card,.mach-card,.ind-card,.media-card,.step,.usp,.mat-box,.sec-head,.cta-band,.faq details,.spec-table,.form-card,.contact-info,.robot-cell,.map-card,.flow-steps div,.location-points div,.request-assistant,.process-step'
  );
  els.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 4) * 70 + 'ms';
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

/* â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadModules();
  scrollToHashTarget();
  currentLang = CONFIG.defaultLang;
  setLang(currentLang);
  initHeaderNav();
  initDragDrop();
  initRequestAssistant();
  prefillContactFormFromAssistant();
  initReveal();
  markActiveNav();
});




