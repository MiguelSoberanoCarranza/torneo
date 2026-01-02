import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './Router';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  </React.StrictMode>
);
