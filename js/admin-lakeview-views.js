// public/js/admin-lakeview-views.js
// Appended to admin.js logic. Handles all Lakeview-side admin views.

// ---------------------------------------------------------
// LV BOOKINGS
// ---------------------------------------------------------
async function renderLvBookings() {
  adminMain.innerHTML = topbar('Lakeview Bookings') + `
    <div class="panel" style="margin-bottom:18px;">
      <div class="panel__head">
        <h2>Guest payments</h2>
      </div>
      <div style="padding:18px 22px 22px;display:flex;align-items:center;gap:14px;">
        <label class="switch">
          <input type="checkbox" id="paymentsToggle" />
          <span class="switch__track"><span class="switch__thumb"></span></span>
        </label>
        <div>
          <div style="font-size:14.5px;font-weight:600;" id="paymentsToggleLabel">Loading…</div>
          <div style="font-size:12.5px;color:var(--stone);">When on, guests pay by card via Paystack at booking time and the booking is auto-confirmed on success.</div>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel__head">
        <h2>All bookings</h2>
        <select class="status-select" id="bookingStatusFilter">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div id="bookingsTableWrap"><div class="skeleton" style="height:280px;"></div></div>
    </div>
  `;
  wireTopbarBell();

  document.getElementById('bookingStatusFilter').addEventListener('change', (e) => loadBookings(e.target.value));
  loadBookings();
  loadPaymentsToggle();
}

async function loadPaymentsToggle() {
  const toggle = document.getElementById('paymentsToggle');
  const label = document.getElementById('paymentsToggleLabel');
  try {
    const { enabled, paystackConfigured } = await api.get('/api/admin/lakeview/settings/payments');
    toggle.checked = enabled;
    label.textContent = enabled ? 'Payments are ON' : 'Payments are OFF';
    if (!paystackConfigured) {
      label.textContent += ' — PAYSTACK_SECRET_KEY not set in .env';
      label.style.color = '#8a2e1f';
    }
  } catch (e) {
    label.textContent = 'Could not load payment settings: ' + e.message;
  }

  toggle.addEventListener('change', async () => {
    const wanted = toggle.checked;
    try {
      const result = await api.put('/api/admin/lakeview/settings/payments', { enabled: wanted });
      label.style.color = '';
      label.textContent = result.enabled ? 'Payments are ON' : 'Payments are OFF';
      showToast(result.enabled ? 'Guests will now pay online at booking.' : 'Online payment turned off.');
    } catch (e) {
      toggle.checked = !wanted; // revert
      showToast(e.message, 'error');
    }
  });
}

async function loadBookings(status = '') {
  const wrap = document.getElementById('bookingsTableWrap');
  try {
    const url = status ? `/api/admin/lakeview/bookings?status=${status}` : '/api/admin/lakeview/bookings';
    const bookings = await api.get(url);
    if (!bookings.length) {
      wrap.innerHTML = emptyState('No bookings yet.', 'calendar');
      return;
    }
    const paymentLabels = {
      not_required: '<span class="toggle-pill off">Not required</span>',
      pending: '<span class="toggle-pill off">Awaiting payment</span>',
      paid: '<span class="toggle-pill on">Paid</span>',
      failed: '<span class="toggle-pill off" style="background:#f5d9d3;color:#8a2e1f;">Failed</span>',
    };

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${bookings.map((b) => `
            <tr>
              <td><strong>${b.guest_name}</strong><br/><a href="mailto:${b.guest_email}" style="color:var(--stone);font-size:12.5px;">${b.guest_email}</a>${b.guest_phone ? `<br/><a href="tel:${b.guest_phone}" style="color:var(--stone);font-size:12.5px;">${b.guest_phone}</a>` : ''}</td>
              <td>${b.rooms?.name || '—'}</td>
              <td>${formatDate(b.check_in)} → ${formatDate(b.check_out)}</td>
              <td>${b.total_amount ? formatMoney(b.total_amount, b.currency) : '—'}</td>
              <td>${paymentLabels[b.payment_status] || paymentLabels.not_required}</td>
              <td>
                <select class="status-select" data-booking-id="${b.id}" data-action="status">
                  ${['pending','confirmed','completed','cancelled'].map((s) => `<option value="${s}" ${s === b.status ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                </select>
              </td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn danger" data-action="delete" data-booking-id="${b.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('[data-action="status"]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api.put(`/api/admin/lakeview/bookings/${sel.dataset.bookingId}`, { status: sel.value });
          showToast('Booking status updated.');
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
    wrap.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This booking will be permanently removed.', async () => {
          await api.del(`/api/admin/lakeview/bookings/${btn.dataset.bookingId}`);
          showToast('Booking deleted.');
          loadBookings(document.getElementById('bookingStatusFilter').value);
        });
      });
    });
  } catch (e) {
    wrap.innerHTML = emptyState('Could not load bookings: ' + e.message);
  }
}

