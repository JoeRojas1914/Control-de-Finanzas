let categorias   = [];
let cuentasConf  = [];
let categoriasConf = [];

async function cargarCategorias() {
  document.getElementById('lista-categorias').innerHTML = _skeletonLista(4);
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
  document.getElementById('lista-presupuestos').innerHTML = _skeletonLista(2);
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
  document.getElementById('lista-recurrentes').innerHTML = _skeletonLista(3);
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

// ── Rendimientos programados ──────────────────────────────────

const _DIAS_LABEL = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
const _DIAS_KEY   = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

async function cargarRendimientosProgramados() {
  document.getElementById('lista-rendp').innerHTML = _skeletonLista(2);
  const [fijos, horarios] = await Promise.all([
    get('/api/rendimientos-programados/'),
    get('/api/rendimientos-programados/horarios/'),
  ]);
  const el = document.getElementById('lista-rendp');

  const htmlFijos = (fijos || []).map(r => `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">${r.cuenta.nombre}
          <span style="font-size:11px;background:rgba(59,130,246,0.12);color:#3b82f6;padding:2px 7px;border-radius:5px;margin-left:6px">Fijo</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${fmt(r.monto)} · ${FRECUENCIA_LABEL[r.frecuencia]} · próxima: ${fmtFecha(r.proxima_fecha)}
          ${r.activo ? '' : '· <span style="color:#f59e0b">Pausado</span>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleRendP(${r.id}, ${r.activo})">${r.activo ? 'Pausar' : 'Activar'}</button>
        <button class="btn-sm" onclick="abrirModalRendP(${r.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarRendP(${r.id})">Eliminar</button>
      </div>
    </div>`);

  const htmlHorarios = (horarios || []).map(h => {
    const resumen = _DIAS_LABEL
      .map((d, i) => h[_DIAS_KEY[i]] ? `${d}: ${fmt(h[_DIAS_KEY[i]])}` : null)
      .filter(Boolean).join(' · ');
    return `
    <div class="cuenta-row">
      <div class="cuenta-info">
        <div class="cuenta-nombre">${h.cuenta.nombre}
          <span style="font-size:11px;background:rgba(139,92,246,0.12);color:#8b5cf6;padding:2px 7px;border-radius:5px;margin-left:6px">Personalizado</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${resumen || 'Sin montos configurados'}
          ${h.activo ? '' : '· <span style="color:#f59e0b">Pausado</span>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-sm" onclick="toggleHorario(${h.id}, ${h.activo})">${h.activo ? 'Pausar' : 'Activar'}</button>
        <button class="btn-sm" onclick="abrirModalHorario(${h.id})">Editar</button>
        <button class="btn-sm btn-danger" onclick="eliminarHorario(${h.id})">Eliminar</button>
      </div>
    </div>`;
  });

  const todo = [...htmlFijos, ...htmlHorarios];
  el.innerHTML = todo.length
    ? todo.join('')
    : '<div class="empty-state">Sin rendimientos programados</div>';
}

async function abrirModalRendP(id) {
  const cuentas = await get('/api/cuentas/');
  document.getElementById('rendp-cuenta').innerHTML = cuentas
    .filter(c => c.tipo === 'debito')
    .map(c => `<option value="${c.id}">${c.nombre}</option>`)
    .join('');

  if (id) {
    const lista = await get('/api/rendimientos-programados/');
    const r     = lista.find(x => x.id === id);
    document.getElementById('modal-rendp-titulo').textContent  = 'Editar rendimiento automático';
    document.getElementById('rendp-id').value                  = r.id;
    document.getElementById('rendp-cuenta').value              = r.cuenta_id;
    document.getElementById('rendp-monto').value               = r.monto;
    document.getElementById('rendp-frecuencia').value          = r.frecuencia;
    document.getElementById('rendp-proxima-fecha').value       = r.proxima_fecha.split('T')[0];
  } else {
    document.getElementById('modal-rendp-titulo').textContent  = 'Nuevo rendimiento automático';
    document.getElementById('rendp-id').value                  = '';
    document.getElementById('rendp-monto').value               = '';
    document.getElementById('rendp-frecuencia').value          = 'diaria';
    document.getElementById('rendp-proxima-fecha').value       = new Date().toISOString().split('T')[0];
  }
  document.getElementById('modal-rendp').classList.add('abierto');
}

function cerrarModalRendP() {
  document.getElementById('modal-rendp').classList.remove('abierto');
}

document.getElementById('modal-rendp').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalRendP();
});

