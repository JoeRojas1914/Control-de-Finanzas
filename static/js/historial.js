let transacciones   = [];
let rendimientos    = [];
let transferencias  = [];
let cuentasDebito   = [];
let todasCuentas    = [];
let todasCategorias = [];
let tabActual       = 'todos';
let mesActual       = '';
let paginaActual    = 1;
const POR_PAGINA    = 25;

function _renderPaginacion(total) {
  const el          = document.getElementById('paginacion');
  const totalPags   = Math.ceil(total / POR_PAGINA);
  const inicio      = (paginaActual - 1) * POR_PAGINA + 1;
  const fin         = Math.min(paginaActual * POR_PAGINA, total);

  if (totalPags <= 1) {
    el.innerHTML = total > 0
      ? `<span style="font-size:12px;color:var(--text-muted)">${total} registro${total !== 1 ? 's' : ''}</span>`
      : '';
    return;
  }

  el.innerHTML = `
    <button class="btn-sm" onclick="irPagina(${paginaActual - 1})"
      ${paginaActual === 1 ? 'disabled' : ''}>← Anterior</button>
    <span style="font-size:13px;color:var(--text-muted)">${inicio}–${fin} de ${total}</span>
    <button class="btn-sm" onclick="irPagina(${paginaActual + 1})"
      ${paginaActual === totalPags ? 'disabled' : ''}>Siguiente →</button>
  `;
}

