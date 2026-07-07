// public/js/partner-slider.js
// Renders an auto-scrolling, drag-and-touch-pausable logo slider into any
// element with [data-partner-slider="lakeview|hospital"]. Pulls partners
// from the matching public API endpoint. Self-contained — just include
// this script after icons.js/api.js and it wires itself up on DOMContentLoaded.

(function () {
  async function initPartnerSlider(container) {
    const division = container.dataset.partnerSlider;
    if (!division) return;

    try {
      const partners = await api.get(`/api/${division}/partners`);
      if (!partners.length) {
        container.innerHTML = `<p class="partner-slider__empty">Partner logos will appear here once added from the admin dashboard.</p>`;
        return;
      }

      // Duplicate the list so the CSS animation (translateX -50%) loops seamlessly.
      const itemsHtml = partners
        .map((p) => itemHtml(p))
        .join('');

      container.innerHTML = `
        <div class="partner-slider__track">
          ${itemsHtml}
          ${itemsHtml}
        </div>
      `;

      // Scale scroll duration to content length so logo spacing/speed feels
      // consistent whether there are 6 partners or 36.
      const track = container.querySelector('.partner-slider__track');
      const approxSeconds = Math.max(20, partners.length * 2.6);
      container.style.setProperty('--partner-duration', `${approxSeconds}s`);

      wireDragToScroll(container, track);
      wireTouchPause(container);
    } catch (e) {
      container.innerHTML = `<p class="partner-slider__empty">Could not load partners.</p>`;
    }
  }

  function itemHtml(p) {
    const inner = `<img src="${p.logo_url}" alt="${p.name}" loading="lazy" />`;
    return `
      <span class="partner-slider__item" title="${p.name}">
        ${p.website_url ? `<a href="${p.website_url}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner}
      </span>
    `;
  }

  // Manual drag-to-scroll: while dragging, the CSS animation is paused (via
  // the .dragging class) and we directly translate the track with a CSS
  // custom property offset layered on top of the animation's own transform.
  function wireDragToScroll(container, track) {
    let isDown = false;
    let startX = 0;
    let scrollOffset = 0;
    let baseTransform = 0;

    function getTranslateX(el) {
      const style = window.getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(style.transform);
      return matrix.m41;
    }

    function pointerDown(x) {
      isDown = true;
      container.classList.add('dragging');
      startX = x;
      baseTransform = getTranslateX(track);
      track.style.transition = 'none';
    }

    function pointerMove(x) {
      if (!isDown) return;
      scrollOffset = x - startX;
      track.style.transform = `translateX(${baseTransform + scrollOffset}px)`;
    }

    function pointerUp() {
      if (!isDown) return;
      isDown = false;
      container.classList.remove('dragging');
      // Hand control back to the CSS animation from a neutral state rather
      // than snapping, so it doesn't jump visually.
      track.style.transition = '';
      track.style.transform = '';
    }

    container.addEventListener('mousedown', (e) => pointerDown(e.clientX));
    window.addEventListener('mousemove', (e) => pointerMove(e.clientX));
    window.addEventListener('mouseup', pointerUp);

    container.addEventListener('touchstart', (e) => pointerDown(e.touches[0].clientX), { passive: true });
    container.addEventListener('touchmove', (e) => pointerMove(e.touches[0].clientX), { passive: true });
    container.addEventListener('touchend', pointerUp);
  }

  // Pause the auto-scroll while a touch is active anywhere on the slider,
  // even before a drag threshold is met (covers brief taps to read a logo).
  function wireTouchPause(container) {
    container.addEventListener('touchstart', () => container.classList.add('paused'), { passive: true });
    container.addEventListener('touchend', () => container.classList.remove('paused'));
    container.addEventListener('touchcancel', () => container.classList.remove('paused'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-partner-slider]').forEach(initPartnerSlider);
  });
})();