// ---------------------------------------------------------
// LV ROOMS (manage grid with image upload overlay)
// ---------------------------------------------------------
async function renderLvRooms() {
  adminMain.innerHTML = topbar('Rooms &amp; Apartments') + `
    <div class="panel">
      <div class="panel__head">
        <h2>All room types</h2>
        <button class="btn btn-save" id="addRoomBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} Add room type</button>
      </div>
      <div class="manage-grid" id="roomsManageGrid"><div class="skeleton" style="height:240px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('addRoomBtn').addEventListener('click', () => openRoomForm());
  loadRoomsManage();
}

async function loadRoomsManage() {
  const grid = document.getElementById('roomsManageGrid');
  try {
    const rooms = await api.get('/api/admin/lakeview/rooms');
    if (!rooms.length) {
      grid.innerHTML = emptyState('No rooms yet. Add your first room type.', 'bed');
      return;
    }
    grid.innerHTML = rooms.map((r) => `
      <div class="manage-card" data-room-id="${r.id}">
        <div class="manage-card__media">
          <img src="${r.cover_image_url || 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=600'}" alt="${r.name}" />
          <label class="manage-card__upload-overlay">
            <span class="icon">${icon('upload')}</span>
            <input type="file" accept="image/*" class="sr-only" data-action="upload-room-image" data-room-id="${r.id}" />
          </label>
        </div>
        <div class="manage-card__body">
          <div class="manage-card__title">${r.name}</div>
          <div class="manage-card__meta">${formatMoney(r.price_per_night, r.currency)} / night &middot; ${r.total_units} unit${r.total_units > 1 ? 's' : ''}</div>
          <div class="manage-card__footer">
            <span class="toggle-pill ${r.is_active ? 'on' : 'off'}">${r.is_active ? 'Active' : 'Hidden'}</span>
            <div class="row-actions">
              <button class="icon-btn" data-action="edit-room" data-room-id="${r.id}" title="Edit"><span class="icon">${icon('edit')}</span></button>
              <button class="icon-btn danger" data-action="delete-room" data-room-id="${r.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action="edit-room"]').forEach((btn) => {
      btn.addEventListener('click', () => openRoomForm(rooms.find((r) => r.id === btn.dataset.roomId)));
    });
    grid.querySelectorAll('[data-action="delete-room"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This room type and its listing will be removed. Existing bookings remain on record.', async () => {
          await api.del(`/api/admin/lakeview/rooms/${btn.dataset.roomId}`);
          showToast('Room type deleted.');
          loadRoomsManage();
        });
      });
    });
    grid.querySelectorAll('[data-action="upload-room-image"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await api.upload(`/api/admin/lakeview/rooms/${input.dataset.roomId}/image`, file);
          await api.put(`/api/admin/lakeview/rooms/${input.dataset.roomId}`, { cover_image_url: url });
          showToast('Image updated.');
          loadRoomsManage();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    grid.innerHTML = emptyState('Could not load rooms: ' + e.message);
  }
}

