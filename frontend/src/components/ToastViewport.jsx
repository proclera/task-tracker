import { useToast } from '../context/ToastContext';

const toastStyles = {
  success: {
    borderColor: 'rgba(35, 132, 67, 0.28)',
    background: 'linear-gradient(135deg, rgba(233, 255, 240, 0.96), rgba(214, 245, 223, 0.92))',
    color: '#1d5f32'
  },
  error: {
    borderColor: 'rgba(190, 53, 53, 0.24)',
    background: 'linear-gradient(135deg, rgba(255, 237, 237, 0.96), rgba(255, 222, 222, 0.92))',
    color: '#8b2323'
  },
  info: {
    borderColor: 'rgba(30, 98, 191, 0.24)',
    background: 'linear-gradient(135deg, rgba(237, 245, 255, 0.96), rgba(222, 236, 255, 0.92))',
    color: '#184f9b'
  }
};

export const ToastViewport = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div style={styles.viewport}>
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          style={{ ...styles.toast, ...(toastStyles[toast.type] || toastStyles.info) }}
        >
          <span style={styles.toastType}>{toast.type}</span>
          <span>{toast.message}</span>
        </button>
      ))}
    </div>
  );
};

const styles = {
  viewport: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '360px'
  },
  toast: {
    border: '1px solid',
    borderRadius: '18px',
    padding: '14px 16px',
    boxShadow: '0 16px 44px rgba(22, 30, 54, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)'
  },
  toastType: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
    opacity: 0.72
  }
};
