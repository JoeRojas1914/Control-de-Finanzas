const _ICONS = {
  dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  cuentas:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  historial: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  reportes:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  config:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  moon:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  logout:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  logo:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};

function aplicarTema() {
  const oscuro = localStorage.getItem('tema') === 'obscuro';
  document.documentElement.classList.toggle('dark', oscuro);
  const btn = document.getElementById('btn-tema');
  if (btn) {
    btn.innerHTML = oscuro
      ? `${_ICONS.sun} Modo claro`
      : `${_ICONS.moon} Modo oscuro`;
  }
}

function toggleTema() {
  const oscuro = localStorage.getItem('tema') === 'obscuro';
  localStorage.setItem('tema', oscuro ? 'claro' : 'obscuro');
  aplicarTema();
}

function cerrarSesion() {
  localStorage.removeItem('finanzas_auth');
  localStorage.removeItem('finanzas_perfil');
  window.location.href = '/static/login.html';
}

function _iniciales(nombre, apellido, username) {
  if (nombre && apellido) return (nombre[0] + apellido[0]).toUpperCase();
  if (nombre) return nombre[0].toUpperCase();
  return username ? username[0].toUpperCase() : '?';
}

function _actualizarAvatar(perfil) {
  const avEl   = document.getElementById('nav-avatar');
  const nameEl = document.getElementById('nav-nombre');
  if (!avEl) return;
  avEl.textContent       = _iniciales(perfil.nombre, perfil.apellido, perfil.username);
  avEl.style.background  = perfil.avatar_color || '#6366f1';
  if (nameEl) {
    nameEl.textContent = perfil.nombre
      ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ')
      : perfil.username;
  }
}

async function _cargarPerfil() {
  try {
    const perfil = await get('/api/auth/me');
    if (!perfil) return;
    localStorage.setItem('finanzas_perfil', JSON.stringify(perfil));
    _actualizarAvatar(perfil);
  } catch {}
}

function cargarNavbar() {
  const pagina  = window.location.pathname.split('/').pop();
  const oscuro  = localStorage.getItem('tema') === 'obscuro';
  const hayAuth = !!localStorage.getItem('finanzas_auth');
  const cache   = localStorage.getItem('finanzas_perfil');
  const perfil  = cache ? JSON.parse(cache) : null;

  const iniciales = perfil ? _iniciales(perfil.nombre, perfil.apellido, perfil.username) : '?';
  const color     = perfil?.avatar_color || '#6366f1';
  const nombre    = perfil
    ? (perfil.nombre ? [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') : perfil.username)
    : '—';

  const links = [
    { href: 'reportes.html',      label: 'Dashboard',     icon: _ICONS.dashboard },
    { href: 'cuentas.html',       label: 'Cuentas',       icon: _ICONS.cuentas   },
    { href: 'historial.html',     label: 'Historial',     icon: _ICONS.historial  },
    { href: 'configuracion.html', label: 'Configuración', icon: _ICONS.config     },
  ];

  const nav = document.getElementById('navbar');
  nav.innerHTML = `
    <div class="nav-logo">
      <div class="nav-logo-icon">${_ICONS.logo}</div>
      FINANZAS
    </div>

    <div class="nav-links">
      ${links.map(l => `
        <a href="/static/${l.href}" class="nav-link ${pagina === l.href ? 'active' : ''}">
          ${l.icon}
          ${l.label}
        </a>
      `).join('')}
    </div>

    <div class="nav-footer">
      ${hayAuth ? `
        <a href="/static/perfil.html" class="nav-user-btn ${pagina === 'perfil.html' ? 'nav-user-btn--active' : ''}">
          <div class="nav-avatar-sm" id="nav-avatar" style="background:${color}">${iniciales}</div>
          <div class="nav-user-info">
            <span class="nav-user-name" id="nav-nombre">${nombre}</span>
            <span class="nav-user-sub">Mi perfil</span>
          </div>
        </a>
      ` : ''}
      <button class="dark-toggle" id="btn-tema" onclick="toggleTema()">
        ${oscuro ? `${_ICONS.sun} Modo claro` : `${_ICONS.moon} Modo oscuro`}
      </button>
      ${hayAuth ? `
        <button class="dark-toggle" style="color:rgba(239,68,68,0.75)" onclick="cerrarSesion()">
          ${_ICONS.logout} Cerrar sesión
        </button>
      ` : ''}
    </div>
  `;

  aplicarTema();
  if (hayAuth) _cargarPerfil();
}

cargarNavbar();
