// app.js
const express = require('express');
const { Store, idempotencyCache } = require('./store');
const { validateOrder } = require('./validator');
const { formatOrderResponse } = require('./models');
const { problem } = require('./errors');

const app = express();
app.use(express.json());

// 1. CREATE Endpoint with Idempotency check (C3, C5, C7)
app.post('/orders', (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];

  // Handle Idempotency Key Replays
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey);
    res.setHeader('Location', cached.location);
    return res.status(cached.status).json(cached.body);
  }

  // Body Validation (C4)
  const validation = validateOrder(req.body);
  if (!validation.isValid) {
    return problem(res, {
      type: "validation-error",
      title: "Malformed Request Body",
      status: 400,
      detail: validation.errors.join(', ')
    });
  }

  // Process item creation
  const newRecord = Store.createOrder(req.body);
  const jsonResponse = formatOrderResponse(newRecord);
  const locationUrl = `/orders/${jsonResponse.id}`;

  res.setHeader('Location', locationUrl);

  // Cache response for future identical idempotent requests
  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, {
      status: 201,
      body: jsonResponse,
      location: locationUrl
    });
  }

  return res.status(201).json(jsonResponse);
});

// 2. READ Single Item (C3, C5)
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
  return res.status(200).json(formatOrderResponse(record));
});

// 3. FILTERED LIST using Query String (C3)
app.get('/orders', (req, res) => {
  const { status } = req.query;
  let results = Store.getAllOrders();

  if (status) {
    results = results.filter(o => o.status === status);
  }

  return res.status(200).json(results.map(formatOrderResponse));
});

// 4. STATE-CHANGING SUB-RESOURCE (C3, C5)
app.post('/orders/:id/cancellation', (req, res) => {
  const record = Store.getOrder(req.params.id);

  if (!record) {
    return problem(res, {
      type: "not-found",
      title: "Resource Not Found",
      status: 404,
      detail: "Order ID missing."
    });
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

module.exports = app;
