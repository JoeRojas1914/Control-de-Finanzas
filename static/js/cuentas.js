// ── State ────────────────────────────────────────────────────
let todasCuentas       = [];
let cuentaSeleccionada = null;
const TX_POR_PAGINA    = 15;
const REND_POR_PAGINA  = 10;
const REC_POR_PAGINA   = 5;
const RENDP_POR_PAGINA = 5;
let _paginaActual      = 1;
let _totalTx           = 0;
let _paginaRendActual  = 1;
let _totalRend         = 0;
let _paginaRecActual   = 1;
let _totalRec          = 0;
let _paginaRendPActual = 1;
let _totalRendP        = 0;
let _recurrentesCuenta   = [];
let _rendpFijosCuenta    = [];
let _rendpHorariosCuenta = [];

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

  _paginaActual      = 1;
  _paginaRendActual  = 1;
  _paginaRecActual   = 1;
  _paginaRendPActual = 1;

  const [transacciones, conteo, estadisticas, rendimientos, conteoRend, resumen, todosRec, todosFijos, todosHorarios] = await Promise.all([
    get(`/api/transacciones/?cuenta_id=${c.id}&limite=${TX_POR_PAGINA}&offset=0`),
    get(`/api/transacciones/count?cuenta_id=${c.id}`),
    get(`/api/cuentas/${c.id}/estadisticas`),
    c.tipo === 'debito' ? get(`/api/rendimientos/?cuenta_id=${c.id}&limite=${REND_POR_PAGINA}&offset=0`) : Promise.resolve([]),
    c.tipo === 'debito' ? get(`/api/rendimientos/count?cuenta_id=${c.id}`)                              : Promise.resolve({total:0}),
    c.tipo === 'debito' ? get(`/api/cuentas/${c.id}/rendimientos`)                                     : Promise.resolve(null),
    get('/api/recurrentes/'),
    c.tipo === 'debito' ? get('/api/rendimientos-programados/')          : Promise.resolve([]),
    c.tipo === 'debito' ? get('/api/rendimientos-programados/horarios/') : Promise.resolve([]),
  ]);

  _totalTx   = conteo?.total    ?? 0;
  _totalRend = conteoRend?.total ?? 0;

  _recurrentesCuenta   = (todosRec      || []).filter(r => r.cuenta_id === c.id);
  _rendpFijosCuenta    = (todosFijos    || []).filter(r => r.cuenta_id === c.id);
  _rendpHorariosCuenta = (todosHorarios || []).filter(h => h.cuenta_id === c.id);
  _totalRec   = _recurrentesCuenta.length;
  _totalRendP = _rendpFijosCuenta.length + _rendpHorariosCuenta.length;

  document.getElementById('detalle-panel').innerHTML = c.tipo === 'debito'
    ? renderDetalleDebito(c, resumen, rendimientos, transacciones, estadisticas)
    : renderDetalleCredito(c, transacciones, estadisticas);
}

async function irPaginaRend(pagina) {
  if (!cuentaSeleccionada) return;
  _paginaRendActual = pagina;
  const offset = (pagina - 1) * REND_POR_PAGINA;
  const rends  = await get(`/api/rendimientos/?cuenta_id=${cuentaSeleccionada.id}&limite=${REND_POR_PAGINA}&offset=${offset}`);
  document.getElementById('cuenta-rend-section').innerHTML = renderRendConPaginacion(rends);
}

