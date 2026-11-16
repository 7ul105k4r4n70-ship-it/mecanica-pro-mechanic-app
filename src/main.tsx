import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    }).catch(() => {});
  }
  window.addEventListener('vite:preloadError', () => {
    const last = sessionStorage.getItem('mec_app_chunk_reload');
    if (!last || Date.now() - parseInt(last, 10) > 10000) {
      sessionStorage.setItem('mec_app_chunk_reload', String(Date.now()));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
