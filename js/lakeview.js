// public/js/lakeview.js
document.getElementById('year').textContent = new Date().getFullYear();
loadBranding('lakeview');

const roomsGrid = document.getElementById('roomsGrid');
const postsGrid = document.getElementById('postsGrid');
const bookingModal = document.getElementById('bookingModal');
const bookingModalContent = document.getElementById('bookingModalContent');

const AMENITY_ICON = {
  'Swimming Pool': 'pool',
  'Free Wifi': 'wifi',
  Breakfast: 'breakfast',
  'Room Service': 'breakfast',
  'Parking Space': 'building',
  'Pick Up & Drop': 'arrowUpRight',
  'Full Kitchen': 'kitchen',
  Kitchenette: 'kitchen',
};

let roomsCache = [];

function roomCardHtml(room) {
  const amenityPills = (room.amenities || [])
    .slice(0, 3)
    .map((a) => `<span class="amenity-pill">${a}</span>`)
    .join('');

  return `
    <article class="room-card" data-room-id="${room.id}">
      <div class="room-card__media">
        <img src="${room.cover_image_url || 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1200'}" alt="${room.name}" loading="lazy" />
        <span class="room-card__badge">${room.category === 'apartment' ? 'Apartment' : 'Room'}</span>
      </div>
      <div class="room-card__body">
        <div class="room-card__title-row">
          <h3 class="room-card__title">${room.name}</h3>
          <div class="room-card__price">
            <strong>${formatMoney(room.price_per_night, room.currency)}</strong>
            <span>per night</span>
          </div>
        </div>
        <p class="room-card__desc">${room.description || ''}</p>
        <div class="room-card__meta">
          <span>${icon('users')}${room.capacity_min}–${room.capacity_max} guests</span>
          ${room.size_sqft ? `<span>${icon('ruler')}${room.size_sqft} sqft</span>` : ''}
          <span>${icon('bed')}${room.bed_type}</span>
        </div>
        <div class="room-card__footer">
          <div class="room-card__amenities">${amenityPills}</div>
        </div>
        <button class="btn btn-lv btn-book" data-room-id="${room.id}" style="justify-content:center;width:100%;margin-top:6px;">
          Check availability &amp; book
        </button>
      </div>
    </article>
  `;
}

