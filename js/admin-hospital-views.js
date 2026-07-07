// public/js/admin-hospital-views.js
// Appended to admin.js logic. Handles all Hospital-side admin views.

// ---------------------------------------------------------
// SH APPOINTMENTS
// ---------------------------------------------------------
async function renderShAppointments() {
  adminMain.innerHTML = topbar('Appointments') + `
    <div class="panel">
      <div class="panel__head">
        <h2>All appointments</h2>
        <select class="status-select" id="apptStatusFilter">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div id="apptsTableWrap"><div class="skeleton" style="height:280px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('apptStatusFilter').addEventListener('change', (e) => loadAppointments(e.target.value));
  loadAppointments();
}

async function loadAppointments(status = '') {
  const wrap = document.getElementById('apptsTableWrap');
  try {
    const url = status ? `/api/admin/hospital/appointments?status=${status}` : '/api/admin/hospital/appointments';
    const appts = await api.get(url);
    if (!appts.length) {
      wrap.innerHTML = emptyState('No appointments yet.', 'clock');
      return;
    }
    wrap.innerHTML = `
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th>Patient</th><th>Doctor</th><th>Date &amp; time</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${appts.map((a) => `
            <tr>
              <td><strong>${a.patient_name}</strong><br/><span style="color:var(--stone);font-size:12.5px;">${a.patient_email}</span></td>
              <td>${a.doctors?.full_name || '—'}<br/><span style="color:var(--stone);font-size:12px;">${a.doctors?.title || ''}</span></td>
              <td>${formatDate(a.appointment_date)} &middot; ${formatTime12(a.appointment_time.slice(0,5))}</td>
              <td>
                <select class="status-select" data-appt-id="${a.id}" data-action="status">
                  ${['pending','confirmed','completed','cancelled'].map((s) => `<option value="${s}" ${s === a.status ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                </select>
              </td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn danger" data-action="delete" data-appt-id="${a.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    `;

    wrap.querySelectorAll('[data-action="status"]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api.put(`/api/admin/hospital/appointments/${sel.dataset.apptId}`, { status: sel.value });
          showToast('Appointment status updated.');
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
    wrap.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This appointment will be permanently removed.', async () => {
          await api.del(`/api/admin/hospital/appointments/${btn.dataset.apptId}`);
          showToast('Appointment deleted.');
          loadAppointments(document.getElementById('apptStatusFilter').value);
        });
      });
    });
  } catch (e) {
    wrap.innerHTML = emptyState('Could not load appointments: ' + e.message);
  }
}

// ---------------------------------------------------------
// SH DOCTORS
// ---------------------------------------------------------
let departmentsForDoctorForm = [];

async function renderShDoctors() {
  adminMain.innerHTML = topbar('Doctors') + `
    <div class="panel">
      <div class="panel__head">
        <h2>All doctors</h2>
        <button class="btn btn-save" id="addDoctorBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} Add doctor</button>
      </div>
      <div class="manage-grid" id="doctorsManageGrid"><div class="skeleton" style="height:240px;"></div></div>
    </div>
  `;
  wireTopbarBell();

  try {
    departmentsForDoctorForm = await api.get('/api/admin/hospital/departments');
  } catch (e) { departmentsForDoctorForm = []; }

  document.getElementById('addDoctorBtn').addEventListener('click', () => openDoctorForm());
  loadDoctorsManage();
}

async function loadDoctorsManage() {
  const grid = document.getElementById('doctorsManageGrid');
  try {
    const doctors = await api.get('/api/admin/hospital/doctors');
    if (!doctors.length) {
      grid.innerHTML = emptyState('No doctors yet. Add your first doctor.', 'doctor');
      return;
    }
    grid.innerHTML = doctors.map((d) => `
      <div class="manage-card" data-doctor-id="${d.id}">
        <div class="manage-card__media">
          <img src="${d.photo_url || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=600'}" alt="${d.full_name}" />
          <label class="manage-card__upload-overlay">
            <span class="icon">${icon('upload')}</span>
            <input type="file" accept="image/*" class="sr-only" data-action="upload-doctor-image" data-doctor-id="${d.id}" />
          </label>
        </div>
        <div class="manage-card__body">
          <div class="manage-card__title">${d.full_name}</div>
          <div class="manage-card__meta">${d.title}${d.departments?.name ? ' &middot; ' + d.departments.name : ''}</div>
          <div class="manage-card__footer">
            <span class="toggle-pill ${d.is_active ? 'on' : 'off'}">${d.is_active ? 'Active' : 'Hidden'}</span>
            <div class="row-actions">
              <button class="icon-btn" data-action="edit-doctor" data-doctor-id="${d.id}" title="Edit"><span class="icon">${icon('edit')}</span></button>
              <button class="icon-btn danger" data-action="delete-doctor" data-doctor-id="${d.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action="edit-doctor"]').forEach((btn) => {
      btn.addEventListener('click', () => openDoctorForm(doctors.find((d) => d.id === btn.dataset.doctorId)));
    });
    grid.querySelectorAll('[data-action="delete-doctor"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('This doctor profile will be removed. Existing appointments remain on record.', async () => {
          await api.del(`/api/admin/hospital/doctors/${btn.dataset.doctorId}`);
          showToast('Doctor deleted.');
          loadDoctorsManage();
        });
      });
    });
    grid.querySelectorAll('[data-action="upload-doctor-image"]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await api.upload(`/api/admin/hospital/doctors/${input.dataset.doctorId}/image`, file);
          await api.put(`/api/admin/hospital/doctors/${input.dataset.doctorId}`, { photo_url: url });
          showToast('Photo updated.');
          loadDoctorsManage();
        } catch (e) {
          showToast(e.message, 'error');
        }
      });
    });
  } catch (e) {
    grid.innerHTML = emptyState('Could not load doctors: ' + e.message);
  }
}

