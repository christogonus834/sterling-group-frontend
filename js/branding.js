// public/js/branding.js
// Loads the configured logo (if any) and swaps it into every element
// carrying the brand-mark glyph slot IDs. Falls back silently to the
// existing inline SVG mark already in the HTML when no logo is set.
//
// Usage: call loadBranding('group' | 'lakeview' | 'hospital') once per page.
// It always fetches the group logo too, since some pages show both
// (e.g. the division logo in the header, the group mark in the footer).

async function loadBranding(division) {
  try {
    const endpoint = division === 'group' ? '/api/group/branding' : `/api/${division}/branding`;
    const data = await api.get(endpoint);

    const groupLogo = data.groupLogo || null;
    const divisionLogo = data.divisionLogo || null;

    // Header/primary slot: prefer the division's own logo, fall back to the group mark.
    applyLogo('brandLogoSlot', divisionLogo || groupLogo);
    // Footer slot (landing page only has this one): always the group mark.
    applyLogo('brandLogoSlotFooter', groupLogo);
  } catch (e) {
    // Network or DB hiccup — leave the default SVG glyph in place, no visible error needed.
  }
}

function applyLogo(elementId, url) {
  const slot = document.getElementById(elementId);
  if (!slot || !url) return;
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Sterling Group logo';
  slot.innerHTML = '';
  slot.appendChild(img);
}
