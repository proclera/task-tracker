const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

const isDesktopOnlyEnabled = () => process.env.DESKTOP_ONLY_MODE !== 'false';

const looksLikeMobileClient = (req) => {
  const ua = String(req.headers['user-agent'] || '');
  const secChUaMobile = String(req.headers['sec-ch-ua-mobile'] || '');

  if (MOBILE_UA_PATTERN.test(ua)) {
    return true;
  }

  if (secChUaMobile.includes('?1')) {
    return true;
  }

  return false;
};

const enforceDesktopOnly = (req, res, next) => {
  if (!isDesktopOnlyEnabled()) {
    return next();
  }

  if (['OPTIONS', 'HEAD'].includes(req.method)) {
    return next();
  }

  if (looksLikeMobileClient(req)) {
    return res.status(403).json({
      error: 'Mobile access is disabled. Please use a desktop or laptop browser.'
    });
  }

  return next();
};

module.exports = {
  enforceDesktopOnly
};
