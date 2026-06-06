// ── Tema y colores ────────────────────────────────────────────
const oscuro     = document.documentElement.classList.contains('dark');
const colorGrid  = oscuro ? '#1e2130' : '#f1f5f9';
Chart.defaults.color = oscuro ? '#64748b' : '#94a3b8';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

const COLORES = ['#6366f1','#10b981','#f59e0b','#ef4444','#0ea5e9','#8b5cf6','#ec4899','#64748b'];

// ── Estado global ─────────────────────────────────────────────
let _selAño = new Date().getFullYear();
let _selMes = new Date().getMonth() + 1;
let _selAñoAnual = new Date().getFullYear();
let _charts = {};
let _anualCargado = false;
let _rendimientosGraf = [];
let _debitoIds        = new Set();

// ── Helpers ───────────────────────────────────────────────────
function _destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); _charts[key] = null; }
}

function _buildSelectorMeses(periodos) {
  if (!periodos.length) return '<option value="">Sin datos</option>';
  return periodos.map(p => {
    const lbl = new Date(p.año, p.mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const sel = p.año === _selAño && p.mes === _selMes;
    return `<option value="${p.año}-${p.mes}" ${sel ? 'selected' : ''}>${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</option>`;
  }).join('');
}

function _buildSelectorAños(años) {
  if (!años.length) return '<option value="">Sin datos</option>';
  return años.map(a =>
    `<option value="${a}" ${a === _selAñoAnual ? 'selected' : ''}>${a}</option>`
  ).join('');
}

function _labelMes(año, mes) {
  return new Date(año, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// ── Privacidad ────────────────────────────────────────────────
const _SVG_OJO = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _SVG_OJO_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePrivacidad() {
  const activo = document.documentElement.classList.toggle('privado');
  localStorage.setItem('privacidad', activo ? '1' : '0');
  const btn = document.getElementById('btn-privacidad');
  btn.innerHTML = activo ? _SVG_OJO_OFF : _SVG_OJO;
  btn.title = activo ? 'Mostrar montos' : 'Ocultar montos';
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(tab) {
  _tabActual = tab;
  document.getElementById('tab-mensual').style.display = tab === 'mensual' ? '' : 'none';
  document.getElementById('tab-anual').style.display   = tab === 'anual'   ? '' : 'none';
  document.getElementById('tab-btn-mensual').classList.toggle('active', tab === 'mensual');
  document.getElementById('tab-btn-anual').classList.toggle('active', tab === 'anual');

  if (tab === 'anual' && !_anualCargado) {
    _anualCargado = true;
    cargarIngresosVsGastos(_selAñoAnual);
  }
}

// ── Selector de mes ───────────────────────────────────────────
async function cambiarMes() {
  const [año, mes] = document.getElementById('mes-selector').value.split('-').map(Number);
  _selAño = año;
  _selMes = mes;
  const lbl = _labelMes(año, mes).charAt(0).toUpperCase() + _labelMes(año, mes).slice(1);
  document.getElementById('titulo-categorias').textContent  = `Gastos por categoría — ${lbl}`;
  document.getElementById('titulo-top-gastos').textContent  = `Top 5 gastos — ${lbl}`;
  await Promise.all([
    cargarResumenMes(año, mes),
    cargarGastosPorCategoria(año, mes),
  ]);
  _renderGraficaRend();
}

// ── Selector de año ───────────────────────────────────────────
async function cambiarAño() {
  _selAñoAnual = parseInt(document.getElementById('año-selector').value);
  document.getElementById('titulo-ing-gastos').textContent = `Ingresos vs gastos — ${_selAñoAnual}`;
  _destroyChart('ingresosGastos');
  await cargarIngresosVsGastos(_selAñoAnual);
}

// ── Dashboard base ────────────────────────────────────────────
async function cargarDatosDashboard() {
  ['kpi-patrimonio','kpi-deuda'].forEach(_skeletonKpi);
  document.getElementById('lista-cuentas-dash').innerHTML = _skeletonLista(2);

  const resultado = await post('/api/recurrentes/aplicar', {});
  if (resultado?.aplicadas > 0)
    toast(`${resultado.aplicadas} transacción(es) recurrente(s) aplicada(s)`, 'ok');

  const resultadoRend = await post('/api/rendimientos-programados/aplicar', {});
  if (resultadoRend?.aplicados > 0)
    toast(`${resultadoRend.aplicados} rendimiento(s) aplicado(s)`, 'ok');

  const [data, cuentas] = await Promise.all([
    get('/api/dashboard/'),
    get('/api/cuentas/'),
  ]);

  document.getElementById('kpi-patrimonio').textContent = fmt(data.patrimonio);
  document.getElementById('kpi-deuda').textContent      = fmt(data.deuda_tarjeta);

  const debito = cuentas.filter(c => c.tipo === 'debito');
  document.getElementById('lista-cuentas-dash').innerHTML = debito.length
    ? debito.map(c => `
        <div class="cuenta-row">
          <div class="cuenta-badge">${c.nombre.slice(0, 2).toUpperCase()}</div>
          <div class="cuenta-info">
            <div class="cuenta-nombre">${c.nombre}</div>
            <div class="cuenta-tipo">Débito</div>
          </div>
          <div class="cuenta-saldo">${fmt(c.saldo)}</div>
        </div>`).join('')
    : '<div class="empty-state">Sin cuentas de débito</div>';

}

// ── Resumen mensual ───────────────────────────────────────────
async function cargarResumenMes(año = _selAño, mes = _selMes) {
  ['kpi-ingresos','kpi-gastos','kpi-balance','kpi-ahorro'].forEach(_skeletonKpi);
  document.getElementById('top-gastos').innerHTML  = _skeletonLista(3);
  document.getElementById('stats-extra').innerHTML = _skeletonLista(3);

  const d = await get(`/api/reportes/resumen-mes?año=${año}&mes=${mes}`);

  document.getElementById('kpi-ingresos').textContent = fmt(d.ingresos);
  document.getElementById('kpi-gastos').textContent   = fmt(d.gastos);

  const elBalance = document.getElementById('kpi-balance');
  elBalance.textContent = fmt(d.balance);
  elBalance.className   = 'metric-value ' + (d.balance >= 0 ? 'green' : 'red');

  document.getElementById('kpi-ahorro').textContent = d.tasa_ahorro + '%';

  // Top 5 gastos
  const topEl = document.getElementById('top-gastos');
  topEl.innerHTML = d.top_gastos.length
    ? d.top_gastos.map((g, i) => `
        <div class="cuenta-row">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <div class="cuenta-badge" style="width:24px;height:24px;font-size:11px;background:${COLORES[i]};flex-shrink:0">${i + 1}</div>
            <div class="cuenta-info">
              <div class="cuenta-nombre">${g.descripcion}</div>
              <div style="font-size:12px;color:var(--text-muted)">${g.categoria}</div>
            </div>
          </div>
          <div class="monto-neg" style="font-weight:600;flex-shrink:0">${fmt(g.monto)}</div>
        </div>`).join('')
    : '<div class="empty-state">Sin gastos este período</div>';

  // Estadísticas
  const variacionHtml = d.variacion_gastos === null
    ? '<span style="color:var(--text-muted)">Sin datos del mes anterior</span>'
    : (() => {
        const v = d.variacion_gastos;
        return `<span class="${v > 0 ? 'monto-neg' : 'monto-pos'}">${v > 0 ? '▲' : '▼'} ${Math.abs(v)}% vs mes anterior</span>`;
      })();

  const esMesActual = año === new Date().getFullYear() && mes === new Date().getMonth() + 1;
  const diasLabel   = esMesActual
    ? `${d.dias_transcurridos} de ${d.dias_mes} días`
    : `Mes completo (${d.dias_mes} días)`;

  document.getElementById('stats-extra').innerHTML = `
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Gasto promedio diario</div></div>
      <div class="monto-neg" style="font-weight:600">${fmt(d.gasto_diario_prom)}</div>
    </div>
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Variación de gastos</div></div>
      <div style="font-size:13px;font-weight:500">${variacionHtml}</div>
    </div>
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Período</div></div>
      <div style="font-size:13px;color:var(--text-muted)">${diasLabel}</div>
    </div>
  `;
}

// ── Gastos por categoría ──────────────────────────────────────
async function cargarGastosPorCategoria(año = _selAño, mes = _selMes) {
  _destroyChart('categoria');
  const canvas  = document.getElementById('grafica-categorias');
  const sinGast = document.getElementById('sin-gastos');
  canvas.style.display   = 'block';
  sinGast.style.display  = 'none';

  const datos = await get(`/api/reportes/gastos-por-categoria?año=${año}&mes=${mes}`);

  if (!datos.length) {
    canvas.style.display  = 'none';
    sinGast.style.display = 'block';
    return;
  }

  _charts.categoria = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: datos.map(d => d.categoria),
      datasets: [{
        data: datos.map(d => d.total),
        backgroundColor: COLORES.slice(0, datos.length),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16, boxWidth: 12, borderRadius: 4 } },
        tooltip: { callbacks: { label: ctx => '  ' + fmt(ctx.parsed) } },
      },
    },
  });
}