async function guardarRendP() {
  const id           = document.getElementById('rendp-id').value;
  const cuenta_id    = parseInt(document.getElementById('rendp-cuenta').value);
  const monto        = parseFloat(document.getElementById('rendp-monto').value);
  const frecuencia   = document.getElementById('rendp-frecuencia').value;
  const fechaStr     = document.getElementById('rendp-proxima-fecha').value;

  if (isNaN(cuenta_id)) { toast('Selecciona una cuenta', 'err'); return; }
  if (!monto || monto <= 0) { toast('El monto debe ser mayor a cero', 'err'); return; }
  if (!fechaStr) { toast('La fecha es obligatoria', 'err'); return; }

  const proxima_fecha = new Date(fechaStr + 'T12:00:00').toISOString();
  const cuerpo = { cuenta_id, monto, frecuencia, proxima_fecha };

  try {
    if (id) {
      await patch(`/api/rendimientos-programados/${id}`, cuerpo);
      toast('Rendimiento actualizado', 'ok');
    } else {
      await post('/api/rendimientos-programados/', cuerpo);
      toast('Rendimiento programado creado', 'ok');
    }
    cerrarModalRendP();
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarRendP(id) {
  if (!confirm('¿Eliminar este rendimiento programado?\nLos rendimientos ya registrados permanecerán.')) return;
  try {
    await del(`/api/rendimientos-programados/${id}`);
    toast('Rendimiento programado eliminado', 'ok');
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleRendP(id, activo) {
  try {
    await patch(`/api/rendimientos-programados/${id}/toggle`, {});
    toast(activo ? 'Pausado' : 'Activado', 'ok');
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Horario semanal ───────────────────────────────────────────

async function abrirModalHorario(id) {
  const cuentas = await get('/api/cuentas/');
  document.getElementById('horario-cuenta').innerHTML = cuentas
    .filter(c => c.tipo === 'debito')
    .map(c => `<option value="${c.id}">${c.nombre}</option>`)
    .join('');

  _DIAS_KEY.forEach(d => { document.getElementById(`horario-${d}`).value = ''; });

  if (id) {
    const lista = await get('/api/rendimientos-programados/horarios/');
    const h     = lista.find(x => x.id === id);
    document.getElementById('modal-horario-titulo').textContent = 'Editar horario personalizado';
    document.getElementById('horario-id').value                 = h.id;
    document.getElementById('horario-cuenta').value             = h.cuenta_id;
    _DIAS_KEY.forEach(d => {
      document.getElementById(`horario-${d}`).value = h[d] || '';
    });
  } else {
    document.getElementById('modal-horario-titulo').textContent = 'Horario personalizado';
    document.getElementById('horario-id').value                 = '';
  }
  document.getElementById('modal-horario').classList.add('abierto');
}

function cerrarModalHorario() {
  document.getElementById('modal-horario').classList.remove('abierto');
}

document.getElementById('modal-horario').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalHorario();
});

async function guardarHorario() {
  const id        = document.getElementById('horario-id').value;
  const cuenta_id = parseInt(document.getElementById('horario-cuenta').value);

  if (isNaN(cuenta_id)) { toast('Selecciona una cuenta', 'err'); return; }

  const cuerpo = { cuenta_id };
  _DIAS_KEY.forEach(d => {
    const v = parseFloat(document.getElementById(`horario-${d}`).value);
    cuerpo[d] = isNaN(v) || v <= 0 ? null : v;
  });

  const tieneAlgo = _DIAS_KEY.some(d => cuerpo[d]);
  if (!tieneAlgo) { toast('Ingresa al menos un monto', 'err'); return; }

  try {
    if (id) {
      await patch(`/api/rendimientos-programados/horarios/${id}`, cuerpo);
      toast('Horario actualizado', 'ok');
    } else {
      await post('/api/rendimientos-programados/horarios/', cuerpo);
      toast('Horario creado', 'ok');
    }
    cerrarModalHorario();
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarHorario(id) {
  if (!confirm('¿Eliminar este horario personalizado?\nLos rendimientos ya registrados permanecerán.')) return;
  try {
    await del(`/api/rendimientos-programados/horarios/${id}`);
    toast('Horario eliminado', 'ok');
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function toggleHorario(id, activo) {
  try {
    await patch(`/api/rendimientos-programados/horarios/${id}/toggle`, {});
    toast(activo ? 'Pausado' : 'Activado', 'ok');
    cargarRendimientosProgramados();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Metas de ahorro ───────────────────────────────────────────

function _iniciarIconPicker() {
  const grid = document.getElementById('meta-icono-grid');
  if (!grid || grid.children.length) return;
  grid.innerHTML = Object.keys(_META_ICONS_PATHS).map(k => `
    <button type="button" class="icono-btn" data-key="${k}"
      title="${_META_LABELS[k]}"
      onclick="_seleccionarIcono('${k}', this)">
      ${_metaIcono(k, 18)}
    </button>`).join('');
}

function _seleccionarIcono(key, btn) {
  document.querySelectorAll('#meta-icono-grid .icono-btn').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  document.getElementById('meta-icono').value = key;
}

function _setIconoActivo(key) {
  document.querySelectorAll('#meta-icono-grid .icono-btn').forEach(b => {
    b.classList.toggle('activo', b.dataset.key === key);
  });
  document.getElementById('meta-icono').value = key;
}

async function cargarMetas() {
  document.getElementById('lista-metas').innerHTML = _skeletonLista(2);
  const metas = await get('/api/metas/');
  const el    = document.getElementById('lista-metas');
  if (!metas.length) {
    el.innerHTML = '<div class="empty-state">Sin metas definidas</div>';
    return;
  }
  el.innerHTML = metas.map(m => {
    const pct   = m.monto_objetivo > 0
      ? Math.min(Math.round(m.monto_actual / m.monto_objetivo * 100), 100)
      : 0;
    const done  = m.monto_actual >= m.monto_objetivo;
    const cls   = done ? '' : pct >= 75 ? 'warn' : '';
    const color = done ? '#1D9E75' : pct >= 75 ? '#BA7517' : 'var(--text-muted)';
    return `
      <div class="cuenta-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="meta-badge">${_metaIcono(m.emoji || 'target', 18)}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div class="cuenta-nombre">${m.nombre}</div>
              <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                <span style="font-size:12px;color:${color};font-weight:500">
                  ${fmt(m.monto_actual)} / ${fmt(m.monto_objetivo)} (${pct}%)
                </span>
                <button class="btn-sm" onclick="abrirModalMeta(${m.id})">Editar</button>
                <button class="btn-sm btn-danger" onclick="eliminarMeta(${m.id}, ${JSON.stringify(m.nombre)})">Eliminar</button>
              </div>
            </div>
            <div class="progress-bar" style="margin-top:6px">
              <div class="progress-fill ${cls}" style="width:${pct}%;${done ? 'background:#1D9E75' : ''}"></div>
            </div>
            ${m.fecha_objetivo ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${fmtFecha(m.fecha_objetivo)}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function abrirModalMeta(id) {
  _iniciarIconPicker();
  if (id) {
    const metas = await get('/api/metas/');
    const m     = metas.find(x => x.id === id);
    document.getElementById('modal-meta-titulo').textContent = 'Editar meta';
    document.getElementById('meta-id').value       = m.id;
    document.getElementById('meta-nombre').value   = m.nombre;
    document.getElementById('meta-objetivo').value = m.monto_objetivo;
    document.getElementById('meta-actual').value   = m.monto_actual;
    document.getElementById('meta-fecha').value    = m.fecha_objetivo ? m.fecha_objetivo.split('T')[0] : '';
    _setIconoActivo(m.emoji || 'target');
  } else {
    document.getElementById('modal-meta-titulo').textContent = 'Nueva meta';
    document.getElementById('meta-id').value       = '';
    document.getElementById('meta-nombre').value   = '';
    document.getElementById('meta-objetivo').value = '';
    document.getElementById('meta-actual').value   = '';
    document.getElementById('meta-fecha').value    = '';
    _setIconoActivo('target');
  }
  document.getElementById('modal-meta').classList.add('abierto');
}

function cerrarModalMeta() {
  document.getElementById('modal-meta').classList.remove('abierto');
}

document.getElementById('modal-meta').addEventListener('click', function(e) {
  if (e.target === this) cerrarModalMeta();
});

async function guardarMeta() {
  const id             = document.getElementById('meta-id').value;
  const nombre         = document.getElementById('meta-nombre').value.trim();
  const emoji          = document.getElementById('meta-icono').value || 'target';
  const monto_objetivo = parseFloat(document.getElementById('meta-objetivo').value);
  const monto_actual   = parseFloat(document.getElementById('meta-actual').value) || 0;
  const fechaStr       = document.getElementById('meta-fecha').value;
  const fecha_objetivo = fechaStr ? new Date(fechaStr + 'T12:00:00').toISOString() : null;

  if (!nombre)                         { toast('El nombre es obligatorio', 'err'); return; }
  if (!monto_objetivo || monto_objetivo <= 0) { toast('El monto objetivo debe ser mayor a cero', 'err'); return; }

  const cuerpo = { nombre, emoji, monto_objetivo, monto_actual, fecha_objetivo };
  try {
    if (id) {
      await patch(`/api/metas/${id}`, cuerpo);
      toast('Meta actualizada', 'ok');
    } else {
      await post('/api/metas/', cuerpo);
      toast('Meta creada', 'ok');
    }
    cerrarModalMeta();
    cargarMetas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function eliminarMeta(id, nombre) {
  if (!confirm(`¿Eliminar la meta "${nombre}"?`)) return;
  try {
    await del(`/api/metas/${id}`);
    toast(`Meta "${nombre}" eliminada`, 'ok');
    cargarMetas();
  } catch (e) {
    toast(e.message, 'err');
  }
}

// ── Init ──────────────────────────────────────────────────────
cargarCategorias();
cargarPresupuestos();
cargarRecurrentes();
cargarRendimientosProgramados();
cargarMetas();
sincronizarBtnTema();
