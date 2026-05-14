// ── State ────────────────────────────────────────────────────
let todasCuentas       = [];
let cuentaSeleccionada = null;

// ── Helpers ──────────────────────────────────────────────────

function badgeEstilo(tipo) {
  return tipo === 'credito'
    ? 'background:#1a6edc20;color:#1a6edc'
    : 'background:#0f6e5620;color:#0f6e56';
}

function badgeInitials(nombre) {
  return nombre.slice(0, 2).toUpperCase();
}

function tipoLabel(tipo) {
  return tipo === 'credito' ? 'Crédito' : 'Débito';
}

// ── Left panel ───────────────────────────────────────────────

function renderPanel(cuentas) {
  const contenedor = document.getElementById('lista-panel');
  if (!cuentas.length) {
    contenedor.innerHTML = '<div class="empty-state">No hay cuentas aún</div>';
    return;
  }
  contenedor.innerHTML = cuentas.map(c => {
    const activa     = cuentaSeleccionada && cuentaSeleccionada.id === c.id ? 'activa' : '';
    const esCredito  = c.tipo === 'credito';
    const saldoLabel = esCredito ? fmt(Math.abs(c.saldo)) : fmt(c.saldo);
    return `
      <div class="cuenta-card-mini ${activa}" onclick="seleccionarCuenta(${c.id})">
        <div class="cuenta-badge-mini" style="${badgeEstilo(c.tipo)}">
          ${badgeInitials(c.nombre)}
        </div>
        <div class="cuenta-mini-info">
          <div class="cuenta-mini-nombre">${c.nombre}</div>
          <div class="cuenta-mini-tipo">${tipoLabel(c.tipo)}</div>
        </div>
        <div class="cuenta-mini-saldo">${saldoLabel}</div>
      </div>`;
  }).join('');
}

// ── Account selection ─────────────────────────────────────────

function seleccionarCuenta(id) {
  cuentaSeleccionada = todasCuentas.find(c => c.id === id) || null;
  renderPanel(todasCuentas);
  cargarDetalle();
}

// ── Main data loader ──────────────────────────────────────────

async function cargarCuentas(mantenerSeleccion = false) {
  todasCuentas = await get('/api/cuentas/');
  if (!mantenerSeleccion) {
    cuentaSeleccionada = null;
  } else if (cuentaSeleccionada) {
    cuentaSeleccionada = todasCuentas.find(c => c.id === cuentaSeleccionada.id) || null;
  }
  renderPanel(todasCuentas);
  if (cuentaSeleccionada) cargarDetalle();
  else mostrarPlaceholder();
}

// ── Detail panel ──────────────────────────────────────────────

function mostrarPlaceholder() {
  document.getElementById('detalle-panel').innerHTML =
    '<div class="detalle-placeholder">Selecciona una cuenta para ver su detalle</div>';
}

async function cargarDetalle() {
  if (!cuentaSeleccionada) { mostrarPlaceholder(); return; }
  const c = cuentaSeleccionada;

  const peticiones = [
    get(`/api/transacciones/?cuenta_id=${c.id}&limite=15`),
    c.tipo === 'debito' ? get(`/api/rendimientos/?cuenta_id=${c.id}&limite=15`) : Promise.resolve([]),
    c.tipo === 'debito' ? get(`/api/cuentas/${c.id}/rendimientos`)              : Promise.resolve(null),
  ];

  const [transacciones, rendimientos, resumen] = await Promise.all(peticiones);

  document.getElementById('detalle-panel').innerHTML = c.tipo === 'debito'
    ? renderDetalleDebito(c, resumen, rendimientos, transacciones)
    : renderDetalleCredito(c, transacciones);
}

// ── Detail renderers ──────────────────────────────────────────

function renderHeader(c) {
  return `
    <div class="detalle-header">
      <div class="detalle-badge" style="${badgeEstilo(c.tipo)}">
        ${badgeInitials(c.nombre)}
      </div>
      <div>
        <h1 class="detalle-titulo">${c.nombre}</h1>
        <p class="detalle-subtitulo">${tipoLabel(c.tipo)} · creada ${fmtFecha(c.creada_en)}</p>
      </div>
      <div class="detalle-acciones">
        <button class="btn-sm" onclick="abrirModalEditar()">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarCuenta()">Eliminar</button>
      </div>
    </div>`;
}