// ── Presupuestos ──────────────────────────────────────────────
async function cargarPresupuestosReporte() {
  document.getElementById('lista-pres-reportes').innerHTML = _skeletonLista(2);
  const lista = await get('/api/presupuestos/');
  const card  = document.getElementById('card-presupuestos');
  if (!lista.length) { card.style.display = 'none'; return; }

  card.style.display = 'block';
  document.getElementById('lista-pres-reportes').innerHTML = lista.map(p => {
    const pct   = Math.min(p.porcentaje, 100);
    const cls   = p.porcentaje >= 100 ? 'over' : p.porcentaje >= 80 ? 'warn' : '';
    const color = p.porcentaje >= 100 ? '#ef4444' : p.porcentaje >= 80 ? '#f59e0b' : 'var(--text-muted)';
    return `
      <div class="cuenta-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="cuenta-nombre">${p.categoria}</span>
          <span style="font-size:12px;color:${color};font-weight:500">${fmt(p.gastado)} / ${fmt(p.monto_limite)} (${p.porcentaje}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// ── Metas ─────────────────────────────────────────────────────
async function cargarMetasDash() {
  const metas = await get('/api/metas/');
  const card  = document.getElementById('card-metas');
  if (!metas.length) { card.style.display = 'none'; return; }

  card.style.display = 'block';
  document.getElementById('lista-metas-dash').innerHTML = metas.map(m => {
    const pct  = m.monto_objetivo > 0 ? Math.min(Math.round(m.monto_actual / m.monto_objetivo * 100), 100) : 0;
    const done = m.monto_actual >= m.monto_objetivo;

    let nota = '';
    if (done) {
      nota = '<span style="color:#10b981;font-weight:500">¡Meta alcanzada!</span>';
    } else if (m.fecha_objetivo) {
      const dias = Math.ceil((new Date(m.fecha_objetivo) - new Date()) / 86400000);
      nota = dias > 0
        ? `${dias} días restantes · necesitas ${fmt((m.monto_objetivo - m.monto_actual) / dias)}/día`
        : '<span style="color:#ef4444">Fecha límite vencida</span>';
    }

    return `
      <div class="cuenta-row" style="align-items:flex-start;gap:10px">
        <div class="meta-badge">${_metaIcono(m.emoji || 'target', 18)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span class="cuenta-nombre">${m.nombre}</span>
            <span style="font-size:12px;color:var(--accent);font-weight:500;flex-shrink:0">${fmt(m.monto_actual)} / ${fmt(m.monto_objetivo)} (${pct}%)</span>
          </div>
          <div class="progress-bar" style="margin-top:6px">
            <div class="progress-fill" style="width:${pct}%;background:${done ? '#10b981' : 'var(--accent)'}"></div>
          </div>
          ${nota ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${nota}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Rendimientos ──────────────────────────────────────────────
async function cargarRendimientosMes() {
  document.getElementById('tabla-rendimientos').innerHTML = `
    <table class="tabla">
      <thead><tr><th>Cuenta</th><th>Hoy</th><th>Este mes</th><th>Este año</th></tr></thead>
      <tbody>${_skeletonTabla(3, 4)}</tbody>
    </table>`;

  const cuentas = await get('/api/cuentas/');
  const debito  = cuentas.filter(c => c.tipo === 'debito');

  const filas = await Promise.all(debito.map(async c => {
    const r = await get(`/api/cuentas/${c.id}/rendimientos`);
    return { nombre: c.nombre, ...r };
  }));

  const total = filas.reduce((acc, f) => acc + f.mensual, 0);

  document.getElementById('tabla-rendimientos').innerHTML = `
    <table class="tabla">
      <thead><tr><th>Cuenta</th><th style="text-align:right">Este mes</th></tr></thead>
      <tbody>
        ${filas.map(f => `
          <tr>
            <td>${f.nombre}</td>
            <td class="monto-pos" style="text-align:right">+${fmt(f.mensual)}</td>
          </tr>`).join('')}
        <tr style="font-weight:600;border-top:2px solid var(--border)">
          <td>Total</td>
          <td class="monto-pos" style="text-align:right">+${fmt(total)}</td>
        </tr>
      </tbody>
    </table>`;
}

// ── Ingresos vs Gastos (tab anual) ────────────────────────────
async function cargarIngresosVsGastos(año = _selAñoAnual) {
  const datos = await get(`/api/reportes/ingresos-vs-gastos?año=${año}`);

  const totalIng  = datos.reduce((s, d) => s + d.ingresos, 0);
  const totalGast = datos.reduce((s, d) => s + d.gastos, 0);
  const balance   = totalIng - totalGast;

  document.getElementById('anual-ingresos').textContent = fmt(totalIng);
  document.getElementById('anual-gastos').textContent   = fmt(totalGast);
  const elBal = document.getElementById('anual-balance');
  elBal.textContent = fmt(balance);
  elBal.className   = 'metric-value ' + (balance >= 0 ? 'green' : 'red');

  _destroyChart('ingresosGastos');
  _charts.ingresosGastos = new Chart(document.getElementById('grafica-ingresos-gastos'), {
    type: 'bar',
    data: {
      labels: datos.map(d => d.mes),
      datasets: [
        {
          label: 'Ingresos',
          data: datos.map(d => d.ingresos),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 6,
        },
        {
          label: 'Gastos',
          data: datos.map(d => d.gastos),
          backgroundColor: 'rgba(239,68,68,0.7)',
          borderRadius: 6,
        },
      ],
    },
    options: {
      scales: {
        y: {
          ticks: { callback: val => fmt(val), font: { size: 11 } },
          grid: { color: colorGrid },
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16, boxWidth: 12, borderRadius: 4 } },
        tooltip: { callbacks: { label: ctx => '  ' + fmt(ctx.parsed.y) } },
      },
    },
  });
}

// ── Patrimonio ────────────────────────────────────────────────
async function cargarPatrimonioHistorico() {
  _destroyChart('patrimonio');
  const datos = await get('/api/reportes/patrimonio-historico');

  _charts.patrimonio = new Chart(document.getElementById('grafica-patrimonio'), {
    type: 'line',
    data: {
      labels: datos.map(d => d.fecha),
      datasets: [{
        label: 'Patrimonio',
        data: datos.map(d => d.saldo),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      scales: {
        y: {
          ticks: { callback: val => fmt(val), font: { size: 11 } },
          grid: { color: colorGrid },
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => '  ' + fmt(ctx.parsed.y) } },
      },
    },
  });
}

// ── Gráfica de rendimientos ───────────────────────────────────
async function cargarGraficaRendimientos() {
  const [cuentas, rends] = await Promise.all([
    get('/api/cuentas/'),
    get('/api/rendimientos/?limite=5000'),
  ]);

  const debito = (Array.isArray(cuentas) ? cuentas : []).filter(c => c.tipo === 'debito');
  _debitoIds        = new Set(debito.map(c => c.id));
  _rendimientosGraf = Array.isArray(rends) ? rends : [];

  document.getElementById('rend-graf-cuenta').innerHTML =
    '<option value="">Todas las cuentas</option>' +
    debito.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');


  _renderGraficaRend();
}

function filtrarGraficaRend() {
  _renderGraficaRend();
}

function _renderGraficaRend() {
  const cuentaId = parseInt(document.getElementById('rend-graf-cuenta').value) || null;

  // Solo cuentas débito; filtrar por cuenta seleccionada si aplica
  let datos = _rendimientosGraf.filter(r => _debitoIds.has(r.cuenta_id));
  if (cuentaId) datos = datos.filter(r => r.cuenta_id === cuentaId);

  // Solo el mes seleccionado en el selector del reporte
  const mesStr = `${_selAño}-${String(_selMes).padStart(2, '0')}`;
  datos = datos.filter(r => (r.fecha || '').startsWith(mesStr));

  // Agrupar por día
  const byDia = {};
  datos.forEach(r => {
    const dia = (r.fecha || '').slice(0, 10);
    if (dia) byDia[dia] = (byDia[dia] || 0) + r.monto;
  });

  const canvas = document.getElementById('grafica-rendimientos');
  const empty  = document.getElementById('rend-graf-empty');

  _destroyChart('rendimientos');

  const totalMes = Object.values(byDia).reduce((s, v) => s + v, 0);
  if (!totalMes) {
    canvas.style.display = 'none';
    empty.style.display  = '';
    return;
  }
  canvas.style.display = '';
  empty.style.display  = 'none';

  // Generar todos los días del mes hasta hoy (o fin de mes si es pasado)
  const hoy       = new Date();
  const esMesAct  = _selAño === hoy.getFullYear() && _selMes === (hoy.getMonth() + 1);
  const ultimoDia = esMesAct ? hoy.getDate() : new Date(_selAño, _selMes, 0).getDate();

  const labels     = [];
  const acumulados = [];
  let acum = 0;

  for (let d = 1; d <= ultimoDia; d++) {
    const dStr = `${mesStr}-${String(d).padStart(2, '0')}`;
    acum += byDia[dStr] || 0;
    labels.push(String(d));
    acumulados.push(+acum.toFixed(2));
  }

  _charts.rendimientos = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rendimientos acumulados',
        data: acumulados,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      scales: {
        y: {
          ticks: { callback: val => fmt(val), font: { size: 11 } },
          grid: { color: colorGrid },
        },
        x: {
          ticks: { font: { size: 11 }, maxTicksLimit: 15 },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ctx => `Día ${ctx[0].label} — ${new Date(_selAño, _selMes - 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`,
            label: ctx => '  Acumulado: +' + fmt(ctx.parsed.y),
          },
        },
      },
    },
  });
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  // Cargar períodos con datos para construir selectores
  const [meses, años] = await Promise.all([
    get('/api/reportes/meses-con-datos'),
    get('/api/reportes/años-con-datos'),
  ]);

  // Si el mes actual no tiene datos, usar el más reciente que sí los tenga
  if (meses.length && !meses.some(p => p.año === _selAño && p.mes === _selMes)) {
    _selAño = meses[0].año;
    _selMes = meses[0].mes;
  }
  if (años.length && !años.includes(_selAñoAnual)) {
    _selAñoAnual = años[0];
  }

  document.getElementById('mes-selector').innerHTML = _buildSelectorMeses(meses);
  document.getElementById('año-selector').innerHTML = _buildSelectorAños(años);

  // Títulos iniciales
  const lbl = _labelMes(_selAño, _selMes);
  const lblCap = lbl.charAt(0).toUpperCase() + lbl.slice(1);
  document.getElementById('titulo-categorias').textContent = `Gastos por categoría — ${lblCap}`;
  document.getElementById('titulo-top-gastos').textContent = `Top 5 gastos — ${lblCap}`;
  document.getElementById('titulo-ing-gastos').textContent = `Ingresos vs gastos — ${_selAñoAnual}`;

  await Promise.all([
    cargarDatosDashboard(),
    cargarResumenMes(),
    cargarGastosPorCategoria(),
    cargarPresupuestosReporte(),
    cargarRendimientosMes(),
    cargarMetasDash(),
    cargarPatrimonioHistorico(),
    cargarGraficaRendimientos(),
  ]);
}

init();

// Sincronizar ícono si ya estaba en modo privado al cargar
if (document.documentElement.classList.contains('privado')) {
  const btn = document.getElementById('btn-privacidad');
  if (btn) { btn.innerHTML = _SVG_OJO_OFF; btn.title = 'Mostrar montos'; }
}
