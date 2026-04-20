exports.errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err?.message,
    stack: err?.stack,
    path: req?.path,
    method: req?.method
  });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  res.status(500).json({ error: 'Internal server error' });
};
