let _tabModal = 'movimiento';

function abrirMovimiento(tab) {
  _tabModal = tab || 'movimiento';
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
  document.getElementById('modal-movimiento').style.display = 'flex';
}

function cerrarMovimiento() {
  document.getElementById('modal-movimiento').style.display = 'none';
  ['mov-descripcion','mov-monto','trf-monto','trf-descripcion'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function _switchTab(tab) {
  _tabModal = tab;
  document.getElementById('form-movimiento').style.display  = tab === 'movimiento'   ? '' : 'none';
  document.getElementById('form-transferencia').style.display = tab === 'transferencia' ? '' : 'none';
  document.querySelectorAll('#modal-movimiento .tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}

async function registrarMovimiento() {
  const descripcion  = document.getElementById('mov-descripcion').value.trim();
  const monto        = parseFloat(document.getElementById('mov-monto').value);
  const cuenta_id    = parseInt(document.getElementById('mov-cuenta').value);
  const categoria_id = parseInt(document.getElementById('mov-categoria').value);
  const fecha        = document.getElementById('mov-fecha').value;

  if (isNaN(cuenta_id)) {
    toast('Necesitas crear una cuenta primero', 'err');
    return;
  }
  if (!descripcion) {
    toast('La descripción es obligatoria', 'err');
    return;
  }
  if (isNaN(monto)) {
    toast('Ingresa un monto válido', 'err');
    return;
  }

  try {
    await post('/api/transacciones/', {
      descripcion, monto, cuenta_id, categoria_id,
      fecha: new Date(fecha + 'T12:00:00').toISOString()
    });
    toast('Movimiento registrado', 'ok');
    cerrarMovimiento();
    if (typeof cargarDashboard === 'function') cargarDashboard();
    if (typeof cargarHistorial === 'function') cargarHistorial();
    if (typeof cargarCuentas   === 'function') cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function registrarTransferencia() {
  const origen_id  = parseInt(document.getElementById('trf-origen').value);
  const destino_id = parseInt(document.getElementById('trf-destino').value);
  const monto      = parseFloat(document.getElementById('trf-monto').value);
  const descripcion = document.getElementById('trf-descripcion').value.trim() || null;
  const fecha      = document.getElementById('trf-fecha').value;

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

// ── Inyectar FAB y modal ──────────────────────────────────────

const fab = document.createElement('button');
fab.className = 'fab';
fab.title = 'Registrar movimiento';
fab.textContent = '+';
fab.onclick = () => abrirMovimiento('movimiento');
document.body.appendChild(fab);

const modal = document.createElement('div');
modal.id = 'modal-movimiento';
modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100;align-items:center;justify-content:center;';
modal.innerHTML = `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:28px;width:100%;max-width:440px;margin:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h2 class="card-title" style="margin:0">Registrar</h2>
      <button onclick="cerrarMovimiento()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">✕</button>
    </div>

    <div class="tabs" style="margin-bottom:18px">
      <button class="tab active" id="tab-movimiento"   onclick="_switchTab('movimiento')">Movimiento</button>
      <button class="tab"        id="tab-transferencia" onclick="_switchTab('transferencia')">Transferencia</button>
    </div>

    <!-- Formulario movimiento -->
    <div id="form-movimiento">
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" id="mov-descripcion" placeholder="ej: Supermercado HEB">
      </div>
      <div class="form-group">
        <label>Monto (negativo = gasto, positivo = ingreso)</label>
        <input type="number" id="mov-monto" step="0.01" placeholder="ej: -850">
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
      <button class="btn-primary" onclick="registrarMovimiento()">Guardar</button>
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
