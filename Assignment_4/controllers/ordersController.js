exports.createOrder = (req, res) => {
  // TODO: Save order to DB later
  res.status(201).json({ message: 'Order created', order: req.body });
};

exports.listOrders = (req, res) => {
  const { userID } = req.query;
  // TODO: Fetch orders by userID
  res.json([{ orderID: '123', userID }]);
};

exports.getOrder = (req, res) => {
  const { id } = req.params;
  // TODO: Fetch order by ID
  res.json({ orderID: id, status: 'Pending' });
};

exports.cancelOrder = (req, res) => {
  const { id } = req.params;
  // TODO: Update order status to Cancelled
  res.status(202).json({ orderID: id, status: 'Cancelled' });
};

// controllers/ordersController.js
const { Store, idempotencyCache } = require('../orders-service/store');
const { validateOrder } = require('../orders-service/validator');
const { formatOrderResponse } = require('../orders-service/models');
const { problem } = require('../orders-service/errors');

// CREATE Order (C3, C4, C5, C6, C7)
exports.createOrder = (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];

  // Handle Idempotency Key Replays
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey);
    res.setHeader('Location', cached.location);
    return res.status(cached.status).json(cached.body);
  }

  // Validate request body
  const validation = validateOrder(req.body);
  if (!validation.isValid) {
    return problem(res, {
      type: "validation-error",
      title: "Malformed Request Body",
      status: 400,
      detail: validation.errors.join(', ')
    });
  }

  // Create new order
  const newRecord = Store.createOrder(req.body);
  const jsonResponse = formatOrderResponse(newRecord);
  const locationUrl = `/orders/${jsonResponse.id}`;

  res.setHeader('Location', locationUrl);

  // Cache response for idempotency
  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, {
      status: 201,
      body: jsonResponse,
      location: locationUrl
    });
  }

  return res.status(201).json(jsonResponse);
};

// LIST Orders (C3)
exports.listOrders = (req, res) => {
  const { status } = req.query;
  let results = Store.getAllOrders();

  if (status) {
    results = results.filter(o => o.status === status);
  }

  return res.status(200).json(results.map(formatOrderResponse));
};

// GET Single Order (C3, C5, C6)
exports.getOrder = (req, res) => {
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
};

// CANCEL Order (C3, C5, C6)
exports.cancelOrder = (req, res) => {
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
};
