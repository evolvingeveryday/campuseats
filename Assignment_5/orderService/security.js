// security.js
// Date and Server headers are already added by Node/Express; we only need
// to add the headers the framework does NOT set on its own.
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // In production this service sits behind HTTPS; HSTS tells browsers to
  // never downgrade to plain HTTP for this host again.
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}

module.exports = { securityHeaders };
