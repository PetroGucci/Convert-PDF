// Referencia al botón
const toggleDarkModeButton = document.getElementById('toggleDarkMode');

// 1) Detectar si el usuario ya forzó una preferencia (localStorage)
let userPref = localStorage.getItem('user-dark-mode'); 
// Valores posibles: "dark", "light", o null si nunca se guardó

// 2) Detectar preferencia del sistema
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

// Función para actualizar las imágenes según el modo
function updateImages(isDark) {
  const convertImageLogo = document.getElementById('convertImageLogo');
  const editorImagelogo = document.getElementById('editorImagelogo');

  if (convertImageLogo) {
    convertImageLogo.src = isDark ? './img/convert_dark.png' : './img/convert_light.png'; 
  }

  if (editorImagelogo) {
    editorImagelogo.src = isDark ? './img/editor_dark.png' : './img/editor_light.png';
  }
}

// 3) Función para aplicar modo oscuro/claro según la preferencia
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add('dark-mode');
    toggleDarkModeButton.textContent = 'Modo Claro';
  } else {
    document.body.classList.remove('dark-mode');
    toggleDarkModeButton.textContent = 'Modo Oscuro';
  }
  updateImages(isDark);
}

// 4) Lógica inicial al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  const isDark = userPref === 'dark' || (!userPref && systemPrefersDark.matches);
  applyDarkMode(isDark);
});

// 5) Escuchar cambios del sistema (si el usuario no ha forzado una preferencia)
systemPrefersDark.addEventListener('change', (e) => {
  userPref = localStorage.getItem('user-dark-mode');
  if (!userPref) {
    applyDarkMode(e.matches);
  }
});

// 6) Manejar el clic en el botón
toggleDarkModeButton.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  applyDarkMode(!isDark);
  localStorage.setItem('user-dark-mode', isDark ? 'light' : 'dark');
});