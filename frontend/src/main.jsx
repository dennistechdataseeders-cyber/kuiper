import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import axios from 'axios';
import './index.css';
import { SidebarProvider } from './context/SidebarContext';
import { Toaster } from 'react-hot-toast';

// Global Axios Interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.clear();
      // Use window.location for a hard reset to clear all state
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
);