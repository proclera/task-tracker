import { useEffect, useMemo, useState } from 'react';

const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

const isDesktopOnlyEnabled = () => (import.meta.env.VITE_DESKTOP_ONLY_MODE || 'true') !== 'false';

const detectMobileLikeDevice = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isMobileUa = MOBILE_UA_PATTERN.test(ua);
  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const hasManyTouchPoints = (navigator.maxTouchPoints || 0) > 0;
  const narrowViewport = window.innerWidth < 900;

  return isMobileUa || (hasCoarsePointer && hasManyTouchPoints && narrowViewport);
};

export const DesktopOnlyGate = ({ children }) => {
  const desktopOnlyEnabled = useMemo(isDesktopOnlyEnabled, []);
  const [blocked, setBlocked] = useState(() => desktopOnlyEnabled && detectMobileLikeDevice());

  useEffect(() => {
    if (!desktopOnlyEnabled) {
      setBlocked(false);
      return undefined;
    }

    const updateBlockState = () => {
      setBlocked(detectMobileLikeDevice());
    };

    window.addEventListener('resize', updateBlockState);
    window.addEventListener('orientationchange', updateBlockState);

    return () => {
      window.removeEventListener('resize', updateBlockState);
      window.removeEventListener('orientationchange', updateBlockState);
    };
  }, [desktopOnlyEnabled]);

  if (!desktopOnlyEnabled || !blocked) {
    return children;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Desktop Access Required</h1>
        <p style={styles.text}>
          Task Tracker is currently restricted to desktop and laptop browsers.
        </p>
        <p style={styles.helper}>
          Please open this app from your office computer to continue.
        </p>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.2rem',
    background: 'radial-gradient(circle at top, rgba(222, 233, 255, 0.95), #f4f7fb 48%, #eef2f6 100%)'
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    borderRadius: '20px',
    border: '1px solid rgba(122, 145, 184, 0.2)',
    background: 'white',
    padding: '1.5rem',
    boxShadow: '0 18px 44px rgba(31, 45, 76, 0.14)'
  },
  title: {
    margin: '0 0 0.65rem',
    color: '#173053',
    fontSize: '1.5rem'
  },
  text: {
    margin: '0 0 0.35rem',
    color: '#41556f',
    lineHeight: 1.5
  },
  helper: {
    margin: 0,
    color: '#60738f',
    lineHeight: 1.5
  }
};