function openRoomForm(room = null) {
  const isEdit = !!room;
  openAdminModal(`
    <form class="admin-modal-form" id="roomForm">
      <h3>${isEdit ? 'Edit room type' : 'Add room type'}</h3>
      <div>
        <label class="admin-label">Name</label>
        <input class="admin-input" id="roomName" required value="${room?.name || ''}" placeholder="e.g. Deluxe Room" />
      </div>
      <div class="field-grid">
        <div>
          <label class="admin-label">Category</label>
          <select class="admin-input" id="roomCategory">
            <option value="room" ${room?.category === 'room' ? 'selected' : ''}>Room</option>
            <option value="apartment" ${room?.category === 'apartment' ? 'selected' : ''}>Apartment</option>
          </select>
        </div>
        <div>
          <label class="admin-label">Bed type</label>
          <input class="admin-input" id="roomBedType" value="${room?.bed_type || 'Twin Bed'}" />
        </div>
      </div>
      <div>
        <label class="admin-label">Description</label>
        <textarea class="admin-textarea" id="roomDescription" placeholder="Short description shown to guests">${room?.description || ''}</textarea>
      </div>
      <div class="field-grid--3">
        <div>
          <label class="admin-label">Price / night (NGN)</label>
          <input class="admin-input" type="number" id="roomPrice" required min="0" value="${room?.price_per_night || ''}" />
        </div>
        <div>
          <label class="admin-label">Size (sqft)</label>
          <input class="admin-input" type="number" id="roomSize" min="0" value="${room?.size_sqft || ''}" />
        </div>
        <div>
          <label class="admin-label">Total units</label>
          <input class="admin-input" type="number" id="roomUnits" min="1" value="${room?.total_units || 1}" />
        </div>
      </div>
      <div class="field-grid">
        <div>
          <label class="admin-label">Min guests</label>
          <input class="admin-input" type="number" id="roomCapMin" min="1" value="${room?.capacity_min || 1}" />
        </div>
        <div>
          <label class="admin-label">Max guests</label>
          <input class="admin-input" type="number" id="roomCapMax" min="1" value="${room?.capacity_max || 2}" />
        </div>
      </div>
      <div>
        <label class="admin-label">Amenities (comma separated)</label>
        <input class="admin-input" id="roomAmenities" value="${(room?.amenities || []).join(', ')}" placeholder="Free Wifi, Breakfast, Swimming Pool" />
      </div>
      <div>
        <label class="admin-label">Cover image URL (or upload after saving)</label>
        <input class="admin-input" id="roomImageUrl" value="${room?.cover_image_url || ''}" placeholder="https://..." />
      </div>
      <label class="checkbox-row"><input type="checkbox" id="roomActive" ${room?.is_active !== false ? 'checked' : ''} /> Visible on the public site</label>
      <button type="submit" class="btn btn-save">${isEdit ? 'Save changes' : 'Create room type'}</button>
    </form>
  `);

  document.getElementById('roomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('roomName').value,
      category: document.getElementById('roomCategory').value,
      bed_type: document.getElementById('roomBedType').value,
      description: document.getElementById('roomDescription').value,
      price_per_night: Number(document.getElementById('roomPrice').value),
      size_sqft: Number(document.getElementById('roomSize').value) || null,
      total_units: Number(document.getElementById('roomUnits').value) || 1,
      capacity_min: Number(document.getElementById('roomCapMin').value) || 1,
      capacity_max: Number(document.getElementById('roomCapMax').value) || 2,
      amenities: document.getElementById('roomAmenities').value.split(',').map((s) => s.trim()).filter(Boolean),
      cover_image_url: document.getElementById('roomImageUrl').value || null,
      is_active: document.getElementById('roomActive').checked,
    };

    try {
      if (isEdit) {
        await api.put(`/api/admin/lakeview/rooms/${room.id}`, payload);
        showToast('Room type updated.');
      } else {
        await api.post('/api/admin/lakeview/rooms', payload);
        showToast('Room type created.');
      }
      closeAdminModal();
      loadRoomsManage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------
// LV / SH SHARED: POSTS (journal / health articles)
// ---------------------------------------------------------
async function renderPosts(division) {
  const title = division === 'lakeview' ? 'Journal Posts' : 'Health Articles';
  const base = division === 'lakeview' ? '/api/admin/lakeview/posts' : '/api/admin/hospital/posts';

  adminMain.innerHTML = topbar(title) + `
    <div class="panel">
      <div class="panel__head">
        <h2>${title}</h2>
        <button class="btn btn-save" id="addPostBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} New post</button>
      </div>
      <div class="manage-grid" id="postsManageGrid"><div class="skeleton" style="height:240px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('addPostBtn').addEventListener('click', () => openPostForm(division, base));
  loadPostsManage(division, base);
}

async function loadPostsManage(division, base) {
  const grid = document.getElementById('postsManageGrid');
  try {
    const posts = await api.get(base);
    if (!posts.length) {
      grid.innerHTML = emptyState('No posts yet. Write your first one.', 'bookOpen');
      return;
    }
    grid.innerHTML = posts.map((p) => `
      <div class="manage-card" data-post-id="${p.id}">
        <div class="manage-card__media">
          <img src="${p.cover_image_url || 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=600'}" alt="${p.title}" />
          <label class="manage-card__upload-overlay">
            <span class="icon">${icon('upload')}</span>
            <input type="file" accept="image/*" class="sr-only" data-action="upload-post-image" data-post-id="${p.id}" />
          </label>
        </div>
        <div class="manage-card__body">
          <div class="manage-card__title">${p.title}</div>
          <div class="manage-card__meta">${formatDate(p.published_at || p.created_at)}</div>
          <div class="manage-card__footer">
            <span class="toggle-pill ${p.is_published ? 'on' : 'off'}">${p.is_published ? 'Published' : 'Draft'}</span>
            <div class="row-actions">
              <button class="icon-btn" data-action="edit-post" data-post-id="${p.id}" title="Edit"><span class="icon">${icon('edit')}</span></button>
              <button class="icon-btn danger" data-action="delete-post" data-post-id="${p.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action="edit-post"]').forEach((btn) => {
      btn.addEventListener('click', () => openPostForm(division, base, posts.find((p) => p.id === btn.dataset.postId)));
    });
    grid.querySelectorAll('[data-action="delete-post"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This post will be permanently deleted.', async () => {
          await api.del(`${base}/${btn.dataset.postId}`);
          showToast('Post deleted.');
          loadPostsManage(division, base);
        });
      });
    });
    grid.querySelectorAll('[data-action="upload-post-image"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await api.upload(`${base}/${input.dataset.postId}/image`, file);
          await api.put(`${base}/${input.dataset.postId}`, { cover_image_url: url });
          showToast('Image updated.');
          loadPostsManage(division, base);
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    grid.innerHTML = emptyState('Could not load posts: ' + e.message);
  }
}

