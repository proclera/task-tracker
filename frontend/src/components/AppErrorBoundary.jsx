import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.page}>
          <div style={styles.card}>
            <h1 style={styles.title}>Frontend Error</h1>
            <p style={styles.text}>The app hit a runtime error while loading.</p>
            <pre style={styles.pre}>{String(this.state.error?.message || this.state.error)}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#f5f7fb'
  },
  card: {
    maxWidth: '760px',
    width: '100%',
    background: 'white',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(20, 30, 50, 0.12)'
  },
  title: {
    margin: '0 0 10px 0',
    color: '#8b2323'
  },
  text: {
    margin: '0 0 16px 0',
    color: '#55657d'
  },
  pre: {
    margin: 0,
    padding: '14px',
    background: '#fff1f1',
    color: '#8b2323',
    borderRadius: '12px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap'
  }
};
