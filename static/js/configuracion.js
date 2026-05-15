let categorias = [];

async function cargarCategorias() {
  categorias = await get('/api/categorias/');
  const contenedor = document.getElementById('lista-categorias');
  if (!categorias.length) {
    contenedor.innerHTML = '<div class="empty-state">Sin categorías</div>';
    return;
  }
  contenedor.innerHTML = categorias.map(c => `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">${c.nombre}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-sm"
          onclick="abrirModalEditar(${c.id}, ${JSON.stringify(c.nombre)})">
          Renombrar
        </button>
        <button class="btn-sm btn-danger"
          onclick="eliminarCategoria(${c.id}, ${JSON.stringify(c.nombre)})">
          Eliminar
        </button>
      </div>
    </div>`).join('');
}

// ── Modal: nueva categoría ────────────────────────────────────

function abrirModalNueva() {
  document.getElementById('modal-nueva').classList.add('abierto');
}

function cerrarModalNueva() {
  document.getElementById('modal-nueva').classList.remove('abierto');
  document.getElementById('nueva-nombre').value = '';
}

document.getElementById('modal-nueva').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalNueva();
});

async function agregarCategoria() {
  const nombre = document.getElementById('nueva-nombre').value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'err'); return; }
  try {
    await post('/api/categorias/', { nombre });
    cerrarModalNueva();
    toast(`Categoría "${nombre}" creada`, 'ok');
    cargarCategorias();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Modal: renombrar categoría ────────────────────────────────

function abrirModalEditar(id, nombre) {
  document.getElementById('editar-id').value     = id;
  document.getElementById('editar-nombre').value = nombre;
  document.getElementById('modal-editar').classList.add('abierto');
}

function cerrarModalEditar() {
  document.getElementById('modal-editar').classList.remove('abierto');
}

document.getElementById('modal-editar').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalEditar();
});

async function guardarEdicion() {
  const id     = parseInt(document.getElementById('editar-id').value);
  const nombre = document.getElementById('editar-nombre').value.trim();
  if (!nombre) { toast('El nombre no puede estar vacío', 'err'); return; }
  try {
    await patch(`/api/categorias/${id}`, { nombre });
    cerrarModalEditar();
    toast('Categoría actualizada', 'ok');
    cargarCategorias();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Eliminar ──────────────────────────────────────────────────

async function eliminarCategoria(id, nombre) {
  if (!confirm(`¿Eliminar la categoría "${nombre}"?\nSolo puedes eliminarla si no tiene transacciones registradas.`)) return;
  try {
    await del(`/api/categorias/${id}`);
    toast(`Categoría "${nombre}" eliminada`, 'ok');
    cargarCategorias();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Preferencias ─────────────────────────────────────────────

function sincronizarBtnTema() {
  const oscuro = localStorage.getItem('tema') === 'obscuro';
  const btn    = document.getElementById('btn-tema-conf');
  if (btn) btn.textContent = oscuro ? 'Activado' : 'Desactivado';
}

function toggleTemaConf() {
  toggleTema();           // de navbar.js — cambia la clase y el localStorage
  sincronizarBtnTema();
}

// ── Exportar datos ────────────────────────────────────────────

function descargarCSV(filas, nombreArchivo) {
  const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportarTransacciones() {
  try {
    const txs = await get('/api/transacciones/?limite=9999');
    if (!txs.length) { toast('No hay transacciones para exportar', 'err'); return; }

    const filas = [
      ['Fecha', 'Descripción', 'Categoría', 'Cuenta', 'Monto'].join(','),
      ...txs.map(t => [
        fmtFecha(t.fecha),
        `"${(t.descripcion || '').replace(/"/g, '""')}"`,
        `"${t.categoria ? t.categoria.nombre : ''}"`,
        `"${t.cuenta    ? t.cuenta.nombre    : ''}"`,
        t.monto
      ].join(','))
    ];

    descargarCSV(filas, `transacciones-${new Date().toISOString().slice(0,10)}.csv`);
    toast(`${txs.length} transacciones exportadas`, 'ok');
  } catch (e) {
    toast('Error al exportar transacciones', 'err');
  }
}

async function exportarRendimientos() {
  try {
    const rends = await get('/api/rendimientos/?limite=9999');
    if (!rends.length) { toast('No hay rendimientos para exportar', 'err'); return; }

    const filas = [
      ['Fecha', 'Cuenta', 'Monto'].join(','),
      ...rends.map(r => [
        fmtFecha(r.fecha),
        `"${(r.cuenta_nombre || '').replace(/"/g, '""')}"`,
        r.monto
      ].join(','))
    ];

    descargarCSV(filas, `rendimientos-${new Date().toISOString().slice(0,10)}.csv`);
    toast(`${rends.length} rendimientos exportados`, 'ok');
  } catch (e) {
    toast('Error al exportar rendimientos', 'err');
  }
}

// ── Init ──────────────────────────────────────────────────────
cargarCategorias();
sincronizarBtnTema();
