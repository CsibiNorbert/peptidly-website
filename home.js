/* Peptidly landing page: the calculator, the Home screen demo, and the motion layer.
   No dependencies, no network, nothing stored. Every part degrades to the static HTML. */
import { parseDecimal, positive, drawTo, reconstitute } from './calc.js';
import * as site from './picker.js';

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
  var waves = vial ? $$('.wave', vial) : [];
  var bubbles = vial ? $$('.bubbles circle', vial) : [];
  var motionBtn = $('.vial-motion');
  var level = 0; // the level the liquid is heading for, in %
  // The first level waits two frames, so the CSS entry (@starting-style) styles the liquid before an inline
  // transform exists: an inline value present at the first style resolution would win and skip the fill-in.
  var firstFill = null; // null: no level yet; a string: the first level, waiting; false: written
  var movingUntil = 0; // the level transition (900 ms) can be running until about this time
  var phase = 0;

  // While mixing, the level shows the water in a 3 ml vial, so the colour stays teal:
  // the app's colour bands describe what is left, and a freshly mixed vial has not been drawn from.
  function setVialLevel(pct) {
    if (!vial) return;
    var p = Math.max(0, Math.min(100, pct));
    // Body top 42, height 254; the fill uses (254 - 8) of it, as vial.jsx does.
    var tf = 'translateY(' + (292 - 2.46 * p).toFixed(1) + 'px)';
    movingUntil = performance.now() + 950;
    if (firstFill === false) liquid.style.transform = tf;
    else if (firstFill) firstFill = tf;
    else {
      firstFill = tf;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { liquid.style.transform = firstFill; firstFill = false; });
      });
    }
    level = p;
    updateMotion();
    if (!running) drawLiquid(); // a still surface still takes the new level's amplitude
  }

  // The surface and bubbles move as the app's do (vial.jsx): two sines, the phase gaining 0.04 a frame at
  // 60 Hz, so 2.4 a second here at any refresh rate. Coordinates are the liquid group's, 0 at the surface.
  // The maths runs in the app's own units for its default 84-wide vial (other screens draw it 50 to 100 wide),
  // scaled up by S to this 120-wide one, so the waves keep that vial's proportions instead of shrinking to
  // 2.5 % of the width. Bubble sizes and speeds scale the same way; they wrap across this vial's body.
  var S = 120 / 84;
  // While the level is moving, read where it is now from the transition, not where it is heading.
  function shownLevel() {
    if (!running || performance.now() > movingUntil) return level;
    var t = getComputedStyle(liquid).transform;
    if (!t || t === 'none') return level;
    var ty = new DOMMatrixReadOnly(t).m42;
    return Math.max(0, Math.min(100, (292 - ty) / 2.46));
  }
  function surface(ph, shown) {
    var amp = Math.min(3, shown / 20);
    var d = '';
    for (var x = 4; x <= 116; x += 3) {
      var xa = x / S;
      var y = (Math.sin(xa * 0.08 + ph) * amp + Math.sin(xa * 0.18 + ph * 1.3) * amp * 0.4) * S;
      d += (d ? 'L' : 'M') + x + ' ' + y.toFixed(2);
    }
    return d + 'L116 270H4Z';
  }
  function drawLiquid() {
    if (waves.length < 2) return;
    var shown = shownLevel();
    waves[0].setAttribute('d', surface(phase, shown));
    waves[1].setAttribute('d', surface(phase + 1.8, shown));
    var span = Math.max(1, shown * 2.46 - 20);
    bubbles.forEach(function (b, i) {
      b.setAttribute('cx', (10 + (((phase * 10 + i * 23) * S) % 104)).toFixed(1));
      b.setAttribute('cy', (12 + (((phase * 20 + i * 40) * S) % span)).toFixed(1));
    });
  }

  // It moves for as long as it is on screen, like the app's. WCAG 2.2.2 asks for a way to stop motion that
  // lasts over five seconds: that is the button under the vial. Reduced motion: no movement at all.
  var running = false;
  var userPaused = false;
  var onScreen = true;
  var raf = 0;
  var lastT = 0;
  function frame(t) {
    phase += lastT ? 2.4 * Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    drawLiquid();
    raf = requestAnimationFrame(frame);
  }
  function updateMotion() {
    if (!vial) return;
    // An empty vial has a flat surface and no bubbles, so there is nothing to redraw.
    var on = !reduceMotion.matches && !userPaused && onScreen && level > 0;
    if (motionBtn) motionBtn.hidden = reduceMotion.matches;
    if (on !== running) {
      running = on;
      cancelAnimationFrame(raf);
      lastT = 0;
      if (on) raf = requestAnimationFrame(frame);
    }
    vial.classList.toggle('is-moving', running && level > 15);
  }
  if (motionBtn) {
    motionBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      motionBtn.classList.toggle('is-paused', userPaused);
      motionBtn.setAttribute('aria-pressed', String(userPaused));
      updateMotion();
    });
  }
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', updateMotion);
  else if (reduceMotion.addListener) reduceMotion.addListener(updateMotion); // Safari before 14

  // One burst of the green "you can press this" ring on each element, 0.5 s apart, at most three bursts
  // per element per visit. The class comes off when the burst ends, so nothing replays it by accident (a
  // button shown again, a field that wants a dose again), and a burst already running is left alone.
  // Reduced motion: no ring (the dose field's teal border and the Log tag stay).
  function pulse(els) {
    if (reduceMotion.matches) return;
    els = els.filter(function (el) {
      var n = Number(el.getAttribute('data-pulses') || 0);
      return !el.classList.contains('pulse') && n < 3;
    });
    els.forEach(function (el, i) {
      el.setAttribute('data-pulses', String(Number(el.getAttribute('data-pulses') || 0) + 1));
      el.style.setProperty('--pulse-delay', (i * 0.5) + 's');
      el.classList.add('pulse');
      // Backstop for a ring that never ran or never reported its end (a browser without animationcancel).
      setTimeout(function () { el.classList.remove('pulse'); }, (i * 0.5 + 4.5) * 1000);
    });
  }
  function endPulse(e) { if (e.animationName === 'tap-ring') e.target.classList.remove('pulse'); }
  document.addEventListener('animationend', endPulse);
  document.addEventListener('animationcancel', endPulse);

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
  var drawCard = $('.draw');
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

    var r = reconstitute(v, w, d);
    out.conc.textContent = r.conc === null ? '—' : r.conc.toFixed(2);
    out.doses.textContent = r.dosesPerVial === null ? '—' : String(r.dosesPerVial);
    out.doses.closest('.readout > div').classList.toggle('is-empty', r.dosesPerVial === null);

    if (r.units !== null) {
      var units = r.units;
      var label = drawTo(units);
      out.units.textContent = label;
      out.units.className = 'draw-num' + (label.length >= 4 ? ' len-' + Math.min(6, label.length) : '');
      out.ml.textContent = r.volume.toFixed(3);
      out.pct.textContent = drawTo(Math.min(100, units)) + '%';
      out.fill.style.width = Math.min(100, units) + '%';
      if (drawCard) drawCard.classList.remove('is-waiting');
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
      if (drawCard) drawCard.classList.add('is-waiting');
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
    updateMotion();
    // The empty dose field rings each time the calculator comes into view, until a dose is typed.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var box = inDose.parentNode;
        if (entries[0].isIntersecting && box.classList.contains('wants')) pulse([box]);
      }, { threshold: 0.6 }).observe(inDose);
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
  // The page names no dose: the amounts on this screen are masked, and none is written here either.
  // A Log drops the row's vial by a plausible step (62.5 -> 50 %, 40 -> 30 %).
  var DATA = [
    { name: 'AM blend', when: 'in 12m · 08:00', before: 62.5, after: 50 },
    { name: 'PM blend', when: 'in 12h 12m · 20:00', before: 40, after: 30 }
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
    rows.forEach(function (row, i) { row.classList.toggle('is-next', i === next); });
    var shown = DATA[next === -1 ? DATA.length - 1 : next];
    $('[data-next-name]', phone).textContent = shown.name;
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
    phone.classList.add('tried'); // the hint has done its job: no more tag, no more pulses
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

  // Every Log the visitor can press rings, one after the other, until they have pressed one.
  function pulseLog() {
    if (phone.classList.contains('tried')) return;
    pulse($$('.row-log', phone).filter(isShown));
  }

  function setState(n) {
    if (!phone) return;
    var was = phone.getAttribute('data-state');
    phone.setAttribute('data-state', String(n));
    clearTimeout(resetTimer);
    takenState = [n >= 2, false];
    render(takenState);
    // Steps 1 and 2 are about pressing Log; step 3 is about the banner, so nothing else moves then.
    if (String(n) !== was && n !== 3) pulseLog();
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
    // The Log pulse runs each time the screen comes into view, not at load while it is below the fold.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) pulseLog();
      }, { threshold: 0.5 }).observe(phone);
    }
  }

  // Each statement is a button that puts the Home screen in its state.
  if (phone) {
    $$('.step').forEach(function (s) {
      $('.step-btn', s).addEventListener('click', function () {
        var n = Number(s.getAttribute('data-step'));
        setState(n);
        var changed = n === 3 ? $('.nudge', phone) : $('.dose-row', phone);
        var r = changed.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight - 80) {
          changed.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }
      });
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
      '.loop h2, .loop .step, .loop-stage',
      '.reminders-text > *, .lock, .reminders-facts',
      '.sites-text > *, .picker',
      '.cycles h2, .cycles .section-lead, .sheet, .note',
      '.privacy-head > *, .facts-group, .facts-rows > div',
      '.faq h2, .faq details',
      '.cta-copy > *, .welcome'
    ];
    var revealer = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.style.setProperty('--i', String(Math.min(k++, 6)));
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
    }, { threshold: 0, rootMargin: '0px 0px -64px 0px' });
    document.addEventListener('focusin', function (e) {
      var hidden = e.target.closest && e.target.closest('[data-reveal]');
      if (!hidden) return;
      hidden.removeAttribute('data-reveal');
      hidden.classList.remove('in');
      hidden.style.removeProperty('--i');
    });
    groups.forEach(function (sel) {
      $$(sel).forEach(function (el) {
        el.setAttribute('data-reveal', '');
        revealer.observe(el);
      });
    });
  }

  /* ---------- One choice from a set (the WAI-ARIA radio group pattern) ---------- */

  // One tab stop for the set; the arrow keys move the choice, Space or Enter takes the focused one.
  function radioGroup(items, isChecked, choose) {
    var sync = function () {
      var any = items.some(isChecked);
      items.forEach(function (el, i) { el.setAttribute('tabindex', isChecked(el) || (!any && i === 0) ? '0' : '-1'); });
    };
    // quiet: a click with detail 0 (Enter or Space on a button, or assistive tech) plays no motion; what is
    // announced still follows byKey, so a screen reader's click is still named.
    var take = function (el, byKey, quiet) { choose(el, byKey, quiet); sync(); };
    items.forEach(function (el, i) {
      el.addEventListener('click', function (e) { take(el, false, e.detail === 0); });
      el.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return; // leave browser shortcuts (Alt+Left is Back) alone
        var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (step) {
          e.preventDefault();
          var next = items[(i + step + items.length) % items.length];
          take(next, true);
          next.focus();
        } else if ((e.key === ' ' || e.key === 'Enter') && el.tagName !== 'BUTTON') {
          // a <button> turns these into a click by itself
          e.preventDefault();
          take(el, true);
        }
      });
    });
    sync();
    return sync;
  }

  /* ---------- Reminders: the timing choice moves the lock screen ---------- */

  var lock = $('.lock');
  var timing = $('.timing');
  if (lock && timing) {
    var DOSE_AT = 8 * 60; // the example dose is due at 08:00
    var lockTime = $('[data-lock-time]', lock);
    var doseNotif = $('[data-notif-dose]', lock);
    var timingStatus = $('#timing-status');
    var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var now = new Date();
    $('[data-lock-date]', lock).textContent = DAY_NAMES[now.getDay()] + ' ' + now.getDate() + ' ' + MONTH_NAMES[now.getMonth()];

    var clock = function (mins) { return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0'); };
    // A notification arrives the way Android shows one: it drops in from above. Once per arrival, 420 ms.
    var arrive = function (els) {
      if (reduceMotion.matches) return;
      els.forEach(function (el, i) {
        el.classList.remove('arrive');
        void el.offsetWidth;
        el.style.setProperty('--notif-delay', (i * 0.14) + 's');
        el.classList.add('arrive');
      });
    };
    var chips = $$('.t-chip', timing);
    var show = function (b) {
      var lead = Number(b.getAttribute('data-lead'));
      var at = clock(DOSE_AT - lead);
      lockTime.textContent = at;
      if (timingStatus) timingStatus.textContent = 'The reminder arrives at ' + at + (lead ? ', ' + lead + ' minutes before the dose.' : ', at the dose time.');
    };
    var checked = function (b) { return b.getAttribute('aria-checked') === 'true'; };
    var land = null; // set while the cards are held back
    radioGroup(chips, checked, function (b, byKey, quiet) {
      if (checked(b)) return;
      chips.forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      show(b);
      if (land) land(byKey || quiet); // a choice made before the cards landed lands them both
      else if (!byKey && !quiet) { doseNotif.classList.add('again'); arrive([doseNotif]); }
    });
    var first = chips.filter(checked)[0] || chips[0];
    if (first) show(first); // the clock and the status line come from the checked choice, not the HTML
    timing.hidden = false; // the choice only works with the script, so it only shows with it
    // The cards stay hidden (script only, motion allowed) until any part of their list is in the upper 60% of
    // the viewport, then drop in once, so the arrival is seen rather than played below the fold.
    var notifs = $('.notifs', lock);
    if ('IntersectionObserver' in window && !reduceMotion.matches && notifs) {
      $$('.notif', lock).forEach(function (n) { n.classList.add('pending'); });
      var seen = new IntersectionObserver(function (entries) {
        if (land && entries.some(function (e) { return e.isIntersecting; })) land(false);
      }, { rootMargin: '0px 0px -40% 0px' });
      land = function (still) {
        seen.disconnect();
        land = null;
        $$('.notif', lock).forEach(function (n) { n.classList.remove('pending'); });
        if (!still) arrive($$('.notif', lock).reverse()); // the older alert first, then the reminder on top of it
      };
      seen.observe(notifs);
    }
  }

  /* ---------- Site rotation: the dose screen's body picker ---------- */

  var picker = $('.picker');
  if (picker) {
    var picked = site.NEXT; // the app preselects its suggestion
    var allZones = $$('.zone', picker);
    var pickLabel = $('[data-pick-label]', picker);
    var pickWarn = $('[data-pick-warn]', picker);
    var pickHint = $('[data-pick-hint]', picker);
    var pickStatus = $('#pick-status');
    var nameOf = function (z) { return z.getAttribute('data-name'); };
    var pickable = function (z) { return site.OFF.indexOf(z.getAttribute('data-site')) === -1; };

    allZones.forEach(function (z) {
      var key = z.getAttribute('data-site');
      z.setAttribute('data-name', z.getAttribute('aria-label'));
      z.setAttribute('aria-label', nameOf(z) + site.describe(key));
      if (pickable(z)) z.setAttribute('role', 'radio'); // only once the script is here to answer a tap
    });
    // Every warning a pick can show sits invisibly in the warning's own cell, so the cell is always as tall as
    // the tallest one at this width: picking an area never changes the card's height or moves the page.
    var warnSlot = $('[data-pick-warn-slot]', picker);
    // ponytail: warnings depend on the pick alone (static USES); if they ever depend on more, build these from that too.
    var warnings = new Set();
    allZones.filter(pickable).forEach(function (z) { warnings.add(site.warning(z.getAttribute('data-site'))); });
    warnings.delete('');
    warnings.forEach(function (w) {
      var sizer = document.createElement('p');
      sizer.className = 'pick-warn pick-warn-sizer';
      sizer.setAttribute('aria-hidden', 'true');
      sizer.textContent = w;
      warnSlot.appendChild(sizer);
    });

    var paint = function () {
      var current = null;
      allZones.filter(pickable).forEach(function (z) {
        var key = z.getAttribute('data-site');
        z.setAttribute('data-state', site.zoneState(key, picked));
        z.classList.toggle('is-next', key === site.NEXT);
        z.setAttribute('aria-checked', key === picked ? 'true' : 'false');
        if (key === picked) current = z;
      });
      var warn = site.warning(picked);
      pickLabel.textContent = nameOf(current);
      pickLabel.classList.toggle('warn', warn !== '');
      pickWarn.hidden = warn === '';
      pickWarn.textContent = warn;
      return warn;
    };

    var syncs = [];
    $$('.body-map', picker).forEach(function (svg) {
      svg.setAttribute('role', 'radiogroup');
      syncs.push(radioGroup($$('.zone', svg).filter(pickable),
        function (z) { return z.getAttribute('data-site') === picked; },
        function (z, byKey) {
          picked = z.getAttribute('data-site');
          var warn = paint();
          syncs.forEach(function (s) { s(); });
          if (!pickStatus) return;
          // A key move lands focus on the radio, which announces its name; a tap does not, so say it. Emptied
          // first, so the same words twice in a row are still announced.
          var text = (byKey ? '' : nameOf(z) + ' picked. ') + warn;
          pickStatus.textContent = '';
          setTimeout(function () { pickStatus.textContent = text; }, 60);
        }));
    });

    var toggle = $('.view-toggle', picker);
    var viewBtns = toggle ? $$('[data-view-btn]', toggle) : [];
    radioGroup(viewBtns, function (b) { return b.getAttribute('aria-checked') === 'true'; }, function (b) {
      var v = b.getAttribute('data-view-btn');
      viewBtns.forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      $$('.body-map', picker).forEach(function (svg) {
        var on = svg.getAttribute('data-view') === v;
        // toggleAttribute, not .hidden: an SVG element has no hidden property, so assigning one does nothing.
        svg.toggleAttribute('hidden', !on);
        if (on) pickHint.textContent = svg.getAttribute('data-hint');
      });
    });
    if (toggle) toggle.hidden = false; // the back of the body is only reachable with the script, so the switch waits for it
    paint();
  }

  /* ---------- Pause the vial's motion while it is off screen ---------- */

  if (vial && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      updateMotion();
    }).observe(vial);
  }
})();
