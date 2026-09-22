// negotiate.js
const { problem } = require('./errors');

// B1: this service only ever produces application/json. If a client's
// Accept header rules that out entirely, refuse with 406 rather than
// silently sending JSON anyway.
function contentNegotiation(req, res, next) {
  const accept = req.headers['accept'];
  if (accept && accept !== '*/*' && !accept.includes('application/json') && !accept.includes('*/*')) {
    return problem(res, {
      type: "not-acceptable",
      title: "Not Acceptable",
      status: 406,
      detail: "This service only produces application/json."
    });
  }
  next();
}

// A5: documented fallback ONLY -- lets a constrained client that can't
// send PUT/PATCH/DELETE ask for one via a header on a POST instead.
function methodOverride(req, res, next) {
  const override = req.headers['x-http-method-override'];
  if (req.method === 'POST' && override) {
    const upper = override.toUpperCase();
    if (['PATCH', 'DELETE', 'PUT'].includes(upper)) {
      req.method = upper;
    }
  }
  next();
}

module.exports = { contentNegotiation, methodOverride };
