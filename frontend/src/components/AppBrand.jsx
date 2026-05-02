export const AppBrand = ({ subtitle, compact = false, centered = false, titleColor = '#173053' }) => (
  <div
    style={{
      ...styles.wrap,
      ...(compact ? styles.compactWrap : {}),
      ...(centered ? styles.centered : {})
    }}
  >
    <img
      src="/company-logo.png"
      alt="ECOM Trades"
      style={{
        ...styles.logo,
        ...(compact ? styles.compactLogo : {})
      }}
    />
    {subtitle ? (
      <div style={styles.subtitle}>{subtitle}</div>
    ) : null}
  </div>
);

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem'
  },
  compactWrap: {
    gap: '0.25rem'
  },
  centered: {
    alignItems: 'center'
  },
  logo: {
    width: 'min(240px, 72vw)',
    height: 'auto',
    objectFit: 'contain'
  },
  compactLogo: {
    width: '170px',
    maxWidth: '48vw'
  },
  subtitle: {
    color: '#60738f',
    fontWeight: 600
  }
};
