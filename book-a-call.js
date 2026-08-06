(() => {
  'use strict';

  const TOTAL_STEPS = 4;
  const state = { step: 1, branch: 'standard' };

  // Fallbacks — overwritten by content.json's booking.calendarUrlLowVolume /
  // booking.calendarUrlStandard once loaded.
  const calendarUrls = {
    low: 'https://calendly.com/directflow/directflow-1-on-1',
    standard: 'https://calendly.com/directflow/directflow-1-on-1',
  };

  // Cosmetic query params matching the brand palette, appended to whichever
  // base URL is active so the embedded widget always matches the site.
  const CALENDLY_STYLE_PARAMS = 'background_color=fbf9f6&text_color=17181a&primary_color=bf9030';

  function setStep(n) {
    document.querySelectorAll('.funnel-step').forEach((el) => {
      const s = Number(el.getAttribute('data-step'));
      el.hidden = s !== n;
      el.classList.toggle('is-active', s === n);
    });
    state.step = n;

    document.getElementById('step-label').textContent = `Step ${n} of ${TOTAL_STEPS}`;
    document.getElementById('step-pct').textContent = `${Math.round((n / TOTAL_STEPS) * 100)}%`;
    document.getElementById('progress-fill').style.width = `${(n / TOTAL_STEPS) * 100}%`;

    if (n === 4) loadCalendar();
  }

  function waitForCalendly(callback, attemptsLeft = 30) {
    if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
      callback();
      return;
    }
    if (attemptsLeft <= 0) {
      const container = document.getElementById('calendly-embed');
      container.innerHTML = '<p class="funnel-calendar__loading">Calendar didn\'t load — use the link below instead.</p>';
      return;
    }
    setTimeout(() => waitForCalendly(callback, attemptsLeft - 1), 200);
  }

  function loadCalendar() {
    const base = state.branch === 'low' ? calendarUrls.low : calendarUrls.standard;
    const name = document.getElementById('input-name').value.trim();
    const email = document.getElementById('input-email').value.trim();

    const fallbackParams = new URLSearchParams();
    if (name) fallbackParams.set('name', name);
    if (email) fallbackParams.set('email', email);
    const fallbackQs = fallbackParams.toString();
    document.getElementById('calendar-fallback-link').href = fallbackQs ? `${base}?${fallbackQs}` : base;

    const container = document.getElementById('calendly-embed');
    container.innerHTML = '<p class="funnel-calendar__loading">Loading calendar…</p>';

    waitForCalendly(() => {
      container.innerHTML = '';
      window.Calendly.initInlineWidget({
        url: `${base}?${CALENDLY_STYLE_PARAMS}`,
        parentElement: container,
        prefill: { name, email },
      });
    });
  }

  function markError(el) {
    el.classList.add('funnel-input--error');
    el.addEventListener(
      'input',
      function clear() {
        el.classList.remove('funnel-input--error');
        el.removeEventListener('input', clear);
      },
      { once: true }
    );
  }

  function initOptions() {
    document.querySelectorAll('.funnel-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.branch = btn.getAttribute('data-volume') === 'low' ? 'low' : 'standard';
        document.querySelectorAll('.funnel-option').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        setTimeout(() => setStep(2), 150);
      });
    });
  }

  function initStep2() {
    const btn = document.querySelector('[data-step="2"] .funnel-continue');
    const input = document.getElementById('input-company');
    btn.addEventListener('click', () => {
      if (!input.value.trim()) {
        markError(input);
        input.focus();
        return;
      }
      setStep(3);
    });
  }

  function initStep3() {
    const btn = document.getElementById('book-call-btn');
    const nameEl = document.getElementById('input-name');
    const emailEl = document.getElementById('input-email');
    const phoneEl = document.getElementById('input-phone');

    btn.addEventListener('click', () => {
      let ok = true;
      if (!nameEl.value.trim()) {
        markError(nameEl);
        ok = false;
      }
      if (!emailEl.value.trim() || !emailEl.value.includes('@')) {
        markError(emailEl);
        ok = false;
      }
      if (!phoneEl.value.trim()) {
        markError(phoneEl);
        ok = false;
      }
      if (!ok) return;

      submitLead();
      setStep(4);
    });
  }

  function initBackButtons() {
    document.querySelectorAll('[data-prev]').forEach((btn) => {
      btn.addEventListener('click', () => setStep(Number(btn.getAttribute('data-prev'))));
    });
  }

  async function submitLead() {
    const payload = {
      timestamp: new Date().toISOString(),
      volumeBranch: state.branch,
      company: document.getElementById('input-company').value.trim(),
      name: document.getElementById('input-name').value.trim(),
      email: document.getElementById('input-email').value.trim(),
      phone: document.getElementById('input-phone').value.trim(),
    };
    try {
      const res = await fetch('/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch (err) {
      console.warn('Could not record this lead locally — needs "python3 server.py" running.', err);
    }
  }

  function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  async function loadContent() {
    try {
      const res = await fetch('content.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('content.json not found');
      const content = await res.json();

      document.querySelectorAll('[data-key]').forEach((el) => {
        const value = getPath(content, el.getAttribute('data-key'));
        if (value != null) el.textContent = value;
      });

      const booking = content.booking || {};
      if (booking.calendarUrlLowVolume) calendarUrls.low = booking.calendarUrlLowVolume;
      if (booking.calendarUrlStandard) calendarUrls.standard = booking.calendarUrlStandard;
    } catch (err) {
      console.warn('Using page defaults — content.json could not be loaded (needs a local server).', err);
    }
  }

  (async function init() {
    await loadContent();
    initOptions();
    initStep2();
    initStep3();
    initBackButtons();
    setStep(1);
  })();
})();