function openPostForm(division, base, post = null) {
  const isEdit = !!post;
  openAdminModal(`
    <form class="admin-modal-form" id="postForm">
      <h3>${isEdit ? 'Edit post' : 'New post'}</h3>
      <div>
        <label class="admin-label">Title</label>
        <input class="admin-input" id="postTitle" required value="${post?.title || ''}" />
      </div>
      <div>
        <label class="admin-label">Excerpt</label>
        <input class="admin-input" id="postExcerpt" value="${post?.excerpt || ''}" placeholder="One-line summary shown on the card" />
      </div>
      <div>
        <label class="admin-label">Body</label>
        <textarea class="admin-textarea" id="postBody" style="min-height:160px;">${post?.body || ''}</textarea>
      </div>
      <div>
        <label class="admin-label">Cover image URL (or upload after saving)</label>
        <input class="admin-input" id="postImageUrl" value="${post?.cover_image_url || ''}" />
      </div>
      <label class="checkbox-row"><input type="checkbox" id="postPublished" ${post?.is_published !== false ? 'checked' : ''} /> Published</label>
      <button type="submit" class="btn btn-save">${isEdit ? 'Save changes' : 'Create post'}</button>
    </form>
  `);

  document.getElementById('postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('postTitle').value,
      excerpt: document.getElementById('postExcerpt').value,
      body: document.getElementById('postBody').value,
      cover_image_url: document.getElementById('postImageUrl').value || null,
      is_published: document.getElementById('postPublished').checked,
    };
    try {
      if (isEdit) {
        await api.put(`${base}/${post.id}`, payload);
        showToast('Post updated.');
      } else {
        await api.post(base, payload);
        showToast('Post created.');
      }
      closeAdminModal();
      loadPostsManage(division, base);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------
// LV / SH SHARED: PAGE CONTENT (hero/intro editable blocks)
// ---------------------------------------------------------
async function renderContent(division) {
  const base = division === 'lakeview' ? '/api/admin/lakeview/content' : '/api/admin/hospital/content';
  const reorderBase = division === 'lakeview' ? '/api/admin/lakeview/content-reorder' : '/api/admin/hospital/content-reorder';

  adminMain.innerHTML = topbar('Page Content') + `
    <div class="panel">
      <div class="panel__head">
        <h2>Editable sections</h2>
        <button class="btn btn-save" id="addContentBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} Add section</button>
      </div>
      <p style="padding:16px 22px 0;color:var(--stone);font-size:13px;">Built-in sections can only be edited. New sections you add can be edited, reordered (drag the cards), or deleted — they'll appear on the public homepage automatically.</p>
      <div id="contentList" style="padding:22px;"><div class="skeleton" style="height:200px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('addContentBtn').addEventListener('click', () => openContentForm(division, base, reorderBase));
  loadContentList(division, base, reorderBase);
}

async function loadContentList(division, base, reorderBase) {
  const list = document.getElementById('contentList');
  try {
    const blocks = await api.get(base);
    if (!blocks.length) {
      list.innerHTML = emptyState('No editable content blocks found.', 'layers');
      return;
    }
    list.innerHTML = blocks.map((b) => `
      <div class="manage-card" style="margin-bottom:18px;flex-direction:row;align-items:stretch;" data-content-id="${b.id}" data-placement="${b.placement || 'fixed'}" draggable="${b.placement === 'extra'}">
        <div class="manage-card__media" style="width:220px;flex-shrink:0;aspect-ratio:auto;">
          <img src="${b.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=400'}" alt="" />
          <label class="manage-card__upload-overlay">
            <span class="icon">${icon('upload')}</span>
            <input type="file" accept="image/*" class="sr-only" data-action="upload-content-image" data-content-id="${b.id}" />
          </label>
        </div>
        <div class="manage-card__body" style="flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span class="toggle-pill ${b.placement === 'extra' ? 'on' : 'off'}">${b.placement === 'extra' ? 'Added by you' : 'Built-in'}</span>
            ${b.placement === 'extra' ? `<button class="icon-btn danger" data-action="delete-content" data-content-id="${b.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>` : ''}
          </div>
          <label class="admin-label">Title</label>
          <input class="admin-input" data-field="title" value="${b.title || ''}" style="margin-bottom:10px;" />
          <label class="admin-label">Body</label>
          <textarea class="admin-textarea" data-field="body" style="min-height:90px;">${b.body || ''}</textarea>
          <button class="btn btn-save" data-action="save-content" data-content-id="${b.id}" style="margin-top:10px;padding:9px 16px;font-size:13px;align-self:flex-start;">Save</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-action="save-content"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('[data-content-id]');
        const title = card.querySelector('[data-field="title"]').value;
        const body = card.querySelector('[data-field="body"]').value;
        try {
          await api.put(`${base}/${btn.dataset.contentId}`, { title, body });
          showToast('Content updated.');
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
    list.querySelectorAll('[data-action="upload-content-image"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await api.upload(`${base}/${input.dataset.contentId}/image`, file);
          await api.put(`${base}/${input.dataset.contentId}`, { image_url: url });
          showToast('Image updated.');
          loadContentList(division, base, reorderBase);
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
    list.querySelectorAll('[data-action="delete-content"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This section will be removed from the public homepage.', async () => {
          try {
            await api.del(`${base}/${btn.dataset.contentId}`);
            showToast('Section deleted.');
            loadContentList(division, base, reorderBase);
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    });

    wireContentDragReorder(list, reorderBase, () => loadContentList(division, base, reorderBase));
  } catch (e) {
    list.innerHTML = emptyState('Could not load content: ' + e.message);
  }
}

// Only cards with placement "extra" are draggable; built-in sections keep their fixed spot.
function wireContentDragReorder(list, reorderBase, onReordered) {
  let draggedId = null;

  list.querySelectorAll('.manage-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedId = card.dataset.contentId;
      card.style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => { card.style.opacity = ''; });
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetId = card.dataset.contentId;
      if (!draggedId || draggedId === targetId) return;

      // Reorder only within the "extra" subset — built-in sections stay put.
      const extraCards = Array.from(list.querySelectorAll('.manage-card[data-placement="extra"]'));
      const ids = extraCards.map((c) => c.dataset.contentId);
      const fromIdx = ids.indexOf(draggedId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);

      try {
        await api.put(reorderBase, { order: ids });
        showToast('Order updated.');
        onReordered();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function openContentForm(division, base, reorderBase) {
  openAdminModal(`
    <form class="admin-modal-form" id="contentForm">
      <h3>Add new section</h3>
      <div>
        <label class="admin-label">Image</label>
        <div style="display:flex;align-items:center;gap:14px;">
          <div id="contentImagePreview" style="width:80px;height:60px;border:1.5px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;flex-shrink:0;">
            <span class="icon" style="color:var(--stone);">${icon('image')}</span>
          </div>
          <label class="btn btn-ghost" style="padding:9px 14px;font-size:13px;cursor:pointer;">
            ${icon('upload')} Choose file
            <input type="file" accept="image/*" class="sr-only" id="contentImageInput" />
          </label>
        </div>
        <input type="hidden" id="contentImageUrl" value="" />
      </div>
      <div>
        <label class="admin-label">Title</label>
        <input class="admin-input" id="contentTitle" required placeholder="e.g. Why Families Choose Us" />
      </div>
      <div>
        <label class="admin-label">Body</label>
        <textarea class="admin-textarea" id="contentBody" style="min-height:110px;" placeholder="Section copy..."></textarea>
      </div>
      <button type="submit" class="btn btn-save">Add section</button>
    </form>
  `);

  document.getElementById('contentImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // New sections don't have an id yet — use the upload-logo-style generic
      // content image endpoint isn't id-scoped for creation, so we stage the
      // file and upload it once the section exists (after creation), OR if
      // the backend supports a pre-id upload we could use it directly. Here
      // we simply preview locally and upload right after creation succeeds.
      const preview = document.getElementById('contentImagePreview');
      preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:100%;max-height:100%;object-fit:cover;" />`;
      document.getElementById('contentImageInput').dataset.pendingFile = 'true';
      window.__pendingContentImageFile = file;
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('contentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('contentTitle').value.trim();
    const body = document.getElementById('contentBody').value.trim();
    if (!title) return;

    try {
      const created = await api.post(base, { title, body });

      if (window.__pendingContentImageFile) {
        const { url } = await api.upload(`${base}/${created.id}/image`, window.__pendingContentImageFile);
        await api.put(`${base}/${created.id}`, { image_url: url });
        window.__pendingContentImageFile = null;
      }

      showToast('Section added — it will now show on the public homepage.');
      closeAdminModal();
      loadContentList(division, base, reorderBase);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------
// LV / SH SHARED: PARTNERS (logo slider management)
// ---------------------------------------------------------
async function renderPartners(division) {
  const base = division === 'lakeview' ? '/api/admin/lakeview/partners' : '/api/admin/hospital/partners';
  const uploadBase = division === 'lakeview' ? '/api/admin/lakeview/partners/upload-logo' : '/api/admin/hospital/partners/upload-logo';
  const reorderBase = division === 'lakeview' ? '/api/admin/lakeview/partners-reorder' : '/api/admin/hospital/partners-reorder';

  adminMain.innerHTML = topbar('Partners') + `
    <div class="panel">
      <div class="panel__head">
        <h2>Partner &amp; client logos</h2>
        <button class="btn btn-save" id="addPartnerBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} Add partner</button>
      </div>
      <p style="padding:16px 22px 0;color:var(--stone);font-size:13px;">Drag cards to reorder — order here matches the order in the slider on the public site.</p>
      <div class="manage-grid" id="partnersManageGrid"><div class="skeleton" style="height:160px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('addPartnerBtn').addEventListener('click', () => openPartnerForm(division, base, uploadBase, reorderBase));
  loadPartnersManage(division, base, uploadBase, reorderBase);
}

async function loadPartnersManage(division, base, uploadBase, reorderBase) {
  const grid = document.getElementById('partnersManageGrid');
  try {
    const partners = await api.get(base);
    if (!partners.length) {
      grid.innerHTML = emptyState('No partners yet. Add your first logo.', 'layers');
      return;
    }
    grid.innerHTML = partners.map((p) => `
      <div class="manage-card" data-partner-id="${p.id}" draggable="true">
        <div class="manage-card__media" style="background:#fff;display:flex;align-items:center;justify-content:center;padding:18px;">
          <img src="${p.logo_url}" alt="${p.name}" style="max-height:60px;width:auto;object-fit:contain;" />
          <label class="manage-card__upload-overlay">
            <span class="icon">${icon('upload')}</span>
            <input type="file" accept="image/*" class="sr-only" data-action="upload-partner-logo" data-partner-id="${p.id}" />
          </label>
        </div>
        <div class="manage-card__body">
          <div class="manage-card__title">${p.name}</div>
          <div class="manage-card__meta">${p.website_url || 'No website link'}</div>
          <div class="manage-card__footer">
            <span class="toggle-pill ${p.is_active ? 'on' : 'off'}">${p.is_active ? 'Visible' : 'Hidden'}</span>
            <div class="row-actions">
              <button class="icon-btn" data-action="edit-partner" data-partner-id="${p.id}" title="Edit"><span class="icon">${icon('edit')}</span></button>
              <button class="icon-btn danger" data-action="delete-partner" data-partner-id="${p.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action="edit-partner"]').forEach((btn) => {
      btn.addEventListener('click', () => openPartnerForm(division, base, uploadBase, reorderBase, partners.find((p) => p.id === btn.dataset.partnerId)));
    });
    grid.querySelectorAll('[data-action="delete-partner"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This logo will be removed from the public slider.', async () => {
          await api.del(`${base}/${btn.dataset.partnerId}`);
          showToast('Partner removed.');
          loadPartnersManage(division, base, uploadBase, reorderBase);
        });
      });
    });
    grid.querySelectorAll('[data-action="upload-partner-logo"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await api.upload(uploadBase, file);
          await api.put(`${base}/${input.dataset.partnerId}`, { logo_url: url });
          showToast('Logo updated.');
          loadPartnersManage(division, base, uploadBase, reorderBase);
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });

    wirePartnerDragReorder(grid, reorderBase, () => loadPartnersManage(division, base, uploadBase, reorderBase));
  } catch (e) {
    grid.innerHTML = emptyState('Could not load partners: ' + e.message);
  }
}

// Simple HTML5 drag-and-drop reordering: drop a card before/after another,
// then persist the new order in one batched API call.
function wirePartnerDragReorder(grid, reorderBase, onReordered) {
  let draggedId = null;

  grid.querySelectorAll('.manage-card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedId = card.dataset.partnerId;
      card.style.opacity = '0.4';
    });
    card.addEventListener('dragend', () => { card.style.opacity = ''; });
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetId = card.dataset.partnerId;
      if (!draggedId || draggedId === targetId) return;

      const cards = Array.from(grid.querySelectorAll('.manage-card[draggable="true"]'));
      const ids = cards.map((c) => c.dataset.partnerId);
      const fromIdx = ids.indexOf(draggedId);
      const toIdx = ids.indexOf(targetId);
      ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);

      try {
        await api.put(reorderBase, { order: ids });
        showToast('Order updated.');
        onReordered();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function openPartnerForm(division, base, uploadBase, reorderBase, partner = null) {
  const isEdit = !!partner;
  openAdminModal(`
    <form class="admin-modal-form" id="partnerForm">
      <h3>${isEdit ? 'Edit partner' : 'Add partner'}</h3>
      <div>
        <label class="admin-label">Logo</label>
        <div style="display:flex;align-items:center;gap:14px;">
          <div id="partnerLogoPreview" style="width:80px;height:50px;border:1.5px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;flex-shrink:0;">
            ${partner?.logo_url ? `<img src="${partner.logo_url}" style="max-width:100%;max-height:100%;object-fit:contain;" />` : `<span class="icon" style="color:var(--stone);">${icon('image')}</span>`}
          </div>
          <label class="btn btn-ghost" style="padding:9px 14px;font-size:13px;cursor:pointer;">
            ${icon('upload')} Choose file
            <input type="file" accept="image/*" class="sr-only" id="partnerLogoInput" />
          </label>
        </div>
        <input type="hidden" id="partnerLogoUrl" value="${partner?.logo_url || ''}" />
      </div>
      <div>
        <label class="admin-label">Company name</label>
        <input class="admin-input" id="partnerName" required value="${partner?.name || ''}" placeholder="e.g. GTBank" />
      </div>
      <div>
        <label class="admin-label">Website (optional)</label>
        <input class="admin-input" id="partnerWebsite" value="${partner?.website_url || ''}" placeholder="https://..." />
      </div>
      <label class="checkbox-row"><input type="checkbox" id="partnerActive" ${partner?.is_active !== false ? 'checked' : ''} /> Visible in the public slider</label>
      <button type="submit" class="btn btn-save" id="partnerSubmitBtn">${isEdit ? 'Save changes' : 'Add partner'}</button>
    </form>
  `);

  document.getElementById('partnerLogoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('partnerLogoPreview');
    preview.innerHTML = `<div class="skeleton" style="width:100%;height:100%;"></div>`;
    try {
      const { url } = await api.upload(uploadBase, file);
      document.getElementById('partnerLogoUrl').value = url;
      preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;" />`;
    } catch (err) {
      showToast(err.message, 'error');
      preview.innerHTML = `<span class="icon" style="color:var(--stone);">${icon('image')}</span>`;
    }
  });

  document.getElementById('partnerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const logoUrl = document.getElementById('partnerLogoUrl').value;
    if (!logoUrl) {
      showToast('Please upload a logo image first.', 'error');
      return;
    }
    const payload = {
      name: document.getElementById('partnerName').value,
      logo_url: logoUrl,
      website_url: document.getElementById('partnerWebsite').value || null,
      is_active: document.getElementById('partnerActive').checked,
    };

    try {
      if (isEdit) {
        await api.put(`${base}/${partner.id}`, payload);
        showToast('Partner updated.');
      } else {
        await api.post(base, payload);
        showToast('Partner added.');
      }
      closeAdminModal();
      loadPartnersManage(division, base, uploadBase, reorderBase);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
