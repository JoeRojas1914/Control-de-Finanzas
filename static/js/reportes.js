const oscuro     = document.documentElement.classList.contains('dark');
const colorTexto = '#888888';
const colorGrid  = oscuro ? '#2e2e2e' : '#f0f0ee';

Chart.defaults.color = colorTexto;

const COLORES = [
  '#1D9E75', '#534AB7', '#D85A30', '#378ADD',
  '#BA7517', '#D4537E', '#639922', '#888780'
];

async function cargarGraficas() {
  await Promise.all([
    cargarResumenMes(),
    cargarGastosPorCategoria(),
    cargarPresupuestosReporte(),
    cargarIngresosVsGastos(),
    cargarPatrimonioHistorico(),
    cargarRendimientosMes(),
  ]);
}

async function cargarPresupuestosReporte() {
  const lista = await get('/api/presupuestos/');
  const card  = document.getElementById('card-presupuestos');
  if (!lista.length) { card.style.display = 'none'; return; }

  card.style.display = 'block';
  document.getElementById('lista-pres-reportes').innerHTML = lista.map(p => {
    const pct   = Math.min(p.porcentaje, 100);
    const cls   = p.porcentaje >= 100 ? 'over' : p.porcentaje >= 80 ? 'warn' : '';
    const color = p.porcentaje >= 100 ? '#a32d2d' : p.porcentaje >= 80 ? '#BA7517' : 'var(--text-muted)';
    return `
      <div class="cuenta-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="cuenta-nombre">${p.categoria}</span>
          <span style="font-size:12px;color:${color};font-weight:500">
            ${fmt(p.gastado)} / ${fmt(p.monto_limite)}
            (${p.porcentaje}%)
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

async function cargarResumenMes() {
  const d = await get('/api/reportes/resumen-mes');

  const balance = d.balance;
  document.getElementById('kpi-ingresos').textContent = fmt(d.ingresos);
  document.getElementById('kpi-gastos').textContent   = fmt(d.gastos);

  const elBalance = document.getElementById('kpi-balance');
  elBalance.textContent = fmt(balance);
  elBalance.className   = 'metric-value ' + (balance >= 0 ? 'green' : 'red');

  document.getElementById('kpi-ahorro').textContent = d.tasa_ahorro + '%';

  // Top 5 gastos
  const topEl = document.getElementById('top-gastos');
  if (!d.top_gastos.length) {
    topEl.innerHTML = '<div class="empty-state">Sin gastos este mes</div>';
  } else {
    topEl.innerHTML = d.top_gastos.map((g, i) => `
      <div class="cuenta-row">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="cuenta-badge" style="width:24px;height:24px;font-size:11px;background:${COLORES[i]}">${i + 1}</div>
          <div class="cuenta-info">
            <div class="cuenta-nombre">${g.descripcion}</div>
            <div style="font-size:12px;color:var(--text-muted)">${g.categoria}</div>
          </div>
        </div>
        <div class="monto-neg" style="font-weight:500">${fmt(g.monto)}</div>
      </div>`).join('');
  }

  // Estadísticas extra
  const variacionHtml = d.variacion_gastos === null
    ? '<span style="color:var(--text-muted)">Sin datos del mes anterior</span>'
    : (() => {
        const v   = d.variacion_gastos;
        const cls = v > 0 ? 'red' : 'green';
        const pfx = v > 0 ? '▲' : '▼';
        return `<span class="${cls}">${pfx} ${Math.abs(v)}% vs mes anterior</span>`;
      })();

  document.getElementById('stats-extra').innerHTML = `
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Gasto promedio diario</div></div>
      <div class="monto-neg" style="font-weight:500">${fmt(d.gasto_diario_prom)}</div>
    </div>
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Variación de gastos</div></div>
      <div style="font-size:13px;font-weight:500">${variacionHtml}</div>
    </div>
    <div class="cuenta-row">
      <div class="cuenta-info"><div class="cuenta-nombre">Días del mes transcurridos</div></div>
      <div style="font-size:13px;color:var(--text-muted)">${new Date().getDate()} de ${new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()}</div>
    </div>
  `;
}

async function cargarGastosPorCategoria() {
  const datos = await get('/api/reportes/gastos-por-categoria');

  if (datos.length === 0) {
    document.getElementById('grafica-categorias').style.display = 'none';
    document.getElementById('sin-gastos').style.display = 'block';
    return;
  }

  new Chart(document.getElementById('grafica-categorias'), {
    type: 'doughnut',
    data: {
      labels: datos.map(d => d.categoria),
      datasets: [{
        data: datos.map(d => d.total),
        backgroundColor: COLORES.slice(0, datos.length),
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.parsed)
          }
        }
      }
    }
  });
}

async function cargarIngresosVsGastos() {
  const datos = await get('/api/reportes/ingresos-vs-gastos');

  new Chart(document.getElementById('grafica-ingresos-gastos'), {
    type: 'bar',
    data: {
      labels: datos.map(d => d.mes),
      datasets: [
        {
          label: 'Ingresos',
          data: datos.map(d => d.ingresos),
          backgroundColor: 'rgba(29, 158, 117, 0.75)',
          borderRadius: 4,
        },
        {
          label: 'Gastos',
          data: datos.map(d => d.gastos),
          backgroundColor: 'rgba(216, 90, 48, 0.75)',
          borderRadius: 4,
        }
      ]
    },
    options: {
      scales: {
        y: {
          ticks: { callback: val => fmt(val), font: { size: 11 } },
          grid: { color: colorGrid }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } }
      }
    }
  });
}

async function cargarPatrimonioHistorico() {
  const datos = await get('/api/reportes/patrimonio-historico');

  new Chart(document.getElementById('grafica-patrimonio'), {
    type: 'line',
    data: {
      labels: datos.map(d => d.fecha),
      datasets: [{
        label: 'Patrimonio',
        data: datos.map(d => d.saldo),
        borderColor: '#1D9E75',
        backgroundColor: 'rgba(29, 158, 117, 0.08)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          ticks: {
            callback: val => fmt(val),
            font: { size: 11 }
          },
          grid: { color: colorGrid }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.parsed.y)
          }
        }
      }
    }
  });
}

async function cargarRendimientosMes() {
  const cuentas    = await get('/api/cuentas/');
  const debito     = cuentas.filter(c => c.tipo === 'debito');
  const contenedor = document.getElementById('tabla-rendimientos');

  const filas = await Promise.all(debito.map(async c => {
    const r = await get('/api/cuentas/' + c.id + '/rendimientos');
    return { nombre: c.nombre, ...r };
  }));

  const total = filas.reduce((acc, f) => acc + f.mensual, 0);

  contenedor.innerHTML = `
    <table class="tabla">
      <thead>
        <tr>
          <th>Cuenta</th>
          <th>Hoy</th>
          <th>Este mes</th>
          <th>Este año</th>
        </tr>
      </thead>
      <tbody>
        ${filas.map(f => `
          <tr>
            <td>${f.nombre}</td>
            <td class="monto-pos">${fmt(f.diario)}</td>
            <td class="monto-pos">${fmt(f.mensual)}</td>
            <td class="monto-pos">${fmt(f.anual)}</td>
          </tr>
        `).join('')}
        <tr style="font-weight:500;border-top:2px solid #e8e8e5">
          <td>Total</td>
          <td></td>
          <td class="monto-pos">${fmt(total)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

cargarGraficas();