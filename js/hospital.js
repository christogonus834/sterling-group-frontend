// public/js/hospital.js
document.getElementById('year').textContent = new Date().getFullYear();
loadBranding('hospital');

const departmentsGrid = document.getElementById('departmentsGrid');
const doctorsGrid = document.getElementById('doctorsGrid');
const doctorsDots = document.getElementById('doctorsDots');
const doctorsSlider = document.getElementById('doctorsSlider');
const doctorsFilterNote = document.getElementById('doctorsFilterNote');
const postsGrid = document.getElementById('postsGrid');
const apptModal = document.getElementById('apptModal');
const apptModalContent = document.getElementById('apptModalContent');

let departmentsCache = [];
let doctorsCache = [];
let activeDepartmentId = null;
const DOCTORS_PER_SLIDE = 3;
let doctorsSlideIndex = 0;
let doctorsSlideCount = 0;
let doctorsAutoAdvanceTimer = null;

const TRUST_ICONS = ['shield', 'pulse', 'scan', 'building'];
['trustIcon1', 'trustIcon2', 'trustIcon3', 'trustIcon4'].forEach((id, i) => {
  document.getElementById(id).innerHTML = ICONS[TRUST_ICONS[i]];
});

const STAT_ICONS = ['users', 'calendar', 'activity', 'heart'];
['statIcon1', 'statIcon2', 'statIcon3', 'statIcon4'].forEach((id, i) => {
  document.getElementById(id).innerHTML = ICONS[STAT_ICONS[i]];
});

const STEP_ICONS = ['calendar', 'doctor', 'checkCircle', 'activity'];
['stepIcon1', 'stepIcon2', 'stepIcon3', 'stepIcon4'].forEach((id, i) => {
  document.getElementById(id).innerHTML = ICONS[STEP_ICONS[i]];
});

document.getElementById('newsletterIcon').innerHTML = ICONS.mail;

// FAQ accordion
document.querySelectorAll('[data-faq-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const answer = item.querySelector('.faq-item__a');
    const isOpen = item.classList.contains('open');
    // Close any other open item for a cleaner single-open accordion
    document.querySelectorAll('.faq-item.open').forEach((openItem) => {
      if (openItem !== item) {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-item__a').style.maxHeight = null;
      }
    });
    item.classList.toggle('open', !isOpen);
    answer.style.maxHeight = !isOpen ? `${answer.scrollHeight}px` : null;
  });
});

// Newsletter form — front-end only for now, no backend list exists yet
document.getElementById('newsletterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  showToast('Thanks for subscribing — you\'ll hear from us soon.');
  e.target.reset();
});

function deptCardHtml(dept) {
  return `
    <button class="dept-card ${dept.id === activeDepartmentId ? 'active' : ''}" data-dept-id="${dept.id}">
      <span class="icon">${icon(dept.icon_key || 'pulse')}</span>
      <span class="dept-card__name">${dept.name}</span>
      <span class="dept-card__desc">${dept.description || ''}</span>
    </button>
  `;
}

function doctorCardHtml(doc) {
  const days = (doc.days_available || []).map((d) => `<span class="day-chip">${d}</span>`).join('');
  return `
    <article class="doctor-card" data-doctor-id="${doc.id}">
      <div class="doctor-card__media">
        <img src="${doc.photo_url || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=600'}" alt="${doc.full_name}" loading="lazy" />
      </div>
      <div class="doctor-card__body">
        <h3 class="doctor-card__name">${doc.full_name}</h3>
        <p class="doctor-card__title">${doc.title}</p>
        ${doc.departments?.name ? `<p class="doctor-card__dept">${doc.departments.name}</p>` : ''}
        <div class="doctor-card__days">${days}</div>
        <button class="btn btn-book-doctor" data-doctor-id="${doc.id}">Book appointment</button>
      </div>
    </article>
  `;
}

async function loadDepartments() {
  departmentsGrid.innerHTML = Array.from({ length: 5 }).map(() => `<div class="skeleton" style="height:120px;"></div>`).join('');
  try {
    departmentsCache = await api.get('/api/hospital/departments');
    departmentsGrid.innerHTML = departmentsCache.map(deptCardHtml).join('');
  } catch (e) {
    departmentsGrid.innerHTML = `<p style="color:#8a2e1f;">Could not load departments: ${e.message}</p>`;
  }
}