function renderDetalleDebito(c, resumen, rendimientos, transacciones) {
  return `
    ${renderHeader(c)}

    <div class="metrics-grid" style="margin-bottom:16px">
      <div class="metric-card">
        <p class="metric-label">Saldo actual</p>
        <p class="metric-value">${fmt(c.saldo)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Rendimiento hoy</p>
        <p class="metric-value green">+${fmt(resumen.diario)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Este mes</p>
        <p class="metric-value green">+${fmt(resumen.mensual)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Rendimiento total</p>
        <p class="metric-value green">+${fmt(resumen.anual)}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h2 class="card-title">Rendimientos recientes</h2>
      ${renderListaRendimientos(rendimientos)}
    </div>

    <div class="card">
      <h2 class="card-title">Movimientos recientes</h2>
      ${renderTablaTransacciones(transacciones)}
    </div>`;
}

function renderDetalleCredito(c, transacciones) {
  const deuda      = Math.abs(c.saldo);
  const limite     = c.limite || 0;
  const disponible = Math.max(0, limite - deuda);
  const inicioMes  = new Date().toISOString().slice(0, 7);
  const gastadoMes = transacciones
    .filter(t => t.fecha.startsWith(inicioMes) && t.monto < 0)
    .reduce((s, t) => s + Math.abs(t.monto), 0);

  return `
    ${renderHeader(c)}

    <div class="metrics-grid" style="margin-bottom:16px">
      <div class="metric-card">
        <p class="metric-label">Deuda actual</p>
        <p class="metric-value red">${fmt(deuda)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Límite</p>
        <p class="metric-value">${fmt(limite)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Disponible</p>
        <p class="metric-value green">${fmt(disponible)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-label">Gastado este mes</p>
        <p class="metric-value red">${fmt(gastadoMes)}</p>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Movimientos recientes</h2>
      ${renderTablaTransacciones(transacciones)}
    </div>`;
}

function renderListaRendimientos(rendimientos) {
  if (!rendimientos.length)
    return '<div class="empty-state">Sin rendimientos registrados</div>';
  return rendimientos.map(r => `
    <div class="rend-row">
      <span class="rend-fecha">${fmtFecha(r.fecha)}</span>
      <span class="rend-monto">+${fmt(r.monto)}</span>
      <div class="rend-btns">
        <button class="btn-sm"
          onclick="abrirModalRend(${r.id}, ${r.monto}, '${r.fecha}')">
          Editar
        </button>
        <button class="btn-sm btn-danger"
          onclick="eliminarRendimiento(${r.id})">
          Eliminar
        </button>
      </div>
    </div>`).join('');
}

function renderTablaTransacciones(transacciones) {
  if (!transacciones.length)
    return '<div class="empty-state">Sin movimientos registrados</div>';
  return `
    <table class="tabla">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Categoría</th>
          <th style="text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${transacciones.map(t => {
          const cat   = t.categoria ? t.categoria.nombre : '—';
          const color = t.monto < 0 ? 'color:#a32d2d' : 'color:#0f6e56';
          const signo = t.monto > 0 ? '+' : '';
          return `
            <tr>
              <td>${fmtFecha(t.fecha)}</td>
              <td>${t.descripcion}</td>
              <td>${cat}</td>
              <td style="text-align:right;${color}">${signo}${fmt(t.monto)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Modal: Nueva cuenta ───────────────────────────────────────

function abrirModalNueva() {
  document.getElementById('modal-nueva').classList.add('abierto');
}

function cerrarModalNueva() {
  document.getElementById('modal-nueva').classList.remove('abierto');
  document.getElementById('nueva-nombre').value = '';
  document.getElementById('nueva-saldo').value  = '';
  document.getElementById('nueva-limite').value = '';
}

document.getElementById('modal-nueva').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalNueva();
});

document.getElementById('nueva-tipo').addEventListener('change', function() {
  document.getElementById('grupo-limite').style.display =
    this.value === 'credito' ? 'block' : 'none';
});

