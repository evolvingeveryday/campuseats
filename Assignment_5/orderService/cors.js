// cors.js
// Minimal hand-rolled CORS so a browser page on another origin (Q5) can
// call this API. Answers the preflight OPTIONS itself when it's a CORS
// preflight (has Access-Control-Request-Method); otherwise falls through
// to the real OPTIONS handler in app.js (used for the Allow-header case, A5).
function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, If-Match, If-None-Match, X-HTTP-Method-Override');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Location, ETag, X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After, Allow');

  const isPreflight = req.method === 'OPTIONS' && req.headers['access-control-request-method'];
  if (isPreflight) {
    return res.status(204).end();
  }
  next();
}

module.exports = { cors };