async function loadDoctors(departmentId = null) {
  stopDoctorsAutoAdvance();
  doctorsGrid.innerHTML = `
    <div class="doctors-slide">
      ${Array.from({ length: 3 }).map(() => `
        <div class="doctor-card">
          <div class="skeleton" style="aspect-ratio:4/3;"></div>
          <div class="doctor-card__body">
            <div class="skeleton" style="height:18px;width:70%;margin-bottom:8px;"></div>
            <div class="skeleton" style="height:14px;width:50%;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  doctorsDots.innerHTML = '';

  try {
    const url = departmentId ? `/api/hospital/doctors?departmentId=${departmentId}` : '/api/hospital/doctors';
    doctorsCache = await api.get(url);
    doctorsFilterNote.textContent = departmentId
      ? `Showing ${departmentsCache.find((d) => d.id === departmentId)?.name || 'this department'}.`
      : 'Showing all departments.';

    if (!doctorsCache.length) {
      doctorsGrid.innerHTML = `<p style="color:rgba(255,255,255,0.7);padding:20px 4px;">No doctors listed for this department yet.</p>`;
      doctorsDots.innerHTML = '';
      return;
    }
    renderDoctorsSlides(doctorsCache);
  } catch (e) {
    doctorsGrid.innerHTML = `<p style="color:#f2b7a8;padding:20px 4px;">Could not load doctors: ${e.message}</p>`;
  }
}

function renderDoctorsSlides(doctors) {
  const slides = [];
  for (let i = 0; i < doctors.length; i += DOCTORS_PER_SLIDE) {
    slides.push(doctors.slice(i, i + DOCTORS_PER_SLIDE));
  }
  doctorsSlideCount = slides.length;
  doctorsSlideIndex = 0;

  doctorsGrid.innerHTML = slides.map((group) => `
    <div class="doctors-slide">${group.map(doctorCardHtml).join('')}</div>
  `).join('');

  doctorsDots.innerHTML = slides.length > 1
    ? slides.map((_, i) => `<button class="doctors-slider__dot ${i === 0 ? 'active' : ''}" data-slide="${i}" aria-label="Show doctors page ${i + 1}"></button>`).join('')
    : '';

  goToDoctorsSlide(0);
  if (slides.length > 1) startDoctorsAutoAdvance();
}

function goToDoctorsSlide(index) {
  if (!doctorsSlideCount) return;
  doctorsSlideIndex = (index + doctorsSlideCount) % doctorsSlideCount;
  doctorsGrid.style.transform = `translateX(-${doctorsSlideIndex * 100}%)`;
  doctorsDots.querySelectorAll('.doctors-slider__dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === doctorsSlideIndex);
  });
}

function startDoctorsAutoAdvance() {
  stopDoctorsAutoAdvance();
  doctorsAutoAdvanceTimer = setInterval(() => goToDoctorsSlide(doctorsSlideIndex + 1), 6000);
}

function stopDoctorsAutoAdvance() {
  if (doctorsAutoAdvanceTimer) clearInterval(doctorsAutoAdvanceTimer);
  doctorsAutoAdvanceTimer = null;
}

doctorsDots.addEventListener('click', (e) => {
  const dot = e.target.closest('.doctors-slider__dot');
  if (!dot) return;
  goToDoctorsSlide(Number(dot.dataset.slide));
  startDoctorsAutoAdvance(); // reset the 6s timer on manual navigation
});

doctorsSlider.addEventListener('mouseenter', stopDoctorsAutoAdvance);
doctorsSlider.addEventListener('mouseleave', () => { if (doctorsSlideCount > 1) startDoctorsAutoAdvance(); });
doctorsSlider.addEventListener('touchstart', stopDoctorsAutoAdvance, { passive: true });
doctorsSlider.addEventListener('touchend', () => { if (doctorsSlideCount > 1) startDoctorsAutoAdvance(); });

async function loadPosts() {
  try {
    const posts = await api.get('/api/hospital/posts');
    if (!posts.length) {
      postsGrid.closest('section').style.display = 'none';
      return;
    }
    postsGrid.innerHTML = posts.slice(0, 3).map((p) => `
      <article class="post-card">
        <div class="post-card__media"><img src="${p.cover_image_url || 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?q=80&w=800'}" alt="${p.title}" loading="lazy" /></div>
        <div class="post-card__body">
          <p class="post-card__date">${formatDate(p.published_at || p.created_at)}</p>
          <h3 class="post-card__title">${p.title}</h3>
          <p class="post-card__excerpt">${p.excerpt || ''}</p>
        </div>
      </article>
    `).join('');
  } catch (e) {
    postsGrid.closest('section').style.display = 'none';
  }
}

departmentsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.dept-card');
  if (!btn) return;
  const deptId = btn.dataset.deptId;
  activeDepartmentId = activeDepartmentId === deptId ? null : deptId;
  document.querySelectorAll('.dept-card').forEach((c) => c.classList.toggle('active', c.dataset.deptId === activeDepartmentId));
  loadDoctors(activeDepartmentId);
  document.getElementById('doctors').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

doctorsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-book-doctor');
  if (btn) openApptModal(btn.dataset.doctorId);
});

// ---------------- APPOINTMENT MODAL ----------------

