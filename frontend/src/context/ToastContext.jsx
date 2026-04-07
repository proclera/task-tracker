import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts((currentToasts) => [...currentToasts, { id, message, type }]);
    window.setTimeout(() => dismissToast(id), 3200);
  }, [dismissToast]);

  const value = useMemo(() => ({
    showToast,
    dismissToast,
    toasts
  }), [dismissToast, showToast, toasts]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
};
