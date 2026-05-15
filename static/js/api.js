const BASE = '';

function getAuthHeader() {
  const c = localStorage.getItem('finanzas_auth');
  return c ? { 'Authorization': 'Basic ' + c } : {};
}

function manejar401() {
  localStorage.removeItem('finanzas_auth');
  window.location.href = '/static/login.html';
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: getAuthHeader() });
  if (res.status === 401) { manejar401(); return; }
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body)
  });
  if (res.status === 401) { manejar401(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(_extraerError(data, 'Error en la operación'));
  return data;
}

async function patch(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body)
  });
  if (res.status === 401) { manejar401(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(_extraerError(data, 'Error en la operación'));
  return data;
}

async function del(path) {
  const res = await fetch(BASE + path, { method: 'DELETE', headers: getAuthHeader() });
  if (res.status === 401) { manejar401(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(_extraerError(data, 'No se pudo completar la operación'));
  return data;
}

function _extraerError(data, fallback) {
  if (!data.detail) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map(e => e.msg || JSON.stringify(e)).join('. ');
  }
  return fallback;
}

function fmt(monto) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN'
  }).format(monto);
}

function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
