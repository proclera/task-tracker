import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { DesktopOnlyGate } from './components/DesktopOnlyGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppErrorBoundary>
        <DesktopOnlyGate>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </DesktopOnlyGate>
      </AppErrorBoundary>
    </HashRouter>
  </React.StrictMode>
);