const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function openDoctorForm(doctor = null) {
  const isEdit = !!doctor;
  const selectedDays = doctor?.days_available || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  openAdminModal(`
    <form class="admin-modal-form" id="doctorForm">
      <h3>${isEdit ? 'Edit doctor' : 'Add doctor'}</h3>
      <div>
        <label class="admin-label">Full name</label>
        <input class="admin-input" id="doctorName" required value="${doctor?.full_name || ''}" placeholder="Dr Jane Doe" />
      </div>
      <div>
        <label class="admin-label">Title / specialty</label>
        <input class="admin-input" id="doctorTitle" required value="${doctor?.title || ''}" placeholder="Consultant Gynaecologist" />
      </div>
      <div>
        <label class="admin-label">Department</label>
        <select class="admin-input" id="doctorDept">
          <option value="">— None —</option>
          ${departmentsForDoctorForm.map((d) => `<option value="${d.id}" ${doctor?.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="admin-label">Short bio</label>
        <textarea class="admin-textarea" id="doctorBio" style="min-height:80px;">${doctor?.bio || ''}</textarea>
      </div>
      <div>
        <label class="admin-label">Days available</label>
        <div class="day-toggle-row" id="dayToggleRow">
          ${ALL_DAYS.map((d) => `<button type="button" class="day-toggle ${selectedDays.includes(d) ? 'selected' : ''}" data-day="${d}">${d}</button>`).join('')}
        </div>
      </div>
      <div class="field-grid--3">
        <div>
          <label class="admin-label">Start hour (24h)</label>
          <input class="admin-input" type="number" id="doctorStartHour" min="0" max="23" value="${doctor?.start_hour ?? 9}" />
        </div>
        <div>
          <label class="admin-label">End hour (24h)</label>
          <input class="admin-input" type="number" id="doctorEndHour" min="0" max="23" value="${doctor?.end_hour ?? 16}" />
        </div>
        <div>
          <label class="admin-label">Slot length (min)</label>
          <input class="admin-input" type="number" id="doctorSlotMin" min="10" step="5" value="${doctor?.slot_minutes ?? 30}" />
        </div>
      </div>
      <div>
        <label class="admin-label">Photo URL (or upload after saving)</label>
        <input class="admin-input" id="doctorPhotoUrl" value="${doctor?.photo_url || ''}" />
      </div>
      <label class="checkbox-row"><input type="checkbox" id="doctorActive" ${doctor?.is_active !== false ? 'checked' : ''} /> Visible on the public site</label>
      <button type="submit" class="btn btn-save">${isEdit ? 'Save changes' : 'Add doctor'}</button>
    </form>
  `);

  const dayRow = document.getElementById('dayToggleRow');
  dayRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.day-toggle');
    if (btn) btn.classList.toggle('selected');
  });

  document.getElementById('doctorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const days = Array.from(dayRow.querySelectorAll('.day-toggle.selected')).map((b) => b.dataset.day);
    const payload = {
      full_name: document.getElementById('doctorName').value,
      title: document.getElementById('doctorTitle').value,
      department_id: document.getElementById('doctorDept').value || null,
      bio: document.getElementById('doctorBio').value,
      days_available: days,
      start_hour: Number(document.getElementById('doctorStartHour').value),
      end_hour: Number(document.getElementById('doctorEndHour').value),
      slot_minutes: Number(document.getElementById('doctorSlotMin').value),
      photo_url: document.getElementById('doctorPhotoUrl').value || null,
      is_active: document.getElementById('doctorActive').checked,
    };

    try {
      if (isEdit) {
        await api.put(`/api/admin/hospital/doctors/${doctor.id}`, payload);
        showToast('Doctor updated.');
      } else {
        await api.post('/api/admin/hospital/doctors', payload);
        showToast('Doctor added.');
      }
      closeAdminModal();
      loadDoctorsManage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------
// SH DEPARTMENTS
// ---------------------------------------------------------
const DEPT_ICON_OPTIONS = ['pulse', 'heart', 'baby', 'scalpel', 'droplet', 'ear', 'skin', 'scan', 'activity', 'monitor', 'shield', 'building'];

async function renderShDepartments() {
  adminMain.innerHTML = topbar('Departments') + `
    <div class="panel">
      <div class="panel__head">
        <h2>All departments</h2>
        <button class="btn btn-save" id="addDeptBtn" style="padding:9px 16px;font-size:13.5px;">${icon('plus')} Add department</button>
      </div>
      <div id="deptTableWrap"><div class="skeleton" style="height:240px;"></div></div>
    </div>
  `;
  wireTopbarBell();
  document.getElementById('addDeptBtn').addEventListener('click', () => openDeptForm());
  loadDeptsManage();
}

async function loadDeptsManage() {
  const wrap = document.getElementById('deptTableWrap');
  try {
    const depts = await api.get('/api/admin/hospital/departments');
    if (!depts.length) {
      wrap.innerHTML = emptyState('No departments yet.', 'pulse');
      return;
    }
    wrap.innerHTML = `
      <div class="table-scroll"><table class="data-table">
        <thead><tr><th></th><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${depts.map((d) => `
            <tr>
              <td><span class="icon" style="color:var(--sh-primary);">${icon(d.icon_key || 'pulse')}</span></td>
              <td><strong>${d.name}</strong></td>
              <td style="color:var(--ink-soft);font-size:13.5px;">${d.description || ''}</td>
              <td><span class="toggle-pill ${d.is_active ? 'on' : 'off'}">${d.is_active ? 'Active' : 'Hidden'}</span></td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn" data-action="edit-dept" data-dept-id="${d.id}" title="Edit"><span class="icon">${icon('edit')}</span></button>
                  <button class="icon-btn danger" data-action="delete-dept" data-dept-id="${d.id}" title="Delete"><span class="icon">${icon('trash')}</span></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    `;

    wrap.querySelectorAll('[data-action="edit-dept"]').forEach((btn) => {
      btn.addEventListener('click', () => openDeptForm(depts.find((d) => d.id === btn.dataset.deptId)));
    });
    wrap.querySelectorAll('[data-action="delete-dept"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        confirmDelete('Doctors in this department will be unassigned, not deleted.', async () => {
          await api.del(`/api/admin/hospital/departments/${btn.dataset.deptId}`);
          showToast('Department deleted.');
          loadDeptsManage();
        });
      });
    });
  } catch (e) {
    wrap.innerHTML = emptyState('Could not load departments: ' + e.message);
  }
}

