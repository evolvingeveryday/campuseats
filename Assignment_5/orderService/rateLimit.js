// rateLimit.js
const { problem } = require('./errors');

const WINDOW_MS = 60 * 1000; // 1 minute window
const LIMIT = 20;            // requests per client per window

// Keyed per-client (Bearer token if present, else IP), NOT a single global
// counter -- one noisy client must not throttle everyone else.
const buckets = new Map();

function clientKey(req) {
  return req.clientToken || req.ip || 'anonymous';
}

function rateLimit(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, LIMIT - bucket.count);
  const resetSeconds = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);

  res.setHeader('X-RateLimit-Limit', String(LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(remaining));

  if (bucket.count > LIMIT) {
    res.setHeader('Retry-After', String(resetSeconds));
    return problem(res, {
      type: "rate-limited",
      title: "Too Many Requests",
      status: 429,
      detail: `Rate limit of ${LIMIT} requests/minute exceeded for this client. Retry after ${resetSeconds}s.`
    });
  }

  next();
}

module.exports = { rateLimit };
