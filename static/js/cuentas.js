function abrirModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('nueva-nombre').value = '';
  document.getElementById('nueva-saldo').value  = '';
  document.getElementById('nueva-limite').value = '';
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});

async function cargarCuentas() {
  const cuentas    = await get('/api/cuentas/');
  const contenedor = document.getElementById('lista-cuentas-detalle');

  contenedor.innerHTML = cuentas.map(c => {
    const esCredito = c.tipo === 'credito';
    return `
      <div class="cuenta-row">
        <div class="cuenta-badge">${c.nombre.slice(0,2).toUpperCase()}</div>
        <div class="cuenta-info">
          <div class="cuenta-nombre">${c.nombre}</div>
          <div class="cuenta-tipo">${esCredito ? 'Crédito' : 'Débito'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">

          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <label style="font-size:11px;color:var(--text-muted)">
              ${esCredito ? 'Deuda actual' : 'Saldo'}
            </label>
            <div style="display:flex;gap:6px">
              <input class="saldo-input" type="number" step="0.01"
                value="${esCredito ? Math.abs(c.saldo) : c.saldo}"
                id="saldo-${c.id}">
              <button class="btn-sm" onclick="actualizarSaldo(${c.id}, ${esCredito})">
                Actualizar
              </button>
            </div>
          </div>

          ${esCredito ? `
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <label style="font-size:11px;color:var(--text-muted)">Límite</label>
              <div style="display:flex;gap:6px">
                <input class="saldo-input" type="number" step="0.01"
                  value="${c.limite || 0}"
                  id="limite-${c.id}">
                <button class="btn-sm" onclick="actualizarLimite(${c.id})">
                  Actualizar
                </button>
              </div>
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <label style="font-size:11px;color:var(--text-muted)">Eliminar</label>
            <button class="btn-sm btn-danger" onclick="eliminarCuenta(${c.id}, '${c.nombre}')">
              Eliminar
            </button>
          </div>

        </div>
      </div>
    `;
  }).join('');
}

async function actualizarSaldo(id, esCredito) {
  const input = document.getElementById('saldo-' + id);
  const valor = parseFloat(input.value);
  const saldo = esCredito ? -Math.abs(valor) : valor;
  try {
    await patch('/api/cuentas/' + id + '/saldo', { saldo });
    toast('Saldo actualizado', 'ok');
    cargarCuentas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function actualizarLimite(id) {
  const limite = parseFloat(document.getElementById('limite-' + id).value);
  try {
    await patch('/api/cuentas/' + id + '/limite', { limite });
    toast('Límite de crédito actualizado', 'ok');
    cargarCuentas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function agregarCuenta() {
  const nombre = document.getElementById('nueva-nombre').value.trim();
  const tipo   = document.getElementById('nueva-tipo').value;
  const saldo  = parseFloat(document.getElementById('nueva-saldo').value) || 0;
  const limite = parseFloat(document.getElementById('nueva-limite').value) || null;

  if (!nombre) {
    toast('El nombre de la cuenta es obligatorio', 'err');
    return;
  }

  try {
    await post('/api/cuentas/', { nombre, tipo, saldo, limite });
    cerrarModal();
    toast(`Cuenta "${nombre}" creada`, 'ok');
    cargarCuentas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarCuenta(id, nombre) {
  if (!confirm(`¿Seguro que quieres eliminar la cuenta "${nombre}"?\nEsta acción no se puede deshacer.`)) return;

  try {
    await del('/api/cuentas/' + id);
    toast(`Cuenta "${nombre}" eliminada`, 'ok');
    cargarCuentas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

document.getElementById('nueva-tipo').addEventListener('change', function () {
  document.getElementById('grupo-limite').style.display =
    this.value === 'credito' ? 'block' : 'none';
});

cargarCuentas();
