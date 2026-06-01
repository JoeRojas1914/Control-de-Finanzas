function toast(mensaje, tipo = 'ok') {
  let contenedor = document.getElementById('toast-contenedor');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'toast-contenedor';
    document.body.appendChild(contenedor);
  }

  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensaje;
  contenedor.appendChild(el);

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast-visible')));

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3500);
}

// ── Modal de confirmación global ──────────────────────────────
let _confResolve = null;

function confirmar(pregunta, detalle = '', btnOk = 'Eliminar') {
  let modal = document.getElementById('modal-confirmar');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-confirmar';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px">
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </div>
          <div>
            <p id="conf-pregunta" style="font-size:15px;font-weight:600;color:var(--text);margin:0 0 6px"></p>
            <p id="conf-detalle"  style="font-size:13px;color:var(--text-muted);line-height:1.5;margin:0"></p>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn-sm" onclick="_rechazarConf()">Cancelar</button>
          <button class="btn-sm btn-danger" id="conf-btn-ok" onclick="_aceptarConf()">Eliminar</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) _rechazarConf(); });
    document.body.appendChild(modal);
  }

  document.getElementById('conf-pregunta').textContent = pregunta;
  document.getElementById('conf-detalle').textContent  = detalle;
  document.getElementById('conf-btn-ok').textContent   = btnOk;
  modal.classList.add('abierto');

  return new Promise(resolve => { _confResolve = resolve; });
}

function _aceptarConf() {
  document.getElementById('modal-confirmar').classList.remove('abierto');
  if (_confResolve) { _confResolve(true);  _confResolve = null; }
}

function _rechazarConf() {
  document.getElementById('modal-confirmar').classList.remove('abierto');
  if (_confResolve) { _confResolve(false); _confResolve = null; }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modal-confirmar')?.classList.contains('abierto')) {
    _rechazarConf();
  }
});
