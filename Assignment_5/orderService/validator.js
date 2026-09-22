// validator.js

// 400 = the request is malformed / doesn't parse into a valid shape.
function validateOrder(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push("Request body must be a JSON object");
  if (!body || !body.customerId) errors.push("Missing customerId");
  if (!body || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push("Items must be a non-empty array");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 422 = the request is syntactically valid but the domain refuses it.
// Here: a single order is capped at 10 line items (a real CampusEats
// kitchen-capacity rule), distinct from a malformed body.
const MAX_ITEMS_PER_ORDER = 10;

function checkDomainRules(body) {
  const errors = [];
  if (Array.isArray(body.items) && body.items.length > MAX_ITEMS_PER_ORDER) {
    errors.push(`Order exceeds maximum of ${MAX_ITEMS_PER_ORDER} items per order`);
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = { validateOrder, checkDomainRules, MAX_ITEMS_PER_ORDER };