function irPagina(n) {
  paginaActual = n;
  if (tabActual === 'transferencias') renderizarTransferencias(false);
  else renderizar(false);
  document.getElementById('tabla-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cargarHistorial() {
  document.getElementById('tabla-historial').innerHTML = _skeletonTabla(8, 7);
  const cuentas = await get('/api/cuentas/');
  todasCuentas    = cuentas;
  cuentasDebito   = cuentas.filter(x => x.tipo === 'debito');
  todasCategorias = await get('/api/categorias/');

  [transacciones, rendimientos, transferencias] = await Promise.all([
    get('/api/transacciones/?limite=1000'),
    get('/api/rendimientos/?limite=1000'),
    get('/api/transferencias/'),
  ]);

  poblarMeses();
  poblarFiltros();
  renderizar();
}

function poblarFiltros() {
  const categorias = [...new Map(
    transacciones
      .filter(t => t.categoria)
      .map(t => [t.categoria.id, t.categoria])
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));

  document.getElementById('filtro-categoria').innerHTML =
    '<option value="">Todas las categorías</option>' +
    categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  document.getElementById('filtro-cuenta').innerHTML =
    '<option value="">Todas las cuentas</option>' +
    todasCuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function poblarMeses() {
  const meses = new Set();
  transacciones.forEach(t => meses.add(t.fecha.slice(0, 7)));
  rendimientos.forEach(r  => meses.add(r.fecha.slice(0, 7)));

  const ordenados = [...meses].sort().reverse();

  const hoy = new Date().toISOString().slice(0, 7);
  mesActual = ordenados.includes(hoy) ? hoy : (ordenados[0] || '');

  const select = document.getElementById('filtro-mes');
  select.innerHTML =
    '<option value="">Todos los meses</option>' +
    ordenados.map(m =>
      `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${fmtMes(m)}</option>`
    ).join('');
}

function fmtMes(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return new Date(y, m - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function filtrarMes(items) {
  if (!mesActual) return items;
  return items.filter(item => item.fecha.startsWith(mesActual));
}

function cambiarTab(tab, btn) {
  tabActual    = tab;
  paginaActual = 1;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const esTrf = tab === 'transferencias';
  document.getElementById('tabla-wrap').style.display             = esTrf ? 'none' : '';
  document.getElementById('tabla-transferencias-wrap').style.display = esTrf ? '' : 'none';

  // Los filtros de búsqueda/categoría/cuenta no aplican al tab de transferencias
  document.getElementById('filtro-busqueda').style.display  = esTrf ? 'none' : '';
  document.getElementById('filtro-categoria').style.display = esTrf ? 'none' : '';
  document.getElementById('filtro-cuenta').style.display    = esTrf ? 'none' : '';

  if (esTrf) renderizarTransferencias();
  else renderizar();
}

function cambiarMes() {
  mesActual = document.getElementById('filtro-mes').value;
  renderizar();
}

function renderizar(resetear = true) {
  if (resetear) paginaActual = 1;

  const busqueda  = document.getElementById('filtro-busqueda')?.value.trim().toLowerCase() || '';
  const catId     = document.getElementById('filtro-categoria')?.value || '';
  const cuentaId  = document.getElementById('filtro-cuenta')?.value || '';

  const txFiltradas = filtrarMes(transacciones).filter(t => {
    if (busqueda && !t.descripcion.toLowerCase().includes(busqueda)) return false;
    if (catId    && String(t.categoria?.id) !== catId)               return false;
    if (cuentaId && String(t.cuenta?.id)    !== cuentaId)            return false;
    return true;
  });

  const txMes   = txFiltradas;
  const rendMes = filtrarMes(rendimientos);

  const ingresos = txMes.filter(t => t.monto > 0);
  const gastos   = txMes.filter(t => t.monto < 0);

  const totalRend     = rendMes.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, t) => s + t.monto, 0);
  const totalGastos   = gastos.reduce((s, t) => s + Math.abs(t.monto), 0);
  const neto          = totalRend + totalIngresos - totalGastos;

  document.getElementById('total-rend').textContent     = '+' + fmt(totalRend);
  document.getElementById('total-ingresos').textContent = '+' + fmt(totalIngresos);
  document.getElementById('total-gastos').textContent   = fmt(totalGastos);

  const elNeto = document.getElementById('total-neto');
  elNeto.textContent = fmt(neto);
  elNeto.className   = 'metric-value ' + (neto >= 0 ? 'green' : 'red');

  let filas = [];

  if (tabActual === 'todos' || tabActual === 'rendimientos') {
    rendMes.forEach(r => filas.push({ ...r, _tipo: 'rendimiento' }));
  }
  if (tabActual === 'todos' || tabActual === 'ingresos') {
    ingresos.forEach(t => filas.push({ ...t, _tipo: 'ingreso' }));
  }
  if (tabActual === 'todos' || tabActual === 'gastos') {
    gastos.forEach(t => filas.push({ ...t, _tipo: 'gasto' }));
  }

  filas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const total   = filas.length;
  const inicio  = (paginaActual - 1) * POR_PAGINA;
  const pagina  = filas.slice(inicio, inicio + POR_PAGINA);
  const tbody   = document.getElementById('tabla-historial');

  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:24px">Sin registros para este período</td></tr>';
    _renderPaginacion(0);
    return;
  }

  _renderPaginacion(total);

  tbody.innerHTML = pagina.map(f => {
    if (f._tipo === 'rendimiento') {
      return `
        <tr>
          <td><span class="tipo-badge tipo-rend">Rendimiento</span></td>
          <td>${f.cuenta_nombre}</td>
          <td><span class="cat-badge">Rendimiento</span></td>
          <td>${f.cuenta_nombre}</td>
          <td>${fmtFecha(f.fecha)}</td>
          <td style="text-align:right" class="monto-pos">+${fmt(f.monto)}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn-sm" onclick="abrirEditar(${f.id}, ${f.cuenta_id}, ${f.monto}, '${f.fecha}')">Editar</button>
            <button class="btn-sm btn-danger" onclick="eliminarRendimiento(${f.id})" style="margin-left:4px">Eliminar</button>
          </td>
        </tr>`;
    }

    const cat    = f.categoria ? f.categoria.nombre : 'Sin categoría';
    const cuenta = f.cuenta ? f.cuenta.nombre : '—';
    const clase  = f._tipo === 'ingreso' ? 'monto-pos' : 'monto-neg';
    const signo  = f._tipo === 'ingreso' ? '+' : '';
    return `
      <tr>
        <td><span class="tipo-badge tipo-${f._tipo}">${f._tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
        <td>${f.descripcion}</td>
        <td><span class="cat-badge">${cat}</span></td>
        <td>${cuenta}</td>
        <td>${fmtFecha(f.fecha)}</td>
        <td style="text-align:right" class="${clase}">${signo}${fmt(f.monto)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn-sm" onclick="abrirEditarTx(${f.id})">Editar</button>
          <button class="btn-sm btn-danger" onclick="eliminarTx(${f.id}, ${JSON.stringify(f.descripcion)})" style="margin-left:4px">Eliminar</button>
        </td>
      </tr>`;
  }).join('');
}

/* ── Transferencias ── */

function renderizarTransferencias(resetear = true) {
  if (resetear) paginaActual = 1;

  const trfMes = mesActual
    ? transferencias.filter(t => t.fecha.startsWith(mesActual))
    : transferencias;

  const total  = trfMes.length;
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const pagina = trfMes.slice(inicio, inicio + POR_PAGINA);
  const tbody  = document.getElementById('tabla-transferencias');

  _renderPaginacion(total);

  if (!total) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px">Sin transferencias para este período</td></tr>';
    return;
  }
  tbody.innerHTML = pagina.map(t => `
    <tr>
      <td>${t.cuenta_origen}</td>
      <td>${t.cuenta_destino}</td>
      <td style="color:var(--text-muted)">${t.descripcion || '—'}</td>
      <td>${fmtFecha(t.fecha)}</td>
      <td style="text-align:right;font-weight:500">${fmt(t.monto)}</td>
      <td style="text-align:right">
        <button class="btn-sm btn-danger" onclick="eliminarTransferencia(${t.id})">Eliminar</button>
      </td>
    </tr>`).join('');
}

