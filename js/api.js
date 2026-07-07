// public/js/api.js
// Tiny fetch wrapper shared by every page. Keeps error handling and JSON
// parsing in one place instead of repeating try/catch everywhere.

const api = {
  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch((window.API_BASE_URL || '') + url, opts);
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },

  async upload(url, file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch((window.API_BASE_URL || '') + url, { method: 'POST', body: formData, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data;
  },
};

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.innerHTML = `${icon(type === 'error' ? 'alertCircle' : 'checkCircle')}<span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

function formatMoney(amount, currency = 'NGN') {
  const symbols = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const symbol = symbols[currency] || currency + ' ';
  return symbol + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  return new Date(dateStr + (dateStr.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime12(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Reveal-on-scroll for the ledger-line signature element
function initLedgerObserver() {
  const targets = document.querySelectorAll('.ledger');
  if (!targets.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('in-view');
      });
    },
    { threshold: 0.4 }
  );
  targets.forEach((t) => obs.observe(t));
}
document.addEventListener('DOMContentLoaded', initLedgerObserver);
