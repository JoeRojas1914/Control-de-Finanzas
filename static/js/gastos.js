async function iniciar() {
  const cuentas    = await get('/api/cuentas/');
  const categorias = await get('/api/categorias/');

  document.getElementById('cuenta').innerHTML = cuentas.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('');

  document.getElementById('categoria').innerHTML = categorias.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('');

  document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
}

async function registrarGasto() {
  const descripcion  = document.getElementById('descripcion').value.trim();
  const monto        = parseFloat(document.getElementById('monto').value);
  const cuenta_id    = parseInt(document.getElementById('cuenta').value);
  const categoria_id = parseInt(document.getElementById('categoria').value);
  const fecha        = document.getElementById('fecha').value;

  if (!descripcion || isNaN(monto)) {
    toast('Completa todos los campos', 'err');
    return;
  }

  try {
    await post('/api/transacciones/', {
      descripcion, monto, cuenta_id, categoria_id,
      fecha: new Date(fecha).toISOString()
    });
    toast('Movimiento guardado correctamente', 'ok');
    document.getElementById('descripcion').value = '';
    document.getElementById('monto').value = '';
  } catch (e) {
    toast(e.message, 'err');
  }
}

iniciar();