async function irPagina(pagina) {
  if (!cuentaSeleccionada) return;
  _paginaActual = pagina;
  const offset  = (pagina - 1) * TX_POR_PAGINA;
  const txs     = await get(`/api/transacciones/?cuenta_id=${cuentaSeleccionada.id}&limite=${TX_POR_PAGINA}&offset=${offset}`);
  document.getElementById('cuenta-tx-section').innerHTML = renderTxConPaginacion(txs);
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

function renderDetalleDebito(c, resumen, rendimientos, transacciones, estadisticas) {
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

    ${renderEstadisticas(estadisticas)}

    <div class="card" style="margin-bottom:16px">
      <h2 class="card-title">Rendimientos</h2>
      <div id="cuenta-rend-section">${renderRendConPaginacion(rendimientos)}</div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h2 class="card-title">Movimientos</h2>
      <div id="cuenta-tx-section">${renderTxConPaginacion(transacciones)}</div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 class="card-title" style="margin:0">Transacciones recurrentes</h2>
        <button class="btn-sm" onclick="abrirModalRec()">+ Nueva</button>
      </div>
      <div id="cuenta-rec-section">${renderRecConPaginacion()}</div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 class="card-title" style="margin:0">Rendimientos automáticos</h2>
        <div style="display:flex;gap:8px">
          <button class="btn-sm" onclick="abrirModalRendP()">+ Fijo</button>
          <button class="btn-sm" onclick="abrirModalHorario()">+ Personalizado</button>
        </div>
      </div>
      <div id="cuenta-rendp-section">${renderRendPConPaginacion()}</div>
    </div>`;
}

function renderDetalleCredito(c, transacciones, estadisticas) {
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

    ${(c.dia_corte || c.dia_pago) ? `
    <div class="card" style="margin-bottom:16px;display:flex;gap:32px;align-items:center">
      ${c.dia_corte ? `<div><p class="metric-label">Fecha de corte</p><p style="font-size:15px;font-weight:600;color:var(--text)">Día ${c.dia_corte} de cada mes</p></div>` : ''}
      ${c.dia_pago  ? `<div><p class="metric-label">Límite de pago</p><p style="font-size:15px;font-weight:600;color:var(--text)">Día ${c.dia_pago} de cada mes</p></div>` : ''}
    </div>` : ''}

    ${renderEstadisticas(estadisticas)}

    <div class="card" style="margin-bottom:16px">
      <h2 class="card-title">Movimientos</h2>
      <div id="cuenta-tx-section">${renderTxConPaginacion(transacciones)}</div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 class="card-title" style="margin:0">Transacciones recurrentes</h2>
        <button class="btn-sm" onclick="abrirModalRec()">+ Nueva</button>
      </div>
      <div id="cuenta-rec-section">${renderRecConPaginacion()}</div>
    </div>`;
}

function renderRendConPaginacion(rends) {
  const totalPags = Math.ceil(_totalRend / REND_POR_PAGINA);
  const inicio    = (_paginaRendActual - 1) * REND_POR_PAGINA + 1;
  const fin       = Math.min(_paginaRendActual * REND_POR_PAGINA, _totalRend);
  const hayPags   = _totalRend > REND_POR_PAGINA;

  return `
    ${hayPags ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text-muted)">${inicio}–${fin} de ${_totalRend}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-sm" ${_paginaRendActual<=1 ? 'disabled style="opacity:.4;pointer-events:none"':''} onclick="irPaginaRend(${_paginaRendActual-1})">← Ant.</button>
        <span style="font-size:12px;color:var(--text-muted);padding:0 4px">Pág. ${_paginaRendActual} / ${totalPags}</span>
        <button class="btn-sm" ${_paginaRendActual>=totalPags ? 'disabled style="opacity:.4;pointer-events:none"':''} onclick="irPaginaRend(${_paginaRendActual+1})">Sig. →</button>
      </div>
    </div>` : ''}
    ${renderListaRendimientos(rends)}`;
}

async function eliminarTx(txId) {
  if (!await confirmar('¿Eliminar este movimiento?', 'El saldo de la cuenta se ajustará automáticamente.')) return;
  try {
    await del(`/api/transacciones/${txId}`);
    toast('Movimiento eliminado', 'ok');
    await cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

function renderEstadisticas(s) {
  if (!s || s.total_txs === 0) return '';
  const rows = [
    ['Total ingresos',      `<span class="monto-pos">+${fmt(s.total_ingresos)}</span>`],
    ['Total gastos',        `<span class="monto-neg">${fmt(s.total_gastos)}</span>`],
    ['Promedio mensual',    fmt(s.prom_mensual_gasto)],
    ['Mes con más gasto',   s.mes_mayor_gasto ? `${s.mes_mayor_gasto} (${fmt(s.mes_mayor_gasto_monto)})` : '—'],
    ['Categoría principal', s.top_categoria   ? `${s.top_categoria} (${fmt(s.top_categoria_monto)})` : '—'],
    ['Movimientos totales', s.total_txs],
  ];
  return `
    <div class="card" style="margin-bottom:16px">
      <h2 class="card-title">Estadísticas históricas</h2>
      <div class="stats-grid">
        ${rows.map(([label, val]) => `
          <div class="stat-item">
            <div class="stat-label">${label}</div>
            <div class="stat-value">${val}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderTxConPaginacion(txs) {
  const totalPags = Math.ceil(_totalTx / TX_POR_PAGINA);
  const inicio    = (_paginaActual - 1) * TX_POR_PAGINA + 1;
  const fin       = Math.min(_paginaActual * TX_POR_PAGINA, _totalTx);
  const hayPags   = _totalTx > TX_POR_PAGINA;

  return `
    ${hayPags ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text-muted)">${inicio}–${fin} de ${_totalTx} movimientos</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-sm" ${_paginaActual <= 1 ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPagina(${_paginaActual - 1})">← Ant.</button>
        <span style="font-size:12px;color:var(--text-muted);padding:0 4px">Pág. ${_paginaActual} / ${totalPags}</span>
        <button class="btn-sm" ${_paginaActual >= totalPags ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPagina(${_paginaActual + 1})">Sig. →</button>
      </div>
    </div>` : ''}
    ${renderTablaTransacciones(txs)}`;
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
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${transacciones.map(t => {
          const cat   = t.categoria ? t.categoria.nombre : '—';
          const color = t.monto < 0 ? 'color:#a32d2d' : 'color:#0f6e56';
          const signo = t.monto > 0 ? '+' : '';
          const txJson = encodeURIComponent(JSON.stringify({
            id: t.id, descripcion: t.descripcion, monto: t.monto,
            cuenta_id: t.cuenta_id || t.cuenta?.id,
            categoria_id: t.categoria_id || t.categoria?.id || null,
            fecha: t.fecha,
          }));
          return `
            <tr>
              <td>${fmtFecha(t.fecha)}</td>
              <td>${t.descripcion}</td>
              <td><span class="cat-badge">${cat}</span></td>
              <td style="text-align:right;${color}">${signo}${fmt(t.monto)}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn-sm" onclick="abrirEditarTx(JSON.parse(decodeURIComponent('${txJson}')))">Editar</button>
                <button class="btn-sm btn-danger" onclick="eliminarTx(${t.id})">Eliminar</button>
              </td>
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
  document.getElementById('nueva-corte').value  = '';
  document.getElementById('nueva-pago').value   = '';
}

document.getElementById('modal-nueva').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalNueva();
});

document.getElementById('nueva-tipo').addEventListener('change', function() {
  document.getElementById('grupo-credito-campos').style.display =
    this.value === 'credito' ? 'block' : 'none';
});

async function agregarCuenta() {
  const nombre    = document.getElementById('nueva-nombre').value.trim();
  const tipo      = document.getElementById('nueva-tipo').value;
  const saldo     = parseFloat(document.getElementById('nueva-saldo').value) || 0;
  const limite    = parseFloat(document.getElementById('nueva-limite').value) || null;
  const dia_corte = parseInt(document.getElementById('nueva-corte').value) || null;
  const dia_pago  = parseInt(document.getElementById('nueva-pago').value)  || null;

  if (!nombre) { toast('El nombre de la cuenta es obligatorio', 'err'); return; }

  try {
    const nueva = await post('/api/cuentas/', { nombre, tipo, saldo, limite, dia_corte, dia_pago });
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

  const esCredito = c.tipo === 'credito';
  document.getElementById('editar-grupo-credito').style.display = esCredito ? 'block' : 'none';
  if (esCredito) {
    document.getElementById('editar-limite').value = c.limite    || 0;
    document.getElementById('editar-corte').value  = c.dia_corte || '';
    document.getElementById('editar-pago').value   = c.dia_pago  || '';
  }

  document.getElementById('editar-saldo-label').textContent = esCredito ? 'Deuda actual ($)' : 'Saldo actual ($)';
  document.getElementById('editar-saldo').value = esCredito ? Math.abs(c.saldo) : c.saldo;

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
      const limite    = parseFloat(document.getElementById('editar-limite').value) || 0;
      const dia_corte = parseInt(document.getElementById('editar-corte').value)    || null;
      const dia_pago  = parseInt(document.getElementById('editar-pago').value)     || null;
      if (limite !== c.limite)
        promesas.push(patch(`/api/cuentas/${id}/limite`, { limite }));
      if (dia_corte !== c.dia_corte || dia_pago !== c.dia_pago)
        promesas.push(patch(`/api/cuentas/${id}/fechas-tc`, { dia_corte, dia_pago }));
    }
    const saldoInput = parseFloat(document.getElementById('editar-saldo').value) || 0;
    const saldo      = c.tipo === 'credito' ? -Math.abs(saldoInput) : saldoInput;
    if (saldo !== c.saldo) {
      promesas.push(patch(`/api/cuentas/${id}/saldo`, { saldo }));
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

  if (!await confirmar(
    `¿Eliminar la cuenta "${nombre}"?`,
    'Se eliminarán permanentemente todas las transacciones, rendimientos, transferencias y recurrentes asociados a esta cuenta. Esta acción no se puede deshacer.'
  )) return;

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
  if (!await confirmar('¿Eliminar este rendimiento?', 'El monto se descontará del saldo de la cuenta.')) return;

  try {
    await del(`/api/rendimientos/${id}`);
    toast('Rendimiento eliminado', 'ok');
    await cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Recurrentes ───────────────────────────────────────────────

const FRECUENCIA_LABEL = {
  diaria: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal',
  mensual: 'Mensual', anual: 'Anual'
};

function renderListaRecurrentes(recs) {
  if (!recs.length) return '<div class="empty-state">Sin transacciones recurrentes</div>';
  return recs.map(r => `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">${r.descripcion}</div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${fmt(r.monto)} · ${FRECUENCIA_LABEL[r.frecuencia]} · próxima: ${fmtFecha(r.proxima_fecha)}
          ${r.activa ? '' : '· <span style="color:#f59e0b">Pausada</span>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleRec(${r.id}, ${r.activa})">${r.activa ? 'Pausar' : 'Activar'}</button>
        <button class="btn-sm" onclick="abrirModalRec(${r.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarRec(${r.id}, ${JSON.stringify(r.descripcion)})">Eliminar</button>
      </div>
    </div>`).join('');
}

function renderRecConPaginacion() {
  const totalPags = Math.ceil(_totalRec / REC_POR_PAGINA);
  const inicio    = (_paginaRecActual - 1) * REC_POR_PAGINA;
  const fin       = Math.min(_paginaRecActual * REC_POR_PAGINA, _totalRec);
  const slice     = _recurrentesCuenta.slice(inicio, fin);
  const hayPags   = _totalRec > REC_POR_PAGINA;

  return `
    ${hayPags ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text-muted)">${inicio + 1}–${fin} de ${_totalRec}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-sm" ${_paginaRecActual <= 1 ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPaginaRec(${_paginaRecActual - 1})">← Ant.</button>
        <span style="font-size:12px;color:var(--text-muted);padding:0 4px">Pág. ${_paginaRecActual} / ${totalPags}</span>
        <button class="btn-sm" ${_paginaRecActual >= totalPags ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPaginaRec(${_paginaRecActual + 1})">Sig. →</button>
      </div>
    </div>` : ''}
    ${renderListaRecurrentes(slice)}`;
}

function irPaginaRec(pagina) {
  _paginaRecActual = pagina;
  const el = document.getElementById('cuenta-rec-section');
  if (el) el.innerHTML = renderRecConPaginacion();
}

async function _recargarRec() {
  if (!cuentaSeleccionada) return;
  const todos = await get('/api/recurrentes/');
  _recurrentesCuenta = (todos || []).filter(r => r.cuenta_id === cuentaSeleccionada.id);
  _totalRec = _recurrentesCuenta.length;
  _paginaRecActual = 1;
  const el = document.getElementById('cuenta-rec-section');
  if (el) el.innerHTML = renderRecConPaginacion();
}

async function abrirModalRec(id) {
  const cats = await get('/api/categorias/');

  document.getElementById('rec-cuenta').innerHTML =
    `<option value="${cuentaSeleccionada.id}">${cuentaSeleccionada.nombre}</option>`;
  document.getElementById('rec-cuenta').closest('.form-group').style.display = 'none';

  document.getElementById('rec-categoria').innerHTML =
    '<option value="">Sin categoría</option>' +
    cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  if (id) {
    const rec = _recurrentesCuenta.find(r => r.id === id);
    document.getElementById('modal-rec-titulo').textContent  = 'Editar recurrente';
    document.getElementById('rec-id').value                  = rec.id;
    document.getElementById('rec-descripcion').value         = rec.descripcion;
    document.getElementById('rec-monto').value               = rec.monto;
    document.getElementById('rec-frecuencia').value          = rec.frecuencia;
    document.getElementById('rec-proxima-fecha').value       = rec.proxima_fecha.split('T')[0];
    document.getElementById('rec-categoria').value           = rec.categoria_id || '';
  } else {
    document.getElementById('modal-rec-titulo').textContent  = 'Nueva recurrente';
    document.getElementById('rec-id').value                  = '';
    document.getElementById('rec-descripcion').value         = '';
    document.getElementById('rec-monto').value               = '';
    document.getElementById('rec-frecuencia').value          = 'mensual';
    document.getElementById('rec-proxima-fecha').value       = new Date().toISOString().split('T')[0];
    document.getElementById('rec-categoria').value           = '';
  }
  document.getElementById('modal-rec').classList.add('abierto');
}

function cerrarModalRec() {
  document.getElementById('modal-rec').classList.remove('abierto');
}

document.getElementById('modal-rec').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalRec();
});

async function guardarRec() {
  const id          = document.getElementById('rec-id').value;
  const descripcion = document.getElementById('rec-descripcion').value.trim();
  const monto       = parseFloat(document.getElementById('rec-monto').value);
  const frecuencia  = document.getElementById('rec-frecuencia').value;
  const fechaStr    = document.getElementById('rec-proxima-fecha').value;
  const cuenta_id   = parseInt(document.getElementById('rec-cuenta').value);
  const catVal      = document.getElementById('rec-categoria').value;
  const categoria_id = catVal ? parseInt(catVal) : null;

  if (!descripcion) { toast('La descripción es obligatoria', 'err'); return; }
  if (!monto)       { toast('El monto es obligatorio', 'err'); return; }
  if (!fechaStr)    { toast('La fecha es obligatoria', 'err'); return; }

  const proxima_fecha = new Date(fechaStr + 'T12:00:00').toISOString();
  const cuerpo = { descripcion, monto, frecuencia, proxima_fecha, cuenta_id, categoria_id };

  try {
    if (id) {
      await patch(`/api/recurrentes/${id}`, cuerpo);
      toast('Recurrente actualizada', 'ok');
    } else {
      await post('/api/recurrentes/', cuerpo);
      toast('Recurrente creada', 'ok');
    }
    cerrarModalRec();
    _recargarRec();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRec(id, descripcion) {
  if (!await confirmar(`¿Eliminar "${descripcion}"?`, 'Las transacciones ya creadas permanecerán.')) return;
  try {
    await del(`/api/recurrentes/${id}`);
    toast(`"${descripcion}" eliminada`, 'ok');
    _recargarRec();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleRec(id, activa) {
  try {
    await patch(`/api/recurrentes/${id}/toggle`, {});
    toast(activa ? 'Recurrente pausada' : 'Recurrente activada', 'ok');
    _recargarRec();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Rendimientos programados ──────────────────────────────────

const _DIAS_LABEL = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
const _DIAS_KEY   = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

function renderRendPConPaginacion() {
  const combinados = [..._rendpFijosCuenta, ..._rendpHorariosCuenta];
  if (!combinados.length) return '<div class="empty-state">Sin rendimientos programados</div>';

  const totalPags = Math.ceil(_totalRendP / RENDP_POR_PAGINA);
  const inicio    = (_paginaRendPActual - 1) * RENDP_POR_PAGINA;
  const fin       = Math.min(_paginaRendPActual * RENDP_POR_PAGINA, _totalRendP);
  const slice     = combinados.slice(inicio, fin);
  const hayPags   = _totalRendP > RENDP_POR_PAGINA;

  const htmlItems = slice.map(item => {
    if ('frecuencia' in item) {
      return `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">
          <span style="font-size:11px;background:rgba(59,130,246,0.12);color:#3b82f6;padding:2px 7px;border-radius:5px;margin-right:6px">Fijo</span>
          ${fmt(item.monto)} · ${FRECUENCIA_LABEL[item.frecuencia]}
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          Próxima: ${fmtFecha(item.proxima_fecha)}
          ${item.activo ? '' : '· <span style="color:#f59e0b">Pausado</span>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleRendP(${item.id}, ${item.activo})">${item.activo ? 'Pausar' : 'Activar'}</button>
        <button class="btn-sm" onclick="abrirModalRendP(${item.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarRendP(${item.id})">Eliminar</button>
      </div>
    </div>`;
    } else {
      const resumen = _DIAS_LABEL
        .map((d, i) => item[_DIAS_KEY[i]] ? `${d}: ${fmt(item[_DIAS_KEY[i]])}` : null)
        .filter(Boolean).join(' · ');
      return `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">
          <span style="font-size:11px;background:rgba(139,92,246,0.12);color:#8b5cf6;padding:2px 7px;border-radius:5px;margin-right:6px">Personalizado</span>
          ${resumen || 'Sin montos configurados'}
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${item.activo ? '' : '<span style="color:#f59e0b">Pausado</span>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleHorario(${item.id}, ${item.activo})">${item.activo ? 'Pausar' : 'Activar'}</button>
        <button class="btn-sm" onclick="abrirModalHorario(${item.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarHorario(${item.id})">Eliminar</button>
      </div>
    </div>`;
    }
  }).join('');

  return `
    ${hayPags ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text-muted)">${inicio + 1}–${fin} de ${_totalRendP}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-sm" ${_paginaRendPActual <= 1 ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPaginaRendP(${_paginaRendPActual - 1})">← Ant.</button>
        <span style="font-size:12px;color:var(--text-muted);padding:0 4px">Pág. ${_paginaRendPActual} / ${totalPags}</span>
        <button class="btn-sm" ${_paginaRendPActual >= totalPags ? 'disabled style="opacity:.4;pointer-events:none"' : ''} onclick="irPaginaRendP(${_paginaRendPActual + 1})">Sig. →</button>
      </div>
    </div>` : ''}
    ${htmlItems}`;
}

function irPaginaRendP(pagina) {
  _paginaRendPActual = pagina;
  const el = document.getElementById('cuenta-rendp-section');
  if (el) el.innerHTML = renderRendPConPaginacion();
}

async function _recargarRendP() {
  if (!cuentaSeleccionada) return;
  const [fijos, horarios] = await Promise.all([
    get('/api/rendimientos-programados/'),
    get('/api/rendimientos-programados/horarios/'),
  ]);
  _rendpFijosCuenta    = (fijos    || []).filter(r => r.cuenta_id === cuentaSeleccionada.id);
  _rendpHorariosCuenta = (horarios || []).filter(h => h.cuenta_id === cuentaSeleccionada.id);
  _totalRendP = _rendpFijosCuenta.length + _rendpHorariosCuenta.length;
  _paginaRendPActual = 1;
  const el = document.getElementById('cuenta-rendp-section');
  if (el) el.innerHTML = renderRendPConPaginacion();
}

async function abrirModalRendP(id) {
  document.getElementById('rendp-cuenta').innerHTML =
    `<option value="${cuentaSeleccionada.id}">${cuentaSeleccionada.nombre}</option>`;
  document.getElementById('rendp-cuenta').closest('.form-group').style.display = 'none';

  if (id) {
    const r = _rendpFijosCuenta.find(x => x.id === id);
    document.getElementById('modal-rendp-titulo').textContent  = 'Editar rendimiento automático';
    document.getElementById('rendp-id').value                  = r.id;
    document.getElementById('rendp-monto').value               = r.monto;
    document.getElementById('rendp-frecuencia').value          = r.frecuencia;
    document.getElementById('rendp-proxima-fecha').value       = r.proxima_fecha.split('T')[0];
  } else {
    document.getElementById('modal-rendp-titulo').textContent  = 'Nuevo rendimiento automático';
    document.getElementById('rendp-id').value                  = '';
    document.getElementById('rendp-monto').value               = '';
    document.getElementById('rendp-frecuencia').value          = 'diaria';
    document.getElementById('rendp-proxima-fecha').value       = new Date().toISOString().split('T')[0];
  }
  document.getElementById('modal-rendp').classList.add('abierto');
}

function cerrarModalRendP() {
  document.getElementById('modal-rendp').classList.remove('abierto');
}

document.getElementById('modal-rendp').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalRendP();
});

async function guardarRendP() {
  const id           = document.getElementById('rendp-id').value;
  const cuenta_id    = parseInt(document.getElementById('rendp-cuenta').value);
  const monto        = parseFloat(document.getElementById('rendp-monto').value);
  const frecuencia   = document.getElementById('rendp-frecuencia').value;
  const fechaStr     = document.getElementById('rendp-proxima-fecha').value;

  if (!monto || monto <= 0) { toast('El monto debe ser mayor a cero', 'err'); return; }
  if (!fechaStr)             { toast('La fecha es obligatoria', 'err'); return; }

  const proxima_fecha = new Date(fechaStr + 'T12:00:00').toISOString();
  const cuerpo = { cuenta_id, monto, frecuencia, proxima_fecha };

  try {
    if (id) {
      await patch(`/api/rendimientos-programados/${id}`, cuerpo);
      toast('Rendimiento actualizado', 'ok');
    } else {
      await post('/api/rendimientos-programados/', cuerpo);
      toast('Rendimiento programado creado', 'ok');
    }
    cerrarModalRendP();
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRendP(id) {
  if (!await confirmar('¿Eliminar este rendimiento programado?', 'Los rendimientos ya registrados permanecerán.')) return;
  try {
    await del(`/api/rendimientos-programados/${id}`);
    toast('Rendimiento programado eliminado', 'ok');
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleRendP(id, activo) {
  try {
    await patch(`/api/rendimientos-programados/${id}/toggle`, {});
    toast(activo ? 'Pausado' : 'Activado', 'ok');
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function abrirModalHorario(id) {
  document.getElementById('horario-cuenta').innerHTML =
    `<option value="${cuentaSeleccionada.id}">${cuentaSeleccionada.nombre}</option>`;
  document.getElementById('horario-cuenta').closest('.form-group').style.display = 'none';

  _DIAS_KEY.forEach(d => { document.getElementById(`horario-${d}`).value = ''; });

  if (id) {
    const h = _rendpHorariosCuenta.find(x => x.id === id);
    document.getElementById('modal-horario-titulo').textContent = 'Editar horario personalizado';
    document.getElementById('horario-id').value                 = h.id;
    _DIAS_KEY.forEach(d => {
      document.getElementById(`horario-${d}`).value = h[d] || '';
    });
  } else {
    document.getElementById('modal-horario-titulo').textContent = 'Horario personalizado';
    document.getElementById('horario-id').value                 = '';
  }
  document.getElementById('modal-horario').classList.add('abierto');
}

function cerrarModalHorario() {
  document.getElementById('modal-horario').classList.remove('abierto');
}

document.getElementById('modal-horario').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalHorario();
});

async function guardarHorario() {
  const id        = document.getElementById('horario-id').value;
  const cuenta_id = parseInt(document.getElementById('horario-cuenta').value);

  const cuerpo = { cuenta_id };
  _DIAS_KEY.forEach(d => {
    const v = parseFloat(document.getElementById(`horario-${d}`).value);
    cuerpo[d] = isNaN(v) || v <= 0 ? null : v;
  });

  const tieneAlgo = _DIAS_KEY.some(d => cuerpo[d]);
  if (!tieneAlgo) { toast('Ingresa al menos un monto', 'err'); return; }

  try {
    if (id) {
      await patch(`/api/rendimientos-programados/horarios/${id}`, cuerpo);
      toast('Horario actualizado', 'ok');
    } else {
      await post('/api/rendimientos-programados/horarios/', cuerpo);
      toast('Horario creado', 'ok');
    }
    cerrarModalHorario();
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarHorario(id) {
  if (!await confirmar('¿Eliminar este horario personalizado?', 'Los rendimientos ya registrados permanecerán.')) return;
  try {
    await del(`/api/rendimientos-programados/horarios/${id}`);
    toast('Horario eliminado', 'ok');
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleHorario(id, activo) {
  try {
    await patch(`/api/rendimientos-programados/horarios/${id}/toggle`, {});
    toast(activo ? 'Pausado' : 'Activado', 'ok');
    _recargarRendP();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Init ──────────────────────────────────────────────────────
cargarCuentas();
