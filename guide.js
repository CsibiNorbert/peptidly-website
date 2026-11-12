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
    show(steps[0]);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) show(e.target); });
    }, { rootMargin: '-35% 0px -50% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  });
})();
