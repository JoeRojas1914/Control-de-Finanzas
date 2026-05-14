function aplicarTema() {
  const oscuro = localStorage.getItem('tema') === 'oscuro';
  document.body.classList.toggle('dark', oscuro);
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = oscuro ? 'Claro' : 'Oscuro';
}

function toggleTema() {
  const oscuro = localStorage.getItem('tema') === 'oscuro';
  localStorage.setItem('tema', oscuro ? 'claro' : 'oscuro');
  aplicarTema();
}

aplicarTema();