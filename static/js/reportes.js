const oscuro = document.body.classList.contains('dark');
const colorTexto = oscuro ? '#888888' : '#888888';
const colorGrid  = oscuro ? '#2e2e2e' : '#f0f0ee';

Chart.defaults.color = colorTexto;

const COLORES = [
  '#1D9E75', '#534AB7', '#D85A30', '#378ADD',
  '#BA7517', '#D4537E', '#639922', '#888780'
];

async function cargarGraficas() {
  await cargarGastosPorCategoria();
  await cargarPatrimonioHistorico();
  await cargarRendimientosMes();
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