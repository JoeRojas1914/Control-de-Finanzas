function aplicarTema() {
  const oscuro = localStorage.getItem('tema') === 'obscuro';
  document.documentElement.classList.toggle('dark', oscuro);
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = oscuro ? 'Claro' : 'Obscuro';
}

function toggleTema() {
  const oscuro = localStorage.getItem('tema') === 'obscuro';
  localStorage.setItem('tema', oscuro ? 'claro' : 'obscuro');
  aplicarTema();
}

function cargarNavbar() {
  const pagina = window.location.pathname.split('/').pop();

  const links = [
    { href: 'index.html',         label: 'Dashboard'     },
    { href: 'cuentas.html',       label: 'Cuentas'       },
    { href: 'historial.html',     label: 'Historial'     },
    { href: 'reportes.html',      label: 'Reportes'      },
    { href: 'configuracion.html', label: 'Configuración' },
  ];

  const nav = document.getElementById('navbar');
  nav.innerHTML = `
    <span class="nav-logo">FINANZAS</span>
    <div class="nav-links">
      ${links.map(l => `
        <a href="/static/${l.href}"
           class="nav-link ${pagina === l.href ? 'active' : ''}">
          ${l.label}
        </a>
      `).join('')}
    </div>
    <button class="dark-toggle" id="btn-tema" onclick="toggleTema()">Obscuro</button>
  `;

  aplicarTema();
}

cargarNavbar();