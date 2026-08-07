(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Content loading ---------------- */

  function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let node = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      if (node[key] == null) node[key] = /^\d+$/.test(nextKey) ? [] : {};
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
  }

  function applyContent(content) {
    document.querySelectorAll('[data-key]').forEach((el) => {
      const value = getPath(content, el.getAttribute('data-key'));
      if (value == null) return;
      if (el.hasAttribute('data-html')) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    });

    const stats = getPath(content, 'stats.items') || [];
    document.querySelectorAll('[data-stat]').forEach((statEl) => {
      const item = stats[Number(statEl.getAttribute('data-stat'))];
      if (!item) return;
      const numberEl = statEl.querySelector('.stat__number');
      const decimals = item.decimals || 0;
      numberEl.setAttribute('data-target', item.value);
      numberEl.setAttribute('data-prefix', item.prefix || '');
      numberEl.setAttribute('data-suffix', item.suffix || '');
      numberEl.setAttribute('data-decimals', decimals);
      numberEl.textContent = `${item.prefix || ''}${(0).toFixed(decimals)}${item.suffix || ''}`;
    });
  }

  async function loadContent() {
    try {
      const res = await fetch('content.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('content.json not found');
      const content = await res.json();
      applyContent(content);
      window.__dfContent = content;
    } catch (err) {
      console.warn('Using page defaults — content.json could not be loaded (needs a local server).', err);
    }
  }

  /* ---------------- Marquee: clone once per track for a seamless loop ---------------- */

  function initMarquee() {
    document.querySelectorAll('[data-vmarquee-track]').forEach((track) => {
      const originals = Array.from(track.children);
      originals.forEach((node) => {
        const clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.removeAttribute('data-deal');
        clone.querySelectorAll('[data-key]').forEach((el) => el.removeAttribute('data-key'));
        track.appendChild(clone);
      });
    });
  }

  /* ---------------- Plain drag-to-scroll (mouse) for user-controlled strips ---------------- */

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

  /* ---------------- Video testimonial carousel: arrows + mouse drag ---------------- */

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

  /* ---------------- Scroll-triggered reveals ---------------- */

  function initReveals() {
    const revealEls = document.querySelectorAll('.reveal');

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ---------------- Stat count-up ---------------- */

  function formatStatValue(value, decimals) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function animateCount(el) {
    const target = Number(el.dataset.target || 0);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const decimals = Number(el.dataset.decimals || 0);
    const duration = 1600;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = `${prefix}${formatStatValue(value, decimals)}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
    }

    if (prefersReducedMotion) {
      el.textContent = `${prefix}${formatStatValue(target, decimals)}${suffix}`;
    } else {
      requestAnimationFrame(frame);
    }
  }

  function initStatCounters() {
    const statEls = document.querySelectorAll('.stat__number');

    if ('IntersectionObserver' in window) {
      const statObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      statEls.forEach((el) => statObserver.observe(el));
    } else {
      statEls.forEach(animateCount);
    }
  }

  function animateNumberTo(el, toValue, formatFn, duration = 350) {
    const fromValue = el.__animCurrent ?? toValue;

    if (prefersReducedMotion || fromValue === toValue) {
      el.textContent = formatFn(toValue);
      el.__animCurrent = toValue;
      return;
    }

    if (el.__animFrame) cancelAnimationFrame(el.__animFrame);
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = fromValue + (toValue - fromValue) * eased;
      el.textContent = formatFn(value);
      if (progress < 1) {
        el.__animFrame = requestAnimationFrame(frame);
      } else {
        el.__animCurrent = toValue;
      }
    }
    el.__animFrame = requestAnimationFrame(frame);
  }

  /* ---------------- ROI Calculator ---------------- */

  // Tunable assumptions — adjust these as real performance data comes in.
  const CALC_ASSUMPTIONS = {
    avgJobValue: 25000,    // average kitchen/bath remodel job value
  };

  function initCalculator() {
    const appointmentsInput = document.getElementById('appointments');
    const closeRateInput = document.getElementById('closeRate');
    if (!appointmentsInput || !closeRateInput) return;

    const appointmentsValueEl = document.getElementById('appointments-value');
    const closeRateValueEl = document.getElementById('closeRate-value');
    const outRevenueEl = document.getElementById('out-revenue');
    const outJobsEl = document.getElementById('out-jobs');
    const outJobsClosingEl = document.getElementById('out-jobs-closing');

    const currency = (n) => `$${Math.round(n).toLocaleString()}`;

    function setSliderFill(input) {
      const min = Number(input.min);
      const max = Number(input.max);
      const pct = ((Number(input.value) - min) / (max - min)) * 100;
      input.style.setProperty('--pct', `${pct}%`);
    }

    function update() {
      const appointments = Number(appointmentsInput.value);
      const closeRatePct = Number(closeRateInput.value);
      appointmentsValueEl.textContent = appointments.toLocaleString();
      closeRateValueEl.textContent = `${closeRatePct}%`;

      const closedJobsPerMonth = appointments * (closeRatePct / 100);
      const projectedRevenue = closedJobsPerMonth * CALC_ASSUMPTIONS.avgJobValue;

      animateNumberTo(outRevenueEl, projectedRevenue, currency);
      animateNumberTo(outJobsEl, closedJobsPerMonth, (v) => v.toFixed(1));
      animateNumberTo(outJobsClosingEl, closedJobsPerMonth, (v) => v.toFixed(1));

      setSliderFill(appointmentsInput);
      setSliderFill(closeRateInput);
    }

    appointmentsInput.addEventListener('input', update);
    closeRateInput.addEventListener('input', update);
    update();
  }

  /* ---------------- Edit Content mode ---------------- */

  function initEditMode() {
    const toggleBtn = document.getElementById('edit-toggle');
    const editBar = document.getElementById('edit-bar');
    const editMsg = document.getElementById('edit-bar-msg');
    const saveBtn = document.getElementById('edit-save');
    const cancelBtn = document.getElementById('edit-cancel');
    if (!toggleBtn) return;

    // Editing only works against the local server.py (which has the /save
    // endpoint) — hide the button entirely on a real deployment (e.g. Vercel)
    // so visitors never see a control that can't do anything for them.
    const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
    if (!isLocal) {
      toggleBtn.remove();
      editBar.remove();
      return;
    }

    let editing = false;

    function enterEditMode() {
      editing = true;
      document.body.classList.add('edit-mode');
      toggleBtn.setAttribute('aria-pressed', 'true');
      toggleBtn.hidden = true;
      editBar.hidden = false;
      editMsg.textContent = 'Editing content — click any highlighted text to change it.';

      document.querySelectorAll('[data-key]').forEach((el) => {
        el.setAttribute('contenteditable', 'true');
      });

      // Stats: show the real target value (not the animated "0") so it's editable.
      document.querySelectorAll('.stat__number').forEach((el) => {
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const decimals = Number(el.dataset.decimals || 0);
        const target = Number(el.dataset.target || 0);
        el.textContent = `${prefix}${formatStatValue(target, decimals)}${suffix}`;
        el.setAttribute('contenteditable', 'true');
      });
    }

    function exitEditMode() {
      editing = false;
      document.body.classList.remove('edit-mode');
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.hidden = false;
      editBar.hidden = true;

      document.querySelectorAll('[contenteditable]').forEach((el) => {
        el.removeAttribute('contenteditable');
      });
    }

    function parseNumberFromText(text) {
      const cleaned = text.replace(/[^0-9.\-]/g, '');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    }

    async function saveChanges() {
      const content = window.__dfContent ? JSON.parse(JSON.stringify(window.__dfContent)) : {};

      document.querySelectorAll('[data-key]').forEach((el) => {
        const key = el.getAttribute('data-key');
        const value = el.hasAttribute('data-html') ? el.innerHTML.trim() : el.textContent.trim();
        setPath(content, key, value);
      });

      const statItems = getPath(content, 'stats.items') || [];
      document.querySelectorAll('[data-stat]').forEach((statEl) => {
        const idx = Number(statEl.getAttribute('data-stat'));
        const numberEl = statEl.querySelector('.stat__number');
        const prefix = numberEl.dataset.prefix || '';
        const suffix = numberEl.dataset.suffix || '';
        const decimals = Number(numberEl.dataset.decimals || 0);
        const value = parseNumberFromText(numberEl.textContent);
        statItems[idx] = { ...statItems[idx], value, prefix, suffix, decimals };
        numberEl.setAttribute('data-target', value);
      });
      setPath(content, 'stats.items', statItems);

      editMsg.textContent = 'Saving…';
      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(content),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error || 'Save failed');

        window.__dfContent = content;
        editMsg.textContent = 'Saved. Reloading…';
        setTimeout(() => window.location.reload(), 500);
      } catch (err) {
        editMsg.textContent = "Couldn't save — make sure you started this site with \"python3 server.py\" (not a plain static server). Edits stay on the page but won't persist after reload.";
        console.error(err);
      }
    }

    toggleBtn.addEventListener('click', enterEditMode);
    cancelBtn.addEventListener('click', () => {
      if (editing) window.location.reload();
    });
    saveBtn.addEventListener('click', saveChanges);
  }

  /* ---------------- Init ---------------- */

  (async function init() {
    await loadContent();
    initMarquee();
    initVideoCarousels();
    initDragScroll();
    initReveals();
    initStatCounters();
    initCalculator();
    initEditMode();
  })();
})();
