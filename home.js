/* Peptidly landing page: the calculator, the Home screen demo, and the motion layer.
   No dependencies, no network, nothing stored. Every part degrades to the static HTML. */
import { parseDecimal, positive, drawTo, reconstitute } from './calc.js';

(function () {
  'use strict';

  // Set here, not inline: if this module never runs, nothing waits on it (hidden content, endless motion).
  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktopWidth = window.matchMedia('(min-width: 1100px)');
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- The vial (hero) ---------- */

  var vial = $('.vial');
  var liquid = vial && $('.liquid', vial);
  var ripple = vial && $('.ripple', vial);
  var vialLabel = vial && $('.vial-label', vial);

  // While mixing, the level shows the water in a 3 ml vial, so the colour stays teal:
  // the app's colour bands describe what is left, and a freshly mixed vial has not been drawn from.
  function setVialLevel(pct) {
    if (!vial) return;
    var p = Math.max(0, Math.min(100, pct));
    // Body top 42, height 254; the fill uses (254 - 8) of it, as vial.jsx does.
    liquid.style.transform = 'translateY(' + (292 - 2.46 * p).toFixed(1) + 'px)';
    $('.bubbles', vial).style.display = p > 15 ? '' : 'none';
  }

  // Motion that starts on its own stops within five seconds (WCAG 2.2.2): the liquid settles 5 s after the last change.
  var restTimer = 0;
  function wake() {
    if (!vial) return;
    vial.classList.remove('is-resting');
    clearTimeout(restTimer);
    restTimer = setTimeout(function () { vial.classList.add('is-resting'); }, 5000);
  }

  function rippleVial() {
    if (!ripple || reduceMotion.matches) return;
    ripple.classList.remove('go');
    void ripple.getBoundingClientRect();
    ripple.classList.add('go');
  }

  /* ---------- The calculator ---------- */

  var inVial = $('#c-vial');
  var inWater = $('#c-water');
  var inDose = $('#c-dose');
  var out = {
    units: $('#d-units'),
    ml: $('#d-ml'),
    pct: $('#d-pct'),
    fill: $('#d-fill'),
    conc: $('#r-conc'),
    doses: $('#r-doses')
  };
  var ticks = $$('.syr-ticks [data-tick]');
  var lastDose = '';
  var rippleTimer = 0;

  var status = $('#calc-status');
  var statusTimer = 0;

  function trim(n) { return String(Math.round(n * 1000) / 1000); }

  function announce(r) {
    if (!status) return;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      if (r.units !== null) status.textContent = 'Draw to ' + drawTo(r.units) + ' units, ' + r.volume.toFixed(3) + ' ml, on a 1 ml insulin syringe.';
      else if (r.conc !== null) status.textContent = 'Concentration ' + r.conc.toFixed(2) + ' mg per ml. Enter a dose to see the draw.';
      else if (r.dosesPerVial !== null) status.textContent = r.dosesPerVial + ' doses per vial. Enter the BAC water to see the draw.';
      else status.textContent = 'Enter the vial size, the BAC water and your dose.';
    }, 700);
  }

  function calculate(e) {
    if (!inVial) return;
    var v = parseDecimal(inVial.value);
    var w = parseDecimal(inWater.value);
    var d = parseDecimal(inDose.value);

    vialLabel.textContent = (positive(v) ? trim(v) : '—') + ' mg';
    setVialLevel(positive(w) ? (w / 3) * 100 : 0);
    inDose.parentNode.classList.toggle('wants', !positive(d));

    wake();
    var r = reconstitute(v, w, d);
    out.conc.textContent = r.conc === null ? '—' : r.conc.toFixed(2);
    out.doses.textContent = r.dosesPerVial === null ? '—' : String(r.dosesPerVial);

    if (r.units !== null) {
      var units = r.units;
      var label = drawTo(units);
      out.units.textContent = label;
      out.units.className = 'draw-num' + (label.length >= 4 ? ' len-' + Math.min(6, label.length) : '');
      out.ml.textContent = r.volume.toFixed(3);
      out.pct.textContent = drawTo(Math.min(100, units)) + '%';
      out.fill.style.width = Math.min(100, units) + '%';
      out.fill.classList.remove('empty');
      ticks.forEach(function (t) {
        var p = Number(t.getAttribute('data-tick'));
        t.classList.toggle('on', units >= p && units < p + 12.5);
      });
    } else {
      out.units.textContent = '—';
      out.units.className = 'draw-num is-empty';
      out.ml.textContent = '—';
      out.pct.textContent = '—';
      out.fill.style.width = '0%';
      out.fill.classList.add('empty');
      ticks.forEach(function (t) { t.classList.remove('on'); });
    }

    if (e) announce(r);

    if (inDose.value !== lastDose) {
      lastDose = inDose.value;
      clearTimeout(rippleTimer);
      if (positive(d)) rippleTimer = setTimeout(rippleVial, 280);
    }
  }

  if (inVial) {
    [inVial, inWater, inDose].forEach(function (el) {
      el.removeAttribute('readonly');
      el.addEventListener('input', calculate);
    });
    calculate();
    // The app fills a vial in on mount; start empty, then fill on the next frames.
    if (liquid && !reduceMotion.matches) {
      var target = liquid.style.transform;
      liquid.style.transition = 'none';
      liquid.style.transform = 'translateY(292px)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          liquid.style.transition = '';
          liquid.style.transform = target;
        });
      });
    }
  }

  /* ---------- Dates in the Home fragment follow today ---------- */

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function shortDate(d) { return MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }

  (function datesFollowToday() {
    var today = new Date();
    // Today is day 20 of a 58-day cycle: the card's static 'DAY 20', '38 days remaining' and 34 % say so.
    var start = addDays(today, -19);
    var end = addDays(start, 57);
    $$('[data-today]').forEach(function (el) { el.textContent = shortDate(today); });
    $$('[data-cycle-start]').forEach(function (el) { el.textContent = shortDate(start); });
    $$('[data-cycle-end]').forEach(function (el) { el.textContent = shortDate(end); });
    $$('[data-cycle-quarter]').forEach(function (el) {
      el.textContent = 'Q' + (Math.floor(start.getMonth() / 3) + 1) + ' ' + start.getFullYear();
    });
  })();

  /* ---------- The Home screen demo ---------- */

  var phone = $('.phone');
  var rows = phone ? $$('.dose-row', phone) : [];
  // Numbers that add up: 250 mcg from a 2 mg vial is 12.5 % of it; 500 mcg from a 5 mg vial is 10 %.
  var DATA = [
    { name: 'AM blend', title: 'AM blend · 250 mcg', when: 'in 12m · 08:00', before: 62.5, after: 50 },
    { name: 'PM blend', title: 'PM blend · 500 mcg', when: 'in 12h 12m · 20:00', before: 40, after: 30 }
  ];
  var resetTimer = 0;

  function setMini(row, pct) {
    var svg = $('.mini-vial', row);
    var rect = $('.mini-fill', svg);
    var h = (pct / 100) * 40; // VialMini: fill = pct of (height - 14)
    rect.setAttribute('y', String(52 - h));
    rect.setAttribute('height', String(h));
    // vial.jsx bands: teal above 50 %, lavender above 20 %. No row here goes below 30 %.
    svg.classList.toggle('lav', pct <= 50);
  }

  function render(taken) {
    if (!phone) return;
    var count = 0;
    rows.forEach(function (row, i) {
      var isTaken = !!taken[i];
      if (isTaken) count++;
      row.classList.toggle('taken', isTaken);
      setMini(row, isTaken ? DATA[i].after : DATA[i].before);
    });
    $('[data-taken-count]', phone).textContent = String(count);
    var next = taken.indexOf(false);
    var card = $('.next-card', phone);
    card.classList.toggle('all-done', next === -1);
    var shown = DATA[next === -1 ? DATA.length - 1 : next];
    $('[data-next-title]', phone).textContent = shown.title;
    $('[data-next-when]', phone).textContent = shown.when;
  }

  var takenState = [false, false];

  var homeStatus = phone && $('#home-status', phone);
  function say(text) { if (homeStatus) homeStatus.textContent = text; }

  function isShown(el) { return el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'; }

  // A pressed Log button hides itself; keep focus inside the screen instead of losing it to the page.
  function keepFocus() {
    var active = document.activeElement;
    if (!phone || !phone.contains(active) || active === phone || isShown(active)) return;
    var next = $$('[data-log]', phone).filter(isShown)[0];
    (next || phone).focus();
  }

  function logRow(i) {
    if (i < 0 || takenState[i]) return;
    takenState[i] = true;
    render(takenState);
    var count = takenState.filter(Boolean).length;
    say(DATA[i].name + ' logged. ' + count + ' of ' + DATA.length + ' doses taken today.');
    keepFocus();
    var row = rows[i];
    row.classList.add('just');
    setTimeout(function () { row.classList.remove('just'); }, 900);
    if (takenState.indexOf(false) === -1) {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        takenState = [Number(phone.getAttribute('data-state')) >= 2, false];
        render(takenState);
        say('The demo has reset.');
        keepFocus();
      }, 3200);
    }
  }

  function pulseLog() {
    var b = $('.next-log', phone);
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }

  function setState(n) {
    if (!phone) return;
    var was = phone.getAttribute('data-state');
    phone.setAttribute('data-state', String(n));
    if (n === 1 && was !== '1') pulseLog();
    clearTimeout(resetTimer);
    takenState = [n >= 2, false];
    render(takenState);
    $('.nudge', phone).setAttribute('aria-hidden', n === 3 ? 'false' : 'true');
    keepFocus();
    $$('.step').forEach(function (s) {
      var on = Number(s.getAttribute('data-step')) === n;
      s.classList.toggle('is-active', on);
      $('.step-btn', s).setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  if (phone) {
    $$('[data-log]', phone).forEach(function (b) {
      b.addEventListener('click', function () {
        var row = b.closest('.dose-row');
        logRow(row ? rows.indexOf(row) : takenState.indexOf(false));
      });
    });
    setState(1);
    // The Log pulse runs when the screen is first seen, not at load while it is still below the fold.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting) { pulseLog(); obs.disconnect(); }
      }, { threshold: 0.5 }).observe(phone);
    }
  }

  // Each statement is a button that puts the Home screen in its state.
  if (phone) {
    $$('.step').forEach(function (s) {
      $('.step-btn', s).addEventListener('click', function () { setState(Number(s.getAttribute('data-step'))); });
    });
  }

  /* ---------- Schedule panel notes line up with the controls they describe ---------- */

  var plate = $('.plate');
  var notes = plate ? $$('.note', plate) : [];

  // Offsets ignore transforms, so the sheet's entrance (it rises 24px) cannot misplace the notes.
  function topIn(el, ancestor) {
    var y = 0;
    while (el && el !== ancestor) { y += el.offsetTop; el = el.offsetParent; }
    return el === ancestor ? y : NaN;
  }

  var notesPlaced = false;
  function alignNotes() {
    if (!plate) return;
    if (!desktopWidth.matches) {
      if (notesPlaced) notes.forEach(function (n) { n.style.top = ''; });
      notesPlaced = false;
      return;
    }
    ['.notes-left', '.notes-right'].forEach(function (side) {
      var list = $$('.note', $(side, plate));
      var wanted = list.map(function (n) { return topIn(document.getElementById(n.getAttribute('data-for')), plate); });
      var heights = list.map(function (n) { return n.offsetHeight; });
      var floor = 0;
      list.forEach(function (n, i) {
        if (!Number.isFinite(wanted[i])) return;
        var top = Math.max(wanted[i] - 4, floor);
        n.style.top = top + 'px';
        floor = top + heights[i] + 16;
      });
    });
    notesPlaced = true;
  }

  var alignQueued = false;
  function queueAlign() {
    if (alignQueued) return;
    alignQueued = true;
    requestAnimationFrame(function () { alignQueued = false; alignNotes(); });
  }

  notes.forEach(function (n) {
    var target = document.getElementById(n.getAttribute('data-for'));
    if (!target) return;
    var on = function () { n.classList.add('is-on'); target.classList.add('is-target'); };
    var off = function () { n.classList.remove('is-on'); target.classList.remove('is-target'); };
    n.addEventListener('mouseenter', on);
    n.addEventListener('mouseleave', off);
  });

  alignNotes();
  window.addEventListener('resize', queueAlign);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignNotes);

  /* ---------- Entrances: each section's parts rise in turn, once ---------- */

  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var groups = [
      '.hero-stage',
      '.loop h2, .loop .step, .loop-stage',
      '.cycles h2, .cycles .section-lead, .sheet, .note',
      '.privacy-head > *, .facts-group, .facts-rows > div',
      '.faq h2, .faq details',
      '.cta-copy > *, .welcome',
      '.tile'
    ];
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('in');
        revealer.unobserve(el);
        // Once it has arrived, drop the entrance styles so the element's own hover, press and colour
        // transitions apply again (the entrance's transform and transition would override them).
        setTimeout(function () {
          el.removeAttribute('data-reveal');
          el.classList.remove('in');
          el.style.removeProperty('--i');
        }, 1300);
      });
    }, { threshold: 0 });
    document.addEventListener('focusin', function (e) {
      var hidden = e.target.closest && e.target.closest('[data-reveal]');
      if (!hidden) return;
      hidden.removeAttribute('data-reveal');
      hidden.classList.remove('in');
      hidden.style.removeProperty('--i');
    });
    groups.forEach(function (sel) {
      $$(sel).forEach(function (el, i) {
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--i', String(Math.min(i, 6)));
        revealer.observe(el);
      });
    });
  }

  /* ---------- Pause the vial's motion while it is off screen ---------- */

  if (vial && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      vial.classList.toggle('is-paused', !entries[0].isIntersecting);
    }).observe(vial);
  }
})();
