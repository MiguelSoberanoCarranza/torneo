import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './Router';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
