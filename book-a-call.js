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
  const CALENDLY_STYLE_PARAMS = 'background_color=ffffff&text_color=17181a&primary_color=bf9030';

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

  function markError(el, msgId) {
    el.classList.add('funnel-input--error');
    const msgEl = msgId ? document.getElementById(msgId) : null;
    if (msgEl) msgEl.classList.add('is-visible');

    el.addEventListener(
      'input',
      function clear() {
        el.classList.remove('funnel-input--error');
        if (msgEl) msgEl.classList.remove('is-visible');
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

  function formatPhoneNumber(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length < 4) return digits;
    if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function initPhoneFormatting() {
    const phoneEl = document.getElementById('input-phone');
    phoneEl.addEventListener('input', () => {
      phoneEl.value = formatPhoneNumber(phoneEl.value);
    });
  }

  function initStep2() {
    const btn = document.querySelector('[data-step="2"] .funnel-continue');
    const input = document.getElementById('input-company');
    btn.addEventListener('click', () => {
      if (!input.value.trim()) {
        markError(input, 'error-company');
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
        markError(nameEl, 'error-name');
        ok = false;
      }
      if (!emailEl.value.trim() || !emailEl.value.includes('@')) {
        markError(emailEl, 'error-email');
        ok = false;
      }
      if (phoneEl.value.replace(/\D/g, '').length !== 10) {
        markError(phoneEl, 'error-phone');
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

  function initDragScroll() {
    document.querySelectorAll('[data-drag-scroll]').forEach((el) => {
      let isDown = false;
      let startX = 0;
      let startScroll = 0;

      el.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX;
        startScroll = el.scrollLeft;
        el.classList.add('is-dragging');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        el.scrollLeft = startScroll - (e.pageX - startX);
      });

      window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        el.classList.remove('is-dragging');
      });
    });
  }

  function initVideoCarousels() {
    document.querySelectorAll('[data-video-carousel]').forEach((carousel) => {
      const track = carousel.querySelector('[data-carousel-track]');
      const prevBtn = carousel.querySelector('[data-carousel-prev]');
      const nextBtn = carousel.querySelector('[data-carousel-next]');
      if (!track) return;

      function cardStep() {
        const card = track.querySelector('.video-carousel__card');
        if (!card) return track.clientWidth;
        const gap = parseFloat(getComputedStyle(track).columnGap || '0');
        return card.getBoundingClientRect().width + gap;
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          track.scrollBy({ left: -cardStep() * 2, behavior: 'smooth' });
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          track.scrollBy({ left: cardStep() * 2, behavior: 'smooth' });
        });
      }

      let isDown = false;
      let dragged = false;
      let startX = 0;
      let startScroll = 0;

      track.addEventListener('mousedown', (e) => {
        if (e.target.closest('video')) return;
        isDown = true;
        dragged = false;
        startX = e.pageX;
        startScroll = track.scrollLeft;
        track.classList.add('is-dragging');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = e.pageX - startX;
        if (Math.abs(dx) > 4) dragged = true;
        track.scrollLeft = startScroll - dx;
      });

      window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        track.classList.remove('is-dragging');
      });

      track.addEventListener(
        'click',
        (e) => {
          if (dragged) {
            e.preventDefault();
            e.stopPropagation();
          }
        },
        true
      );
    });
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
    initPhoneFormatting();
    initBackButtons();
    initVideoCarousels();
    initDragScroll();
    setStep(1);
  })();
})();
