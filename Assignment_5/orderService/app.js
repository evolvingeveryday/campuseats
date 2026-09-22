// app.js
const express = require('express');
const compression = require('compression');
const { Store, idempotencyCache } = require('./store');
const { validateOrder, checkDomainRules } = require('./validator');
const { formatOrderResponse } = require('./models');
const { problem } = require('./errors');
const { computeETag } = require('./etag');
const { requireAuth } = require('./auth');
const { rateLimit } = require('./rateLimit');
const { cors } = require('./cors');
const { securityHeaders } = require('./security');
const { contentNegotiation, methodOverride } = require('./negotiate');

const app = express();
app.set('etag', false); // we set ETag ourselves, only on the endpoints B4/C2 require

// --- Global middleware (applies to every request) ---
app.use(methodOverride);        // A5: X-HTTP-Method-Override fallback, before routing
app.use(cors);                  // B6: CORS + preflight
app.use(securityHeaders);       // B7: nosniff, HSTS
app.use(compression());         // B1: gzip large JSON bodies
app.use(express.json());
app.use(contentNegotiation);    // B1: 406 if Accept rules out JSON
app.use(rateLimit);             // B5: per-client X-RateLimit-* / 429

// ============================================================
// 1. CREATE — POST /orders            (A1 create, B2 201+Location, C3 idempotency)
// ============================================================
app.post('/orders', requireAuth, (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];

  // C3: same key replays the ORIGINAL result, doing no duplicate work.
  // A duplicate here would mean double-charging / double-cooking a meal.
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey);
    res.setHeader('Location', cached.location);
    return res.status(cached.status).json(cached.body);
  }

  // 400: malformed body
  const validation = validateOrder(req.body);
  if (!validation.isValid) {
    return problem(res, {
      type: "validation-error",
      title: "Malformed Request Body",
      status: 400,
      detail: validation.errors.join(', ')
    });
  }

  // 422: syntactically valid, domain refuses it
  const domainCheck = checkDomainRules(req.body);
  if (!domainCheck.isValid) {
    return problem(res, {
      type: "domain-refusal",
      title: "Order Refused",
      status: 422,
      detail: domainCheck.errors.join(', ')
    });
  }

  const newRecord = Store.createOrder(req.body);
  const jsonResponse = formatOrderResponse(newRecord);
  const locationUrl = `/orders/${jsonResponse.id}`;

  res.setHeader('Location', locationUrl);

  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, {
      status: 201,
      body: jsonResponse,
      location: locationUrl
    });
  }

  return res.status(201).json(jsonResponse);
});

// ============================================================
// 2. LIST — GET /orders               (A4 query-string filtering, pure read)
// ============================================================
app.get('/orders', (req, res) => {
  const { status } = req.query;
  let results = Store.getAllOrders();

  if (status) {
    results = results.filter(o => o.status === status);
  }

  return res.status(200).json(results.map(formatOrderResponse));
});

// ============================================================
// 3. READ single — GET /orders/:id    (B4 ETag/Cache-Control, C1 304)
// ============================================================
app.get('/orders/:id', (req, res) => {
  const record = Store.getOrder(req.params.id);
  if (!record) {
    return problem(res, {
      type: "not-found",
      title: "Resource Not Found",
      status: 404,
      detail: `No order found with ID ${req.params.id}`
    });
  }

  const etag = computeETag(record);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=30, must-revalidate');

  // C1: conditional GET — if the client's cached copy is still current, 304
  const clientETag = req.headers['if-none-match'];
  if (clientETag && clientETag === etag) {
    return res.status(304).end();
  }

  return res.status(200).json(formatOrderResponse(record));
});

// ============================================================
// 4. MODIFY — PATCH /orders/:id       (C2 If-Match / 412, B2 200)
// ============================================================
app.patch('/orders/:id', requireAuth, (req, res) => {
  const record = Store.getOrder(req.params.id);
  if (!record) {
    return problem(res, {
      type: "not-found",
      title: "Resource Not Found",
      status: 404,
      detail: `No order found with ID ${req.params.id}`
    });
  }

  // C2: require the client to prove they last read the current version,
  // so two editors updating at once cannot clobber each other.
  const currentETag = computeETag(record);
  const ifMatch = req.headers['if-match'];
  if (!ifMatch) {
    return problem(res, {
      type: "precondition-required",
      title: "If-Match Header Required",
      status: 428,
      detail: "Updates must include an If-Match header with the resource's current ETag."
    });
  }
  if (ifMatch !== currentETag) {
    return problem(res, {
      type: "precondition-failed",
      title: "Precondition Failed",
      status: 412,
      detail: "The resource has changed since you last read it. Re-fetch and retry."
    });
  }

  const allowedUpdates = {};
  if (req.body.items) allowedUpdates.items = req.body.items;
  if (req.body.status) allowedUpdates.status = req.body.status;

  const updated = Store.updateOrder(req.params.id, allowedUpdates);
  const newETag = computeETag(updated);
  res.setHeader('ETag', newETag);
  return res.status(200).json(formatOrderResponse(updated));
});

// ============================================================
// 5. REMOVE — DELETE /orders/:id      (B2 204)
// ============================================================
app.delete('/orders/:id', requireAuth, (req, res) => {
  const existed = Store.deleteOrder(req.params.id);
  if (!existed) {
    return problem(res, {
      type: "not-found",
      title: "Resource Not Found",
      status: 404,
      detail: `No order found with ID ${req.params.id}`
    });
  }
  return res.status(204).end();
});

// ============================================================
// 6. NON-CRUD ACTION — POST /orders/:id/cancel   (A2 sub-resource, 409, retry-safe)
// ============================================================
app.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const record = Store.getOrder(req.params.id);

  if (!record) {
    return problem(res, {
      type: "not-found",
      title: "Resource Not Found",
      status: 404,
      detail: "Order ID missing."
    });
  }

  // Cancel is not naturally idempotent (state-changing POST). We make a
  // repeat cancel retry-safe by treating "already cancelled" as success
  // rather than an error, instead of relying on an Idempotency-Key here.
  if (record.status === 'cancelled') {
    return res.status(200).json(formatOrderResponse(record));
  }

  if (record.status === 'completed') {
    return problem(res, {
      type: "state-conflict",
      title: "State Conflict",
      status: 409,
      detail: "Completed orders cannot be cancelled."
    });
  }

  const updatedRecord = Store.updateOrder(req.params.id, { status: 'cancelled' });
  return res.status(202).json(formatOrderResponse(updatedRecord));
});

// ============================================================
// 7. OPTIONS — Allow header            (A5)
// ============================================================
app.options('/orders/:id', (req, res) => {
  res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
  return res.status(204).end();
});

app.options('/orders', (req, res) => {
  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(204).end();
});

module.exports = app;
