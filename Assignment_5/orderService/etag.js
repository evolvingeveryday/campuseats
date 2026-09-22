// etag.js
const crypto = require('crypto');

// Deterministic ETag from the resource's own state. Changes whenever
// status/items/customerId/updatedAt change, which is what B4 requires
// and what C1/C2 rely on for conditional GET / conditional write.
function computeETag(record) {
  const basis = JSON.stringify({
    id: record._id,
    customerId: record.customerId,
    items: record.items,
    status: record.status,
    updatedAt: record.updatedAt || record.createdAt
  });
  const hash = crypto.createHash('sha1').update(basis).digest('hex');
  return `"${hash}"`;
}

module.exports = { computeETag };
