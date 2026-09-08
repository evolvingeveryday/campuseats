const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

// POST /api/orders → create order
router.post('/', ordersController.createOrder);

// GET /api/orders → list orders
router.get('/', ordersController.listOrders);

// GET /api/orders/:id → get single order
router.get('/:id', ordersController.getOrder);

// POST /api/orders/:id/cancel → cancel order
router.post('/:id/cancel', ordersController.cancelOrder);

module.exports = router;