function openDeptForm(dept = null) {
  const isEdit = !!dept;
  openAdminModal(`
    <form class="admin-modal-form" id="deptForm">
      <h3>${isEdit ? 'Edit department' : 'Add department'}</h3>
      <div>
        <label class="admin-label">Name</label>
        <input class="admin-input" id="deptName" required value="${dept?.name || ''}" />
      </div>
      <div>
        <label class="admin-label">Description</label>
        <textarea class="admin-textarea" id="deptDescription" style="min-height:70px;">${dept?.description || ''}</textarea>
      </div>
      <div>
        <label class="admin-label">Icon</label>
        <select class="admin-input" id="deptIcon">
          ${DEPT_ICON_OPTIONS.map((k) => `<option value="${k}" ${dept?.icon_key === k ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="admin-label">Sort order</label>
        <input class="admin-input" type="number" id="deptSort" value="${dept?.sort_order ?? 0}" />
      </div>
      <label class="checkbox-row"><input type="checkbox" id="deptActive" ${dept?.is_active !== false ? 'checked' : ''} /> Visible on the public site</label>
      <button type="submit" class="btn btn-save">${isEdit ? 'Save changes' : 'Create department'}</button>
    </form>
  `);

  document.getElementById('deptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('deptName').value,
      description: document.getElementById('deptDescription').value,
      icon_key: document.getElementById('deptIcon').value,
      sort_order: Number(document.getElementById('deptSort').value) || 0,
      is_active: document.getElementById('deptActive').checked,
    };
    try {
      if (isEdit) {
        await api.put(`/api/admin/hospital/departments/${dept.id}`, payload);
        showToast('Department updated.');
      } else {
        await api.post('/api/admin/hospital/departments', payload);
        showToast('Department created.');
      }
      closeAdminModal();
      loadDeptsManage();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---------------------------------------------------------
// BOOT — runs after every view renderer in all three admin JS files is defined
// ---------------------------------------------------------
checkSession();
