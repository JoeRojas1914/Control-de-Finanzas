function abrirMovimiento() {
  Promise.all([get('/api/cuentas/'), get('/api/categorias/')]).then(([cuentas, categorias]) => {
    document.getElementById('mov-cuenta').innerHTML = cuentas.map(c =>
      `<option value="${c.id}">${c.nombre}</option>`
    ).join('');
    document.getElementById('mov-categoria').innerHTML = categorias.map(c =>
      `<option value="${c.id}">${c.nombre}</option>`
    ).join('');
    document.getElementById('mov-fecha').value = new Date().toISOString().split('T')[0];
  });
  document.getElementById('modal-movimiento').style.display = 'flex';
}

function cerrarMovimiento() {
  document.getElementById('modal-movimiento').style.display = 'none';
  document.getElementById('mov-descripcion').value = '';
  document.getElementById('mov-monto').value = '';
}

async function registrarMovimiento() {
  const descripcion  = document.getElementById('mov-descripcion').value.trim();
  const monto        = parseFloat(document.getElementById('mov-monto').value);
  const cuenta_id    = parseInt(document.getElementById('mov-cuenta').value);
  const categoria_id = parseInt(document.getElementById('mov-categoria').value);
  const fecha        = document.getElementById('mov-fecha').value;

  if (!descripcion || isNaN(monto)) {
    toast('Completa todos los campos', 'err');
    return;
  }

  try {
    await post('/api/transacciones/', {
      descripcion, monto, cuenta_id, categoria_id,
      fecha: new Date(fecha).toISOString()
    });
    toast('Movimiento registrado', 'ok');
    cerrarMovimiento();
    if (typeof cargarDashboard === 'function') cargarDashboard();
    if (typeof cargarHistorial === 'function') cargarHistorial();
    if (typeof cargarCuentas  === 'function') cargarCuentas(true);
  } catch (e) {
    toast(e.message, 'err');
  }
}

// Inyectar FAB y modal en el DOM
const fab = document.createElement('button');
fab.className = 'fab';
fab.title = 'Registrar movimiento';
fab.textContent = '+';
fab.onclick = abrirMovimiento;
document.body.appendChild(fab);

const modal = document.createElement('div');
modal.id = 'modal-movimiento';
modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100;align-items:center;justify-content:center;';
modal.innerHTML = `
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:28px;width:100%;max-width:440px;margin:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 class="card-title" style="margin:0">Registrar movimiento</h2>
      <button onclick="cerrarMovimiento()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted)">✕</button>
    </div>
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
`;
modal.addEventListener('click', e => { if (e.target === modal) cerrarMovimiento(); });
document.body.appendChild(modal);
