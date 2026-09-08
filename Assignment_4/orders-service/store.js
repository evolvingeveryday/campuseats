// store.js
const crypto = require('crypto');

// In-process storage simulating DB records
const orderDB = new Map();
const idempotencyCache = new Map(); // Maps 'key' -> { status, body, location }

const Store = {
  createOrder: (data) => {
    const id = crypto.randomUUID();
    const record = {
      _id: id,
      ...data,
      status: 'pending',
      internalLogs: ['Order initialized'],
      createdAt: new Date().toISOString()
    };
    orderDB.set(id, record);
    return record;
  },

  getOrder: (id) => orderDB.get(id),

  getAllOrders: () => Array.from(orderDB.values()),

  updateOrder: (id, updates) => {
    if (!orderDB.has(id)) return null;
    const current = orderDB.get(id);
    const updated = { ...current, ...updates };
    orderDB.set(id, updated);
    return updated;
  }
};

module.exports = { Store, orderDB, idempotencyCache };