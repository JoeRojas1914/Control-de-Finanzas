let cuentasDebito = [];

async function cargarDashboard() {
  const resultado = await post('/api/recurrentes/aplicar', {});
  if (resultado?.aplicadas > 0)
    toast(`${resultado.aplicadas} transacción(es) recurrente(s) aplicada(s)`, 'ok');

  const data = await get('/api/dashboard/');

  document.getElementById('patrimonio').textContent   = fmt(data.patrimonio);
  document.getElementById('rend-diario').textContent  = '+' + fmt(data.rendimientos.diario);
  document.getElementById('rend-mensual').textContent = '+' + fmt(data.rendimientos.mensual);
  document.getElementById('deuda').textContent        = fmt(data.deuda_tarjeta);

  const cuentas = await get('/api/cuentas/');
  cuentasDebito = cuentas.filter(c => c.tipo === 'debito');

  document.getElementById('lista-cuentas').innerHTML = cuentasDebito.map(c => `
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

  document.getElementById('rend-cuenta').innerHTML = cuentasDebito.map(c =>
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
  const fechaStr  = document.getElementById('rend-fecha').value;

  if (!cuenta_id || isNaN(cuenta_id)) {
    toast('Necesitas crear una cuenta de débito primero', 'err');
    return;
  }
  if (!monto || monto <= 0) {
    toast('Ingresa un monto válido', 'err');
    return;
  }

  try {
    const fecha = fechaStr ? new Date(fechaStr + 'T12:00:00').toISOString() : undefined;
    await post('/api/rendimientos/', { cuenta_id, monto, fecha });
    toast('Rendimiento registrado correctamente', 'ok');
    document.getElementById('rend-monto').value = '';
    document.getElementById('rend-fecha').value = new Date().toISOString().split('T')[0];
    cargarDashboard();
  } catch (e) {
    toast(e.message, 'err');
  }
}

cargarDashboard();