async function eliminarTransferencia(id) {
  if (!await confirmar('¿Eliminar esta transferencia?', 'Se revertirán los saldos de ambas cuentas.')) return;
  try {
    await del(`/api/transferencias/${id}`);
    toast('Transferencia eliminada', 'ok');
    await cargarHistorial();
    renderizarTransferencias();
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ── Editar / eliminar transacción ── */

function abrirEditarTx(id) {
  const tx = transacciones.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('tx-id').value          = tx.id;
  document.getElementById('tx-descripcion').value = tx.descripcion;
  document.getElementById('tx-monto').value       = tx.monto;
  document.getElementById('tx-fecha').value       = tx.fecha.split('T')[0];

  document.getElementById('tx-cuenta').innerHTML = todasCuentas.map(c =>
    `<option value="${c.id}" ${c.id === tx.cuenta?.id ? 'selected' : ''}>${c.nombre}</option>`
  ).join('');

  document.getElementById('tx-categoria').innerHTML =
    '<option value="">Sin categoría</option>' +
    todasCategorias.map(c =>
      `<option value="${c.id}" ${c.id === tx.categoria?.id ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

  document.getElementById('modal-editar-tx').classList.add('abierto');
}

function cerrarModalTx() {
  document.getElementById('modal-editar-tx').classList.remove('abierto');
}

document.getElementById('modal-editar-tx').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalTx();
});

async function guardarTx() {
  const id          = parseInt(document.getElementById('tx-id').value);
  const descripcion = document.getElementById('tx-descripcion').value.trim();
  const monto       = parseFloat(document.getElementById('tx-monto').value);
  const fechaStr    = document.getElementById('tx-fecha').value;
  const cuenta_id   = parseInt(document.getElementById('tx-cuenta').value);
  const catVal      = document.getElementById('tx-categoria').value;
  const categoria_id = catVal ? parseInt(catVal) : null;

  if (!descripcion) { toast('La descripción es obligatoria', 'err'); return; }
  if (isNaN(monto)) { toast('Ingresa un monto válido', 'err'); return; }

  try {
    await patch(`/api/transacciones/${id}`, {
      descripcion,
      monto,
      cuenta_id,
      categoria_id,
      fecha: fechaStr ? new Date(fechaStr + 'T12:00:00').toISOString() : undefined,
    });
    cerrarModalTx();
    toast('Transacción actualizada', 'ok');
    await cargarHistorial();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarTx(id, descripcion) {
  if (!await confirmar(`¿Eliminar "${descripcion}"?`, 'El monto se revertirá en el saldo de la cuenta.')) return;
  try {
    await del(`/api/transacciones/${id}`);
    toast('Transacción eliminada', 'ok');
    await cargarHistorial();
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ── Editar rendimiento ── */

function abrirEditar(id, cuentaId, monto, fecha) {
  document.getElementById('editar-id').value    = id;
  document.getElementById('editar-monto').value = monto;
  document.getElementById('editar-fecha').value = fecha.split('T')[0];

  document.getElementById('editar-cuenta').innerHTML = cuentasDebito.map(c =>
    `<option value="${c.id}" ${c.id === cuentaId ? 'selected' : ''}>${c.nombre}</option>`
  ).join('');

  document.getElementById('modal-editar-rend').classList.add('abierto');
}

function cerrarModal() {
  document.getElementById('modal-editar-rend').classList.remove('abierto');
}

document.getElementById('modal-editar-rend').addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});

async function guardarEdicion() {
  const id        = parseInt(document.getElementById('editar-id').value);
  const cuenta_id = parseInt(document.getElementById('editar-cuenta').value);
  const monto     = parseFloat(document.getElementById('editar-monto').value);
  const fecha     = document.getElementById('editar-fecha').value;

  if (!monto || monto <= 0) {
    toast('Ingresa un monto válido', 'err');
    return;
  }

  try {
    await patch('/api/rendimientos/' + id, {
      cuenta_id,
      monto,
      fecha: new Date(fecha).toISOString()
    });
    cerrarModal();
    toast('Rendimiento actualizado', 'ok');
    await cargarHistorial();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRendimiento(id) {
  if (!await confirmar('¿Eliminar este rendimiento?', 'El monto se descontará del saldo de la cuenta.')) return;

  try {
    await del('/api/rendimientos/' + id);
    toast('Rendimiento eliminado', 'ok');
    await cargarHistorial();
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ── Exportar CSV ── */

function exportarCSV() {
  const busqueda = document.getElementById('filtro-busqueda')?.value.trim().toLowerCase() || '';
  const catId    = document.getElementById('filtro-categoria')?.value || '';
  const cuentaId = document.getElementById('filtro-cuenta')?.value || '';

  const txFiltradas = filtrarMes(transacciones).filter(t => {
    if (busqueda && !t.descripcion.toLowerCase().includes(busqueda)) return false;
    if (catId    && String(t.categoria?.id) !== catId)               return false;
    if (cuentaId && String(t.cuenta?.id)    !== cuentaId)            return false;
    return true;
  });

  const rendMes = filtrarMes(rendimientos);
  const trfMes  = mesActual
    ? transferencias.filter(t => t.fecha.startsWith(mesActual))
    : transferencias;

  const esc = s => `"${String(s).replace(/"/g, '""')}"`;

  let filas = [];

  if (tabActual === 'transferencias') {
    trfMes.forEach(t => filas.push([
      'Transferencia',
      esc(t.descripcion || ''),
      '—',
      esc(`${t.cuenta_origen} → ${t.cuenta_destino}`),
      t.fecha.split('T')[0],
      t.monto,
    ]));
  } else {
    if (tabActual === 'todos' || tabActual === 'rendimientos') {
      rendMes.forEach(r => filas.push([
        'Rendimiento', esc(r.cuenta_nombre), 'Rendimiento',
        esc(r.cuenta_nombre), r.fecha.split('T')[0], r.monto,
      ]));
    }
    const ingresos = txFiltradas.filter(t => t.monto > 0);
    const gastos   = txFiltradas.filter(t => t.monto < 0);
    if (tabActual === 'todos' || tabActual === 'ingresos') {
      ingresos.forEach(t => filas.push([
        'Ingreso', esc(t.descripcion), esc(t.categoria?.nombre || 'Sin categoría'),
        esc(t.cuenta?.nombre || '—'), t.fecha.split('T')[0], t.monto,
      ]));
    }
    if (tabActual === 'todos' || tabActual === 'gastos') {
      gastos.forEach(t => filas.push([
        'Gasto', esc(t.descripcion), esc(t.categoria?.nombre || 'Sin categoría'),
        esc(t.cuenta?.nombre || '—'), t.fecha.split('T')[0], t.monto,
      ]));
    }
    filas.sort((a, b) => new Date(b[4]) - new Date(a[4]));
  }

  const encabezado = ['Tipo', 'Descripcion', 'Categoria', 'Cuenta', 'Fecha', 'Monto'];
  const csv = [encabezado.join(','), ...filas.map(f => f.join(','))].join('\n');

  const nombre = mesActual ? `finanzas_${mesActual}.csv` : 'finanzas_todo.csv';
  const blob   = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

cargarHistorial();
