// public/js/config.js
// Loaded before api.js on every page. Defines where the backend API lives.
//
// Locally (localhost/127.0.0.1) this stays empty, so requests go to the same
// origin your dev server is running on — no change needed for local dev.
//
// Once deployed, replace the placeholder below with your actual Render
// backend URL (e.g. "https://sterling-group-api.onrender.com") and redeploy
// the frontend. No trailing slash.
window.API_BASE_URL = (function () {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (isLocal) return '';
  return 'https://sterling-group-backend.onrender.com';
})();
