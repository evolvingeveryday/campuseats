// auth.js
const { problem } = require('./errors');

// Header handling only, per the assignment: no real token issuing/verification,
// just enforce that a non-empty Bearer token is present on protected routes.
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];

  if (!header || !header.startsWith('Bearer ') || header.slice(7).trim() === '') {
    return problem(res, {
      type: "unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "A non-empty 'Authorization: Bearer <token>' header is required for this endpoint."
    });
  }

  // Stash the token as a crude per-client identity for rate limiting (B5).
  req.clientToken = header.slice(7).trim();
  next();
}

module.exports = { requireAuth };
