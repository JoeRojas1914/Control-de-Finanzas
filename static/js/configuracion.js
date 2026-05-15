let categorias   = [];
let cuentasConf  = [];
let categoriasConf = [];

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

// ── Presupuestos ──────────────────────────────────────────────

async function cargarPresupuestos() {
  const lista = await get('/api/presupuestos/');
  const el    = document.getElementById('lista-presupuestos');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state">Sin presupuestos definidos</div>';
    return;
  }
  el.innerHTML = lista.map(p => {
    const pct   = Math.min(p.porcentaje, 100);
    const cls   = p.porcentaje >= 100 ? 'over' : p.porcentaje >= 80 ? 'warn' : '';
    return `
      <div class="cuenta-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="cuenta-nombre">${p.categoria}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:12px;color:var(--text-muted)">${fmt(p.gastado)} / ${fmt(p.monto_limite)}</span>
            <button class="btn-sm" onclick="abrirModalPres(${p.id})">Editar</button>
            <button class="btn-sm btn-danger" onclick="eliminarPres(${p.id}, ${JSON.stringify(p.categoria)})">Eliminar</button>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

async function abrirModalPres(id) {
  const cats = await get('/api/categorias/');
  document.getElementById('pres-categoria').innerHTML = cats.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('');

  if (id) {
    const lista = await get('/api/presupuestos/');
    const p     = lista.find(x => x.id === id);
    document.getElementById('modal-pres-titulo').textContent = 'Editar presupuesto';
    document.getElementById('pres-id').value                 = p.id;
    document.getElementById('pres-categoria').value          = p.categoria_id;
    document.getElementById('pres-limite').value             = p.monto_limite;
  } else {
    document.getElementById('modal-pres-titulo').textContent = 'Nuevo presupuesto';
    document.getElementById('pres-id').value                 = '';
    document.getElementById('pres-limite').value             = '';
  }
  document.getElementById('modal-pres').classList.add('abierto');
}

function cerrarModalPres() {
  document.getElementById('modal-pres').classList.remove('abierto');
}

document.getElementById('modal-pres').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalPres();
});

async function guardarPres() {
  const id           = document.getElementById('pres-id').value;
  const categoria_id = parseInt(document.getElementById('pres-categoria').value);
  const monto_limite = parseFloat(document.getElementById('pres-limite').value);
  if (!monto_limite || monto_limite <= 0) { toast('Ingresa un límite válido', 'err'); return; }
  try {
    if (id) {
      await patch(`/api/presupuestos/${id}`, { categoria_id, monto_limite });
      toast('Presupuesto actualizado', 'ok');
    } else {
      await post('/api/presupuestos/', { categoria_id, monto_limite });
      toast('Presupuesto creado', 'ok');
    }
    cerrarModalPres();
    cargarPresupuestos();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarPres(id, categoria) {
  if (!confirm(`¿Eliminar el presupuesto de "${categoria}"?`)) return;
  try {
    await del(`/api/presupuestos/${id}`);
    toast(`Presupuesto de "${categoria}" eliminado`, 'ok');
    cargarPresupuestos();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Recurrentes ───────────────────────────────────────────────

const FRECUENCIA_LABEL = {
  diaria: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal',
  mensual: 'Mensual', anual: 'Anual'
};

async function cargarRecurrentes() {
  const lista = await get('/api/recurrentes/');
  const contenedor = document.getElementById('lista-recurrentes');
  if (!lista || !lista.length) {
    contenedor.innerHTML = '<div class="empty-state">Sin transacciones recurrentes</div>';
    return;
  }
  contenedor.innerHTML = lista.map(r => `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">${r.descripcion}</div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${fmt(r.monto)} · ${FRECUENCIA_LABEL[r.frecuencia]} · próxima: ${fmtFecha(r.proxima_fecha)}
          · ${r.cuenta.nombre}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleRec(${r.id}, ${r.activa})">
          ${r.activa ? 'Pausar' : 'Activar'}
        </button>
        <button class="btn-sm" onclick="abrirModalRec(${r.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarRec(${r.id}, ${JSON.stringify(r.descripcion)})">Eliminar</button>
      </div>
    </div>`).join('');
}

async function abrirModalRec(id) {
  [cuentasConf, categoriasConf] = await Promise.all([
    get('/api/cuentas/'),
    get('/api/categorias/'),
  ]);

  document.getElementById('rec-cuenta').innerHTML = cuentasConf.map(c =>
    `<option value="${c.id}">${c.nombre}</option>`
  ).join('');

  document.getElementById('rec-categoria').innerHTML =
    '<option value="">Sin categoría</option>' +
    categoriasConf.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  if (id) {
    const rec = await get(`/api/recurrentes/`).then(l => l.find(r => r.id === id));
    document.getElementById('modal-rec-titulo').textContent = 'Editar recurrente';
    document.getElementById('rec-id').value              = rec.id;
    document.getElementById('rec-descripcion').value     = rec.descripcion;
    document.getElementById('rec-monto').value           = rec.monto;
    document.getElementById('rec-frecuencia').value      = rec.frecuencia;
    document.getElementById('rec-proxima-fecha').value   = rec.proxima_fecha.split('T')[0];
    document.getElementById('rec-cuenta').value          = rec.cuenta_id;
    document.getElementById('rec-categoria').value       = rec.categoria_id || '';
  } else {
    document.getElementById('modal-rec-titulo').textContent = 'Nueva recurrente';
    document.getElementById('rec-id').value              = '';
    document.getElementById('rec-descripcion').value     = '';
    document.getElementById('rec-monto').value           = '';
    document.getElementById('rec-frecuencia').value      = 'mensual';
    document.getElementById('rec-proxima-fecha').value   = new Date().toISOString().split('T')[0];
    document.getElementById('rec-cuenta').value          = cuentasConf[0]?.id || '';
    document.getElementById('rec-categoria').value       = '';
  }

  document.getElementById('modal-rec').classList.add('abierto');
}

function cerrarModalRec() {
  document.getElementById('modal-rec').classList.remove('abierto');
}

document.getElementById('modal-rec').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalRec();
});

async function guardarRec() {
  const id          = document.getElementById('rec-id').value;
  const descripcion = document.getElementById('rec-descripcion').value.trim();
  const monto       = parseFloat(document.getElementById('rec-monto').value);
  const frecuencia  = document.getElementById('rec-frecuencia').value;
  const fechaStr    = document.getElementById('rec-proxima-fecha').value;
  const cuenta_id   = parseInt(document.getElementById('rec-cuenta').value);
  const catVal      = document.getElementById('rec-categoria').value;
  const categoria_id = catVal ? parseInt(catVal) : null;

  if (!descripcion) { toast('La descripción es obligatoria', 'err'); return; }
  if (!monto)       { toast('El monto es obligatorio', 'err'); return; }
  if (!fechaStr)    { toast('La fecha es obligatoria', 'err'); return; }

  const proxima_fecha = new Date(fechaStr + 'T12:00:00').toISOString();
  const cuerpo = { descripcion, monto, frecuencia, proxima_fecha, cuenta_id, categoria_id };

  try {
    if (id) {
      await patch(`/api/recurrentes/${id}`, cuerpo);
      toast('Recurrente actualizada', 'ok');
    } else {
      await post('/api/recurrentes/', cuerpo);
      toast('Recurrente creada', 'ok');
    }
    cerrarModalRec();
    cargarRecurrentes();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRec(id, descripcion) {
  if (!confirm(`¿Eliminar "${descripcion}"?\nLas transacciones ya creadas permanecerán.`)) return;
  try {
    await del(`/api/recurrentes/${id}`);
    toast(`"${descripcion}" eliminada`, 'ok');
    cargarRecurrentes();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleRec(id, activa) {
  try {
    await patch(`/api/recurrentes/${id}/toggle`, {});
    toast(activa ? 'Recurrente pausada' : 'Recurrente activada', 'ok');
    cargarRecurrentes();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Init ──────────────────────────────────────────────────────
cargarCategorias();
cargarPresupuestos();
cargarRecurrentes();
sincronizarBtnTema();
