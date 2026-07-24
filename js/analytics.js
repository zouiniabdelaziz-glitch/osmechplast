(function () {
  'use strict';

  const CONFIG = window.OSMP_ANALYTICS_CONFIG || {};
  const MEASUREMENT_ID = CONFIG.measurementId || 'G-KFFN0VWBGK';
  const CLARITY_PROJECT_ID = CONFIG.clarityProjectId || 'xlwutfjzhw';
  const STORAGE_KEY = 'osmp_analytics_clarity_consent';
  const SCRIPT_ID = 'osmp-google-tag';
  const CLARITY_SCRIPT_ID = 'osmp-clarity-tag';
  const STYLE_ID = 'osmp-consent-style';
  const BANNER_ID = 'osmp-consent-banner';
  const SETTINGS_ID = 'osmp-consent-settings';

  const copy = {
    de: {
      title: 'Analyse-Einstellungen',
      text: 'Wir nutzen Google Analytics und Microsoft Clarity nur, wenn Sie zustimmen. Damit sehen wir, welche Seiten hilfreich sind und können die Website verbessern.',
      accept: 'Akzeptieren',
      reject: 'Ablehnen',
      settings: 'Cookie-Einstellungen'
    },
    en: {
      title: 'Analytics settings',
      text: 'We only use Google Analytics and Microsoft Clarity if you consent. They help us understand which pages are useful and improve the website.',
      accept: 'Accept',
      reject: 'Reject',
      settings: 'Cookie settings'
    },
    it: {
      title: 'Impostazioni Analytics',
      text: 'Usiamo Google Analytics e Microsoft Clarity solo con il tuo consenso. Ci aiutano a capire quali pagine sono utili e a migliorare il sito.',
      accept: 'Accetta',
      reject: 'Rifiuta',
      settings: 'Impostazioni cookie'
    },
    fr: {
      title: 'Paramètres Analytics',
      text: 'Nous utilisons Google Analytics et Microsoft Clarity uniquement avec votre accord. Cela nous aide à comprendre les pages utiles et à améliorer le site.',
      accept: 'Accepter',
      reject: 'Refuser',
      settings: 'Paramètres cookies'
    }
  };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  window.gtag('set', 'ads_data_redaction', true);

  function getLang() {
    const lang = (window.OSMP_ANALYTICS_CONFIG && window.OSMP_ANALYTICS_CONFIG.lang)
      || document.documentElement.lang
      || 'de';
    return copy[lang] ? lang : 'de';
  }

  function getText() {
    return copy[getLang()];
  }

  function getChoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch (error) {}
  }

  function consentState(choice) {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: choice === 'granted' ? 'granted' : 'denied'
    };
  }

  function loadGoogleTag() {
    if (document.getElementById(SCRIPT_ID)) return;

    const tag = document.createElement('script');
    tag.id = SCRIPT_ID;
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(tag);

    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: true
    });
  }

  function ensureClarityQueue() {
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
  }

  function setClarityConsent(choice) {
    ensureClarityQueue();
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: choice === 'granted' ? 'granted' : 'denied'
    });
  }

  function loadMicrosoftClarity() {
    setClarityConsent('granted');
    if (document.getElementById(CLARITY_SCRIPT_ID)) return;

    const tag = document.createElement('script');
    tag.id = CLARITY_SCRIPT_ID;
    tag.async = true;
    tag.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(CLARITY_PROJECT_ID);
    document.head.appendChild(tag);
  }

  function deleteTrackingCookies() {
    const names = document.cookie
      .split(';')
      .map(cookie => cookie.split('=')[0].trim())
      .filter(name =>
        name === '_ga'
        || name === '_gid'
        || name === '_gat'
        || name.startsWith('_ga_')
        || name === '_clck'
        || name === '_clsk'
        || name === '_cltk'
      );

    if (!names.length) return;

    const hostParts = location.hostname.split('.');
    const domains = [location.hostname];
    if (hostParts.length > 2) domains.push('.' + hostParts.slice(-2).join('.'));

    names.forEach(name => {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      domains.forEach(domain => {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
      });
    });
  }

  function updateConsent(choice) {
    window.gtag('consent', 'update', consentState(choice));
    setClarityConsent(choice);
    if (choice === 'granted') {
      loadGoogleTag();
      loadMicrosoftClarity();
    }
    if (choice === 'denied') deleteTrackingCookies();
  }

  function track(name, params) {
    if (!name || getChoice() !== 'granted') return;
    const payload = Object.assign({}, params || {});
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    }
    if (typeof window.clarity === 'function') {
      window.clarity('event', name);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .osmp-consent {
        background: #061722;
        border: 1px solid rgba(255, 255, 255, .14);
        box-shadow: 0 22px 70px rgba(6, 23, 34, .28);
        color: #fff;
        display: grid;
        gap: 18px;
        left: max(16px, calc((100vw - 1560px) / 2 + 24px));
        max-width: min(520px, calc(100vw - 32px));
        padding: 22px;
        position: fixed;
        right: auto;
        bottom: 18px;
        z-index: 10000;
      }

      .osmp-consent__label {
        align-items: center;
        color: #e3000b;
        display: inline-flex;
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        font-weight: 700;
        gap: 10px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .osmp-consent__label::before {
        background: currentColor;
        content: "";
        height: 2px;
        width: 34px;
      }

      .osmp-consent h2 {
        color: #fff;
        font-family: var(--font, "Afacad", "Segoe UI", sans-serif);
        font-size: 28px;
        line-height: 1.04;
        margin: 0;
      }

      .osmp-consent p {
        color: rgba(255, 255, 255, .76);
        font-family: var(--font, "Afacad", "Segoe UI", sans-serif);
        font-size: 17px;
        line-height: 1.5;
        margin: 0;
      }

      .osmp-consent__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .osmp-consent button,
      .osmp-consent-settings {
        border-radius: 0;
        cursor: pointer;
        font-family: var(--font, "Afacad", "Segoe UI", sans-serif);
        font-weight: 700;
      }

      .osmp-consent__accept {
        background: #e3000b;
        border: 1px solid #e3000b;
        color: #fff;
        padding: 13px 18px;
      }

      .osmp-consent__reject {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, .28);
        color: #fff;
        padding: 13px 18px;
      }

      .osmp-consent-settings {
        background: transparent;
        border: 0;
        color: inherit;
        font: inherit;
        padding: 0;
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      @media (max-width: 700px) {
        .osmp-consent {
          bottom: 12px;
          left: 12px;
          max-width: calc(100vw - 24px);
          padding: 18px;
        }

        .osmp-consent h2 {
          font-size: 24px;
        }

        .osmp-consent__actions {
          display: grid;
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removeBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.remove();
  }

  function renderBanner(force) {
    if (!force && getChoice()) return;
    injectStyles();
    removeBanner();

    const text = getText();
    const banner = document.createElement('aside');
    banner.className = 'osmp-consent';
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'osmp-consent-title');
    banner.innerHTML = `
      <span class="osmp-consent__label">Analytics & Clarity</span>
      <div>
        <h2 id="osmp-consent-title">${text.title}</h2>
        <p>${text.text}</p>
      </div>
      <div class="osmp-consent__actions">
        <button type="button" class="osmp-consent__accept" data-osmp-consent="granted">${text.accept}</button>
        <button type="button" class="osmp-consent__reject" data-osmp-consent="denied">${text.reject}</button>
      </div>
    `;

    banner.querySelectorAll('[data-osmp-consent]').forEach(button => {
      button.addEventListener('click', () => {
        const choice = button.getAttribute('data-osmp-consent');
        saveChoice(choice);
        updateConsent(choice);
        removeBanner();
        renderSettingsButton();
      });
    });

    document.body.appendChild(banner);
  }

  function renderSettingsButton() {
    injectStyles();
    const text = getText();
    let button = document.getElementById(SETTINGS_ID);

    if (!button) {
      const footerLegal = document.querySelector('.footer-legal');
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'osmp-consent-settings';
      button.id = SETTINGS_ID;
      button.addEventListener('click', () => renderBanner(true));

      if (footerLegal) {
        const separator = document.createElement('span');
        separator.setAttribute('aria-hidden', 'true');
        separator.textContent = '·';
        footerLegal.appendChild(separator);
        footerLegal.appendChild(button);
      } else {
        button.style.position = 'fixed';
        button.style.left = '16px';
        button.style.bottom = '12px';
        button.style.zIndex = '9999';
        document.body.appendChild(button);
      }
    }

    button.textContent = text.settings;
  }

  window.OSMPAnalytics = {
    open: () => renderBanner(true),
    track,
    setLang: lang => {
      window.OSMP_ANALYTICS_CONFIG = window.OSMP_ANALYTICS_CONFIG || {};
      window.OSMP_ANALYTICS_CONFIG.lang = lang;
      renderSettingsButton();
      if (document.getElementById(BANNER_ID)) renderBanner(true);
    }
  };

  const choice = getChoice();
  if (choice) updateConsent(choice);
  renderBanner(false);
  renderSettingsButton();
})();
