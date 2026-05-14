async function cargarDashboard() {
  const data = await get('/api/dashboard/');

  document.getElementById('patrimonio').textContent   = fmt(data.patrimonio);
  document.getElementById('rend-diario').textContent  = '+' + fmt(data.rendimientos.diario);
  document.getElementById('rend-mensual').textContent = '+' + fmt(data.rendimientos.mensual);
  document.getElementById('deuda').textContent        = fmt(data.deuda_tarjeta);

  const cuentas = await get('/api/cuentas/');
  const debito  = cuentas.filter(c => c.tipo === 'debito');

  const lista = document.getElementById('lista-cuentas');
  lista.innerHTML = debito.map(c => `
    <div class="cuenta-row">
      <div class="cuenta-badge">${c.nombre.slice(0,2).toUpperCase()}</div>
      <div class="cuenta-info">
        <div class="cuenta-nombre">${c.nombre}</div>
        <div class="cuenta-tipo">Débito</div>
      </div>
      <div>
        <div class="cuenta-saldo">${fmt(c.saldo)}</div>
      </div>
    </div>
  `).join('');

  const select = document.getElementById('rend-cuenta');
  select.innerHTML = debito.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('');

  const tx = data.ultimas_transacciones;
  const tbody = document.getElementById('tabla-tx');
  tbody.innerHTML = tx.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Sin movimientos aún</td></tr>'
    : tx.map(t => `
      <tr>
        <td>${t.descripcion}</td>
        <td><span class="cat-badge">${t.categoria || 'Sin categoría'}</span></td>
        <td>${t.cuenta}</td>
        <td>${fmtFecha(t.fecha)}</td>
        <td class="${t.monto < 0 ? 'monto-neg' : 'monto-pos'}">${fmt(t.monto)}</td>
      </tr>
    `).join('');
}

async function registrarRendimiento() {
  const cuenta_id = parseInt(document.getElementById('rend-cuenta').value);
  const monto     = parseFloat(document.getElementById('rend-monto').value);

  if (!monto || monto <= 0) {
    toast('Ingresa un monto válido', 'err');
    return;
  }

  try {
    await post('/api/rendimientos/', { cuenta_id, monto });
    toast('Rendimiento registrado correctamente', 'ok');
    document.getElementById('rend-monto').value = '';
    cargarDashboard();
  } catch (e) {
    toast(e.message, 'err');
  }
}

cargarDashboard();
