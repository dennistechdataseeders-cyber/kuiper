import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';
import './index.css';
import { SidebarProvider } from './context/SidebarContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
// Global Axios Interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const blocked = error.response.data?.code === 'ACCOUNT_BLOCKED';
      localStorage.clear();
      // Use window.location for a hard reset to clear all state
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = blocked ? '/login?blocked=1' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

// After a deploy, a tab opened earlier may ask for a lazy page chunk that no longer exists.
// Reload once to pick up the new build (the flag stops reload loops).
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('chunkReloaded') === '1') return;
    sessionStorage.setItem('chunkReloaded', '1');
  } catch { /* storage unavailable: still reload once */ }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => {
  try { setTimeout(() => sessionStorage.removeItem('chunkReloaded'), 10000); } catch { /* ignore */ }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
     <ErrorBoundary> 
   <SidebarProvider>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#fff',
            fontWeight: 'bold',
            borderRadius: '12px',
          },
        }}
      />
    </SidebarProvider>
    </ErrorBoundary>
  </React.StrictMode>
);