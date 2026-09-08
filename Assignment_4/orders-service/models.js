// models.js
function formatOrderResponse(dbRecord) {
  return {
    id: dbRecord._id.toString(), // External representation uses clean 'id'
    customerId: dbRecord.customerId,
    items: dbRecord.items,
    status: dbRecord.status,
    createdAt: dbRecord.createdAt
    // internalLogs and idempotencyKey are safely stripped out here (C2)
  };
}

module.exports = { formatOrderResponse };