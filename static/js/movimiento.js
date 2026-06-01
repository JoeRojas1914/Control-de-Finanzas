let _tabModal      = 'ingreso';
let _editandoTxId  = null;

function abrirMovimiento(tab) {
  _tabModal = tab || 'ingreso';
  Promise.all([get('/api/cuentas/'), get('/api/categorias/')]).then(([cuentas, categorias]) => {
    const optCuentas = cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    document.getElementById('mov-cuenta').innerHTML    = optCuentas;
    document.getElementById('trf-origen').innerHTML    = optCuentas;
    document.getElementById('trf-destino').innerHTML   = optCuentas;
    if (cuentas.length > 1)
      document.getElementById('trf-destino').selectedIndex = 1;
    document.getElementById('mov-categoria').innerHTML = categorias.map(c =>
      `<option value="${c.id}">${c.nombre}</option>`
    ).join('');
    document.getElementById('mov-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('trf-fecha').value = new Date().toISOString().split('T')[0];
  });
  _switchTab(_tabModal);
  document.getElementById('modal-movimiento').classList.add('abierto');
}

function cerrarMovimiento() {
  _editandoTxId = null;
  document.getElementById('modal-movimiento').classList.remove('abierto');
  document.getElementById('mov-titulo').textContent    = 'Registrar';
  document.getElementById('btn-guardar-mov').textContent = 'Guardar';
  ['mov-descripcion','mov-monto','trf-monto','trf-descripcion'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

async function abrirEditarTx(tx) {
  _editandoTxId = tx.id;
  const [cuentas, categorias] = await Promise.all([get('/api/cuentas/'), get('/api/categorias/')]);
  document.getElementById('mov-cuenta').innerHTML    = cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  document.getElementById('mov-categoria').innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  document.getElementById('mov-descripcion').value = tx.descripcion;
  document.getElementById('mov-monto').value        = Math.abs(tx.monto);
  document.getElementById('mov-fecha').value        = tx.fecha.split('T')[0];
  document.getElementById('mov-cuenta').value       = tx.cuenta_id || tx.cuenta?.id;
  if (tx.categoria_id) document.getElementById('mov-categoria').value = tx.categoria_id;

  document.getElementById('mov-titulo').textContent     = 'Editar movimiento';
  document.getElementById('btn-guardar-mov').textContent = 'Guardar cambios';

  _switchTab(tx.monto >= 0 ? 'ingreso' : 'gasto');
  document.getElementById('modal-movimiento').classList.add('abierto');
}

function _switchTab(tab) {
  _tabModal = tab;
  const esMovimiento = tab === 'ingreso' || tab === 'gasto';
  document.getElementById('form-movimiento').style.display    = esMovimiento      ? '' : 'none';
  document.getElementById('form-transferencia').style.display = tab === 'transferencia' ? '' : 'none';
  document.querySelectorAll('#modal-movimiento .tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}

async function registrarMovimiento() {
  const descripcion  = document.getElementById('mov-descripcion').value.trim();
  const montoRaw     = parseFloat(document.getElementById('mov-monto').value);
  const cuenta_id    = parseInt(document.getElementById('mov-cuenta').value);
  const categoria_id = parseInt(document.getElementById('mov-categoria').value);
  const fecha        = document.getElementById('mov-fecha').value;

  if (isNaN(cuenta_id)) { toast('Necesitas crear una cuenta primero', 'err'); return; }
  if (!descripcion)     { toast('La descripción es obligatoria', 'err'); return; }
  if (isNaN(montoRaw) || montoRaw <= 0) { toast('Ingresa un monto mayor a cero', 'err'); return; }

  const monto = _tabModal === 'gasto' ? -Math.abs(montoRaw) : Math.abs(montoRaw);

  const payload = { descripcion, monto, cuenta_id, categoria_id, fecha: new Date(fecha + 'T12:00:00').toISOString() };
  try {
    if (_editandoTxId) {
      await patch(`/api/transacciones/${_editandoTxId}`, payload);
      toast('Movimiento actualizado', 'ok');
    } else {
      await post('/api/transacciones/', payload);
      toast(`${_tabModal === 'gasto' ? 'Gasto' : 'Ingreso'} registrado`, 'ok');
      if (_tabModal === 'gasto' && !isNaN(categoria_id)) _alertaPresupuesto(categoria_id);
    }
    cerrarMovimiento();
    if (typeof cargarDashboard === 'function') cargarDashboard();
    if (typeof cargarHistorial === 'function') cargarHistorial();
    if (typeof cargarCuentas   === 'function') cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function _alertaPresupuesto(categoria_id) {
  try {
    const lista = await get('/api/presupuestos/');
    const p = lista?.find(x => x.categoria_id === categoria_id);
    if (!p) return;
    if (p.porcentaje >= 100) {
      toast(`¡Presupuesto excedido! ${p.categoria}: ${fmt(p.gastado)} / ${fmt(p.monto_limite)}`, 'warn');
    } else if (p.porcentaje >= 80) {
      toast(`Llevas el ${p.porcentaje}% del presupuesto de ${p.categoria}`, 'warn');
    }
  } catch { /* silencioso */ }
}

async function registrarTransferencia() {
  const origen_id   = parseInt(document.getElementById('trf-origen').value);
  const destino_id  = parseInt(document.getElementById('trf-destino').value);
  const monto       = parseFloat(document.getElementById('trf-monto').value);
  const descripcion = document.getElementById('trf-descripcion').value.trim() || null;
  const fecha       = document.getElementById('trf-fecha').value;

  if (isNaN(origen_id) || isNaN(destino_id)) {
    toast('Necesitas crear al menos dos cuentas para transferir', 'err');
    return;
  }
  if (origen_id === destino_id) { toast('La cuenta origen y destino no pueden ser la misma', 'err'); return; }
  if (!monto || monto <= 0)     { toast('El monto debe ser mayor a cero', 'err'); return; }

  try {
    await post('/api/transferencias/', {
      cuenta_origen_id: origen_id,
      cuenta_destino_id: destino_id,
      monto,
      descripcion,
      fecha: new Date(fecha + 'T12:00:00').toISOString()
    });
    toast('Transferencia registrada', 'ok');
    cerrarMovimiento();
    if (typeof cargarDashboard === 'function') cargarDashboard();
    if (typeof cargarHistorial === 'function') cargarHistorial();
    if (typeof cargarCuentas   === 'function') cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── FAB ──────────────────────────────────────────────────────

const fab = document.createElement('button');
fab.className = 'fab';
fab.title = 'Registrar movimiento  [N]';
fab.textContent = '+';
fab.onclick = () => abrirMovimiento('ingreso');
document.body.appendChild(fab);

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    if (!document.querySelector('.modal-overlay.abierto')) abrirMovimiento('ingreso');
    return;
  }

  if (e.key === 'Escape') {
    if (document.getElementById('modal-movimiento')?.classList.contains('abierto')) cerrarMovimiento();
  }
});

// ── Modal ─────────────────────────────────────────────────────

const modal = document.createElement('div');
modal.id = 'modal-movimiento';
modal.className = 'modal-overlay';
modal.innerHTML = `
  <div class="modal-box" style="max-width:440px">
    <div class="modal-header">
      <h2 class="card-title" style="margin:0" id="mov-titulo">Registrar</h2>
      <button class="modal-close" onclick="cerrarMovimiento()">✕</button>
    </div>

    <div class="tabs" style="margin-bottom:18px">
      <button class="tab tab-ingreso active" id="tab-ingreso"      onclick="_switchTab('ingreso')">Ingreso</button>
      <button class="tab tab-gasto"          id="tab-gasto"        onclick="_switchTab('gasto')">Gasto</button>
      <button class="tab"                    id="tab-transferencia" onclick="_switchTab('transferencia')">Transferencia</button>
    </div>

    <!-- Formulario ingreso / gasto -->
    <div id="form-movimiento">
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" id="mov-descripcion" placeholder="ej: Supermercado HEB">
      </div>
      <div class="form-group">
        <label>Monto</label>
        <input type="number" id="mov-monto" step="0.01" placeholder="0.00" min="0">
      </div>
      <div class="form-group">
        <label>Cuenta</label>
        <select id="mov-cuenta"></select>
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <select id="mov-categoria"></select>
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="mov-fecha">
      </div>
      <button class="btn-primary" id="btn-guardar-mov" onclick="registrarMovimiento()">Guardar</button>
    </div>

    <!-- Formulario transferencia -->
    <div id="form-transferencia" style="display:none">
      <div class="form-group">
        <label>Cuenta origen</label>
        <select id="trf-origen"></select>
      </div>
      <div class="form-group">
        <label>Cuenta destino</label>
        <select id="trf-destino"></select>
      </div>
      <div class="form-group">
        <label>Monto</label>
        <input type="number" id="trf-monto" step="0.01" placeholder="0.00" min="0">
      </div>
      <div class="form-group">
        <label>Descripción (opcional)</label>
        <input type="text" id="trf-descripcion" placeholder="ej: Ahorro mensual">
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="trf-fecha">
      </div>
      <button class="btn-primary" onclick="registrarTransferencia()">Transferir</button>
    </div>
  </div>
`;
modal.addEventListener('click', e => { if (e.target === modal) cerrarMovimiento(); });
document.body.appendChild(modal);
