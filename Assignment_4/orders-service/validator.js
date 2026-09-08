// validator.js
function validateOrder(body) {
  const errors = [];
  if (!body.customerId) errors.push("Missing customerId");
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push("Items must be a non-empty array");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = { validateOrder };