async function agregarCuenta() {
  const nombre = document.getElementById('nueva-nombre').value.trim();
  const tipo   = document.getElementById('nueva-tipo').value;
  const saldo  = parseFloat(document.getElementById('nueva-saldo').value) || 0;
  const limite = parseFloat(document.getElementById('nueva-limite').value) || null;

  if (!nombre) { toast('El nombre de la cuenta es obligatorio', 'err'); return; }

  try {
    const nueva = await post('/api/cuentas/', { nombre, tipo, saldo, limite });
    cerrarModalNueva();
    toast(`Cuenta "${nombre}" creada`, 'ok');
    todasCuentas = await get('/api/cuentas/');
    cuentaSeleccionada = todasCuentas.find(c => c.id === nueva.id) || null;
    renderPanel(todasCuentas);
    cargarDetalle();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Modal: Editar cuenta ──────────────────────────────────────

function abrirModalEditar() {
  if (!cuentaSeleccionada) return;
  const c = cuentaSeleccionada;
  document.getElementById('editar-id').value     = c.id;
  document.getElementById('editar-nombre').value = c.nombre;

  const grupoLimite = document.getElementById('editar-grupo-limite');
  if (c.tipo === 'credito') {
    grupoLimite.style.display = 'block';
    document.getElementById('editar-limite').value = c.limite || 0;
  } else {
    grupoLimite.style.display = 'none';
  }

  document.getElementById('modal-editar').classList.add('abierto');
}

function cerrarModalEditar() {
  document.getElementById('modal-editar').classList.remove('abierto');
}

document.getElementById('modal-editar').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalEditar();
});

async function guardarEdicion() {
  const id     = parseInt(document.getElementById('editar-id').value);
  const nombre = document.getElementById('editar-nombre').value.trim();
  const c      = cuentaSeleccionada;

  if (!nombre) { toast('El nombre no puede estar vacío', 'err'); return; }

  try {
    const promesas = [];
    if (nombre !== c.nombre) {
      promesas.push(patch(`/api/cuentas/${id}/nombre`, { nombre }));
    }
    if (c.tipo === 'credito') {
      const limite = parseFloat(document.getElementById('editar-limite').value) || 0;
      if (limite !== c.limite) {
        promesas.push(patch(`/api/cuentas/${id}/limite`, { limite }));
      }
    }
    if (promesas.length === 0) { cerrarModalEditar(); return; }

    await Promise.all(promesas);
    cerrarModalEditar();
    toast('Cuenta actualizada', 'ok');
    await cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Eliminar cuenta ───────────────────────────────────────────

async function eliminarCuenta() {
  if (!cuentaSeleccionada) return;
  const { id, nombre } = cuentaSeleccionada;

  if (!confirm(`¿Seguro que quieres eliminar la cuenta "${nombre}"?\nEsta acción no se puede deshacer.`)) return;

  try {
    await del(`/api/cuentas/${id}`);
    toast(`Cuenta "${nombre}" eliminada`, 'ok');
    cuentaSeleccionada = null;
    await cargarCuentas(false);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Modal: Editar rendimiento ─────────────────────────────────

function abrirModalRend(id, monto, fecha) {
  document.getElementById('rend-editar-id').value    = id;
  document.getElementById('rend-editar-monto').value = monto;
  document.getElementById('rend-editar-fecha').value = fecha.split('T')[0];
  document.getElementById('modal-editar-rend').classList.add('abierto');
}

function cerrarModalRend() {
  document.getElementById('modal-editar-rend').classList.remove('abierto');
}

document.getElementById('modal-editar-rend').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalRend();
});

async function guardarEdicionRend() {
  const id    = parseInt(document.getElementById('rend-editar-id').value);
  const monto = parseFloat(document.getElementById('rend-editar-monto').value);
  const fecha = document.getElementById('rend-editar-fecha').value;

  if (!monto || monto <= 0) { toast('Ingresa un monto válido', 'err'); return; }
  if (!cuentaSeleccionada)  { cerrarModalRend(); return; }

  try {
    await patch(`/api/rendimientos/${id}`, {
      cuenta_id: cuentaSeleccionada.id,
      monto,
      fecha: new Date(fecha + 'T12:00:00').toISOString()
    });
    cerrarModalRend();
    toast('Rendimiento actualizado', 'ok');
    await cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRendimiento(id) {
  if (!confirm('¿Seguro que quieres eliminar este rendimiento?\nEl monto se descontará del saldo.')) return;

  try {
    await del(`/api/rendimientos/${id}`);
    toast('Rendimiento eliminado', 'ok');
    await cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Init ──────────────────────────────────────────────────────
cargarCuentas();
