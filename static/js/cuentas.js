async function cargarCuentas() {
  const cuentas = await get('/api/cuentas/');
  const contenedor = document.getElementById('lista-cuentas-detalle');

  contenedor.innerHTML = cuentas.map(c => `
    <div class="cuenta-row">
      <div class="cuenta-badge">${c.nombre.slice(0,2).toUpperCase()}</div>
      <div class="cuenta-info">
        <div class="cuenta-nombre">${c.nombre}</div>
        <div class="cuenta-tipo">${c.tipo === 'debito' ? 'Débito' : 'Crédito'}${c.limite ? ' · Límite: ' + fmt(c.limite) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input class="saldo-input" type="number" value="${c.saldo}" step="0.01" id="saldo-${c.id}">
        <button class="btn-sm" onclick="actualizarSaldo(${c.id})">Actualizar</button>
      </div>
    </div>
  `).join('');
}

async function actualizarSaldo(id) {
  const saldo = parseFloat(document.getElementById('saldo-' + id).value);
  await patch('/api/cuentas/' + id + '/saldo', { saldo });
  cargarCuentas();
}

cargarCuentas();