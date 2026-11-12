/* Guide pages: the step in view (or focused) rings the matching part of the app screen.
   Without this script every step and the whole screen still show. */
(function () {
  'use strict';

  Array.prototype.forEach.call(document.querySelectorAll('[data-guide]'), function (guide) {
    var steps = Array.prototype.slice.call(guide.querySelectorAll('[data-step]'));
    var stage = guide.querySelector('.guide-stage');
    var label = guide.querySelector('[data-where-label]');
    if (!stage || !steps.length) return;
    var current = null;

    function show(step) {
      if (step === current) return;
      current = step;
      var id = step.getAttribute('data-step');
      steps.forEach(function (s) {
        if (s === step) s.setAttribute('aria-current', 'step');
        else s.removeAttribute('aria-current');
      });
      stage.setAttribute('data-focus', id);
      Array.prototype.forEach.call(stage.querySelectorAll('[data-region]'), function (r) {
        r.classList.toggle('is-focus', r.getAttribute('data-region') === id);
      });
      if (label) label.textContent = step.getAttribute('data-where') || '';
    }

    steps.forEach(function (s) { s.addEventListener('focusin', function () { show(s); }); });
    // The current step is the last one whose top has passed 45% of the window height.
    var queued = false;
    function pick() {
      queued = false;
      var line = window.innerHeight * 0.45;
      var chosen = steps[0];
      steps.forEach(function (s) { if (s.getBoundingClientRect().top <= line) chosen = s; });
      show(chosen);
    }
    function queue() { if (!queued) { queued = true; window.requestAnimationFrame(pick); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    pick();
  });
})();
