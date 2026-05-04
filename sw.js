self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalado');
});

self.addEventListener('fetch', (e) => {
  // Este archivo se deja básico. 
  // Solo con existir, Chrome habilita la opción de "Instalar App".
});
