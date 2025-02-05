// Referencia al botón
const toggleDarkModeButton = document.getElementById('toggleDarkMode');

// 1) Detectar si el usuario ya forzó una preferencia (localStorage)
let userPref = localStorage.getItem('user-dark-mode'); 
// Valores posibles: "dark", "light", o null si nunca se guardó

// 2) Detectar preferencia del sistema
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

// 3) Función para aplicar modo oscuro/claro según la preferencia
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add('dark-mode');
    toggleDarkModeButton.textContent = 'Modo Claro';
  } else {
    document.body.classList.remove('dark-mode');
    toggleDarkModeButton.textContent = 'Modo Oscuro';
  }
}

// 4) Lógica inicial al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  if (userPref === 'dark') {
    applyDarkMode(true);
  } else if (userPref === 'light') {
    applyDarkMode(false);
  } else {
    // Si no hay preferencia del usuario, usa la del sistema
    applyDarkMode(systemPrefersDark.matches);
  }
});

// 5) Escuchar cambios del sistema (si el usuario no ha forzado una preferencia)
systemPrefersDark.addEventListener('change', (e) => {
  // Solo se aplica si no hay preferencia manual
  userPref = localStorage.getItem('user-dark-mode');
  if (!userPref) {
    applyDarkMode(e.matches);
  }
});

// 6) Manejar el clic en el botón
toggleDarkModeButton.addEventListener('click', () => {
  // Verificar el estado actual
  const isDark = document.body.classList.contains('dark-mode');
  // Cambiar al opuesto
  applyDarkMode(!isDark);
  
  // Guardar la preferencia del usuario en localStorage
  localStorage.setItem('user-dark-mode', isDark ? 'light' : 'dark');
});