function openApptModal(doctorId) {
  const doctor = doctorsCache.find((d) => d.id === doctorId);
  if (!doctor) return;

  apptModalContent.innerHTML = `
    <div class="appt-modal__header">
      <button class="btn-ghost" id="closeApptBtn" style="float:right;padding:6px;border-radius:50%;" aria-label="Close">${icon('close')}</button>
      <h3 class="appt-modal__doctor-name" id="apptModalTitle">${doctor.full_name}</h3>
      <p class="appt-modal__doctor-title">${doctor.title}</p>
    </div>
    <form class="appt-form" id="apptForm">
      <div class="form-field">
        <label for="apptDate">Appointment date</label>
        <input type="date" id="apptDate" required min="${new Date().toISOString().slice(0,10)}" />
      </div>
      <div class="form-field" id="slotsWrapper" style="display:none;">
        <label>Available times</label>
        <div class="slot-grid" id="slotGrid"></div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="patientName">Full name</label>
          <input type="text" id="patientName" required placeholder="Your name" />
        </div>
        <div class="form-field">
          <label for="patientPhone">Phone</label>
          <input type="tel" id="patientPhone" placeholder="+234..." />
        </div>
      </div>
      <div class="form-field">
        <label for="patientEmail">Email</label>
        <input type="email" id="patientEmail" required placeholder="you@example.com" />
      </div>
      <div class="form-field">
        <label for="apptReason">Reason for visit (optional)</label>
        <textarea id="apptReason" placeholder="Briefly describe what you'd like to see the doctor about"></textarea>
      </div>
      <button type="submit" class="btn btn-submit-sh" id="submitApptBtn" disabled>Choose a time to continue</button>
    </form>
  `;

  apptModal.classList.add('open');
  document.getElementById('closeApptBtn').addEventListener('click', closeApptModal);

  const dateInput = document.getElementById('apptDate');
  const slotsWrapper = document.getElementById('slotsWrapper');
  const slotGrid = document.getElementById('slotGrid');
  const submitBtn = document.getElementById('submitApptBtn');
  let selectedTime = null;

  async function loadSlots() {
    const date = dateInput.value;
    if (!date) return;
    selectedTime = null;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Choose a time to continue';
    slotsWrapper.style.display = 'block';
    slotGrid.innerHTML = `<div class="skeleton" style="height:36px;grid-column:1/-1;"></div>`;

    try {
      const result = await api.get(`/api/hospital/slots?doctorId=${doctor.id}&date=${date}`);
      if (!result.slots.length) {
        slotGrid.innerHTML = `<p style="grid-column:1/-1;color:var(--stone);font-size:13px;">${result.note || 'No slots available on this day.'}</p>`;
        return;
      }
      slotGrid.innerHTML = result.slots.map((s) => `
        <button type="button" class="slot-btn" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${formatTime12(s.time)}</button>
      `).join('');
    } catch (e) {
      slotGrid.innerHTML = `<p style="grid-column:1/-1;color:#8a2e1f;font-size:13px;">${e.message}</p>`;
    }
  }

  dateInput.addEventListener('change', loadSlots);

  slotGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.slot-btn');
    if (!btn || btn.disabled) return;
    slotGrid.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTime = btn.dataset.time;
    submitBtn.disabled = false;
    submitBtn.textContent = `Book ${formatTime12(selectedTime)} appointment`;
  });

  document.getElementById('apptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedTime) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending request…';

    try {
      await api.post('/api/hospital/appointments', {
        doctorId: doctor.id,
        departmentId: doctor.department_id,
        patientName: document.getElementById('patientName').value,
        patientEmail: document.getElementById('patientEmail').value,
        patientPhone: document.getElementById('patientPhone').value,
        appointmentDate: dateInput.value,
        appointmentTime: selectedTime,
        reason: document.getElementById('apptReason').value,
      });

      apptModalContent.innerHTML = `
        <div class="modal-success">
          <span class="icon">${icon('checkCircle')}</span>
          <h3>Appointment requested</h3>
          <p>Your request to see <strong>${doctor.full_name}</strong> on ${formatDate(dateInput.value)} at ${formatTime12(selectedTime)} has been received. We'll confirm by email shortly.</p>
          <button class="btn btn-sh" id="closeApptSuccessBtn" style="margin-top:24px;">Done</button>
        </div>
      `;
      document.getElementById('closeApptSuccessBtn').addEventListener('click', closeApptModal);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = `Book ${formatTime12(selectedTime)} appointment`;
    }
  });
}

function closeApptModal() {
  apptModal.classList.remove('open');
}
apptModal.addEventListener('click', (e) => { if (e.target === apptModal) closeApptModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeApptModal(); });

async function loadIntroContent() {
  try {
    const content = await api.get('/api/hospital/content');

    const intro = content.find((c) => c.id === 'hospital_intro');
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
    <section class="section ${i % 2 === 1 ? '' : 'section--tint-sh'}">
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

loadDepartments();
loadDoctors();
loadPosts();
loadIntroContent();