async function loadRooms() {
  roomsGrid.innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="room-card">
      <div class="skeleton" style="aspect-ratio:16/10;"></div>
      <div class="room-card__body">
        <div class="skeleton" style="height:22px;width:60%;margin-bottom:10px;"></div>
        <div class="skeleton" style="height:14px;width:90%;margin-bottom:6px;"></div>
        <div class="skeleton" style="height:14px;width:70%;"></div>
      </div>
    </div>
  `).join('');

  try {
    roomsCache = await api.get('/api/lakeview/rooms');
    if (!roomsCache.length) {
      roomsGrid.innerHTML = `<p style="color:var(--stone);">No rooms are listed yet. Please check back soon.</p>`;
      return;
    }
    roomsGrid.innerHTML = roomsCache.map(roomCardHtml).join('');
  } catch (e) {
    roomsGrid.innerHTML = `<p style="color:#8a2e1f;">Could not load rooms: ${e.message}</p>`;
  }
}

async function loadPosts() {
  try {
    const posts = await api.get('/api/lakeview/posts');
    if (!posts.length) {
      postsGrid.parentElement.parentElement.style.display = 'none';
      return;
    }
    postsGrid.innerHTML = posts.slice(0, 3).map((p) => `
      <article class="post-card">
        <div class="post-card__media"><img src="${p.cover_image_url || 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=800'}" alt="${p.title}" loading="lazy" /></div>
        <div class="post-card__body">
          <p class="post-card__date">${formatDate(p.published_at || p.created_at)}</p>
          <h3 class="post-card__title">${p.title}</h3>
          <p class="post-card__excerpt">${p.excerpt || ''}</p>
        </div>
      </article>
    `).join('');
  } catch (e) {
    postsGrid.parentElement.parentElement.style.display = 'none';
  }
}

function renderAmenityIcons() {
  document.querySelectorAll('#amenitiesStrip .amenity-block').forEach((block) => {
    const label = block.querySelector('span:last-child').textContent.trim();
    const key = AMENITY_ICON[label] || 'check';
    block.querySelector('.icon').innerHTML = ICONS[key] || '';
  });
}

async function loadIntroContent() {
  try {
    const content = await api.get('/api/lakeview/content');

    const intro = content.find((c) => c.id === 'lakeview_intro');
    if (intro) {
      if (intro.title) document.getElementById('introTitle').textContent = intro.title;
      if (intro.body) document.getElementById('introBody').textContent = intro.body;
      if (intro.image_url) document.getElementById('introImage').src = intro.image_url;
    }

    const extras = content.filter((c) => c.placement === 'extra').sort((a, b) => a.sort_order - b.sort_order);
    renderExtraContent(extras);
  } catch (e) { /* fall back to static copy already in HTML */ }
}

function renderExtraContent(extras) {
  const wrap = document.getElementById('extraContentWrap');
  if (!wrap || !extras.length) return;

  wrap.innerHTML = extras.map((block, i) => `
    <section class="section ${i % 2 === 1 ? 'section--tint' : ''}">
      <div class="container split">
        ${block.image_url ? `
          <div class="split__media"><img src="${block.image_url}" alt="${block.title || ''}" loading="lazy" /></div>
          <div class="split__copy">
            <h2>${block.title || ''}</h2>
            <p>${block.body || ''}</p>
          </div>
        ` : `
          <div class="split__copy" style="grid-column: 1 / -1; max-width: 640px;">
            <h2>${block.title || ''}</h2>
            <p>${block.body || ''}</p>
          </div>
        `}
      </div>
    </section>
  `).join('');
}

// ---------------- BOOKING MODAL ----------------

function openBookingModal(roomId) {
  const room = roomsCache.find((r) => r.id === roomId);
  if (!room) return;

  bookingModalContent.innerHTML = `
    <div class="booking-modal__header">
      <button class="btn-ghost" id="closeModalBtn" style="float:right;padding:6px;border-radius:50%;" aria-label="Close">${icon('close')}</button>
      <h3 class="booking-modal__room-name" id="bookingModalTitle">${room.name}</h3>
      <p class="booking-modal__room-price">${formatMoney(room.price_per_night, room.currency)} / night &middot; ${room.capacity_min}–${room.capacity_max} guests</p>
    </div>
    <form class="booking-form" id="bookingForm">
      <div class="form-row">
        <div class="form-field">
          <label for="checkIn">Check-in</label>
          <input type="date" id="checkIn" required min="${new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="form-field">
          <label for="checkOut">Check-out</label>
          <input type="date" id="checkOut" required min="${new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
      <div id="availabilityNote"></div>
      <div class="form-row">
        <div class="form-field">
          <label for="guestsCount">Guests</label>
          <select id="guestsCount">
            ${Array.from({ length: room.capacity_max }, (_, i) => i + 1).map((n) => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="guestPhone">Phone</label>
          <input type="tel" id="guestPhone" placeholder="+234..." />
        </div>
      </div>
      <div class="form-field">
        <label for="guestName">Full name</label>
        <input type="text" id="guestName" required placeholder="Your name" />
      </div>
      <div class="form-field">
        <label for="guestEmail">Email</label>
        <input type="email" id="guestEmail" required placeholder="you@example.com" />
      </div>
      <div class="form-field">
        <label for="specialRequests">Special requests (optional)</label>
        <textarea id="specialRequests" placeholder="Early check-in, extra towels, dietary notes..."></textarea>
      </div>
      <div class="booking-summary" id="bookingSummary" style="display:none;">
        <span id="nightsLabel"></span>
        <strong id="totalLabel"></strong>
      </div>
      <button type="submit" class="btn btn-submit" id="submitBookingBtn">Request this stay</button>
    </form>
  `;

  bookingModal.classList.add('open');
  document.getElementById('closeModalBtn').addEventListener('click', closeBookingModal);

  const checkInInput = document.getElementById('checkIn');
  const checkOutInput = document.getElementById('checkOut');
  const note = document.getElementById('availabilityNote');
  const summary = document.getElementById('bookingSummary');
  const submitBtn = document.getElementById('submitBookingBtn');

  let lastAvailable = false;

  async function checkAvailability() {
    const checkIn = checkInInput.value;
    const checkOut = checkOutInput.value;
    if (!checkIn || !checkOut) return;

    if (new Date(checkOut) <= new Date(checkIn)) {
      note.innerHTML = `<div class="availability-note bad">${icon('alertCircle')}Check-out must be after check-in.</div>`;
      summary.style.display = 'none';
      lastAvailable = false;
      return;
    }

    note.innerHTML = `<div class="availability-note">Checking availability…</div>`;
    try {
      const result = await api.get(`/api/lakeview/availability?roomId=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}`);
      const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
      const total = nights * Number(room.price_per_night);

      if (result.available) {
        note.innerHTML = `<div class="availability-note">${icon('checkCircle')}Available — ${result.unitsFree} of ${result.totalUnits} unit${result.totalUnits > 1 ? 's' : ''} free for these dates.</div>`;
        summary.style.display = 'flex';
        document.getElementById('nightsLabel').textContent = `${nights} night${nights > 1 ? 's' : ''}`;
        document.getElementById('totalLabel').textContent = formatMoney(total, room.currency);
        lastAvailable = true;
      } else {
        note.innerHTML = `<div class="availability-note bad">${icon('alertCircle')}Fully booked for these dates. Please try different dates.</div>`;
        summary.style.display = 'none';
        lastAvailable = false;
      }
    } catch (e) {
      note.innerHTML = `<div class="availability-note bad">${icon('alertCircle')}${e.message}</div>`;
      lastAvailable = false;
    }
  }

  checkInInput.addEventListener('change', () => {
    checkOutInput.min = checkInInput.value;
    checkAvailability();
  });
  checkOutInput.addEventListener('change', checkAvailability);

  document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!lastAvailable) {
      showToast('Please choose available dates before booking.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending request…';

    try {
      const result = await api.post('/api/lakeview/bookings', {
        roomId: room.id,
        guestName: document.getElementById('guestName').value,
        guestEmail: document.getElementById('guestEmail').value,
        guestPhone: document.getElementById('guestPhone').value,
        checkIn: checkInInput.value,
        checkOut: checkOutInput.value,
        guestsCount: Number(document.getElementById('guestsCount').value),
        specialRequests: document.getElementById('specialRequests').value,
      });

      // Payments are on and Paystack gave us a checkout link — send the guest
      // there now. The booking already exists as "pending" and will be
      // auto-confirmed once payment-callback.html verifies the transaction.
      if (result.requiresPayment && result.authorizationUrl) {
        bookingModalContent.innerHTML = `
          <div class="modal-success">
            <span class="icon">${icon('checkCircle')}</span>
            <h3>Redirecting to payment…</h3>
            <p>Your booking for <strong>${room.name}</strong> is reserved. Please complete payment to confirm it.</p>
          </div>
        `;
        window.location.href = result.authorizationUrl;
        return;
      }

      // Payments are on but Paystack couldn't be reached — booking still
      // exists, just flag it so the guest knows to expect a manual follow-up.
      if (result.requiresPayment && !result.authorizationUrl) {
        bookingModalContent.innerHTML = `
          <div class="modal-success">
            <span class="icon">${icon('alertCircle')}</span>
            <h3>Request received</h3>
            <p>We've received your booking request for <strong>${room.name}</strong>, but couldn't start the online payment (${result.paymentError || 'unknown error'}). Our front desk will reach out to arrange payment.</p>
            <button class="btn btn-lv" id="closeSuccessBtn" style="margin-top:24px;">Done</button>
          </div>
        `;
        document.getElementById('closeSuccessBtn').addEventListener('click', closeBookingModal);
        return;
      }

      bookingModalContent.innerHTML = `
        <div class="modal-success">
          <span class="icon">${icon('checkCircle')}</span>
          <h3>Request sent</h3>
          <p>We've received your booking request for <strong>${room.name}</strong>. Our front desk will confirm by email shortly.</p>
          <button class="btn btn-lv" id="closeSuccessBtn" style="margin-top:24px;">Done</button>
        </div>
      `;
      document.getElementById('closeSuccessBtn').addEventListener('click', closeBookingModal);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request this stay';
    }
  });
}

function closeBookingModal() {
  bookingModal.classList.remove('open');
}

bookingModal.addEventListener('click', (e) => {
  if (e.target === bookingModal) closeBookingModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBookingModal();
});

roomsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-book');
  if (btn) openBookingModal(btn.dataset.roomId);
});

loadRooms();
loadPosts();
loadIntroContent();
renderAmenityIcons();