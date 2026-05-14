let transacciones  = [];
let rendimientos   = [];
let cuentasDebito  = [];
let tabActual      = 'todos';
let mesActual      = '';

async function cargarHistorial() {
  [transacciones, rendimientos, cuentasDebito] = await Promise.all([
    get('/api/transacciones/?limite=1000'),
    get('/api/rendimientos/?limite=1000'),
    get('/api/cuentas/').then(c => c.filter(x => x.tipo === 'debito'))
  ]);

  poblarMeses();
  renderizar();
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
  tabActual = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderizar();
}

function cambiarMes() {
  mesActual = document.getElementById('filtro-mes').value;
  renderizar();
}

function renderizar() {
  const txMes   = filtrarMes(transacciones);
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

  const tbody = document.getElementById('tabla-historial');

  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:24px">Sin registros para este período</td></tr>';
    return;
  }

  tbody.innerHTML = filas.map(f => {
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
        <td></td>
      </tr>`;
  }).join('');
}

/* ── Editar rendimiento ── */

function abrirEditar(id, cuentaId, monto, fecha) {
  document.getElementById('editar-id').value    = id;
  document.getElementById('editar-monto').value = monto;
  document.getElementById('editar-fecha').value = fecha.split('T')[0];

  document.getElementById('editar-cuenta').innerHTML = cuentasDebito.map(c =>
    `<option value="${c.id}" ${c.id === cuentaId ? 'selected' : ''}>${c.nombre}</option>`
  ).join('');

  document.getElementById('modal-editar-rend').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-editar-rend').style.display = 'none';
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
  if (!confirm('¿Seguro que quieres eliminar este rendimiento?\nEl monto se descontará del saldo de la cuenta.')) return;

  try {
    await del('/api/rendimientos/' + id);
    toast('Rendimiento eliminado', 'ok');
    await cargarHistorial();
  } catch (e) {
    toast(e.message, 'err');
  }
}

cargarHistorial();
