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
