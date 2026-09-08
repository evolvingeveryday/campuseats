// tests/orders.test.js
const request = require('supertest');
const app = require('../app');

describe('Orders Service REST Assertions', () => {
  let createdId;
  const uniqueKey = "test-key-12345";

  // Test 1: Create succeeds with 201 + Location
  it('should create order and return 201 with Location header', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Idempotency-Key', uniqueKey)
      .send({ customerId: "user_99", items: ["Burger", "Fries"] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBeDefined();
    createdId = res.body.id;
  });

  // Test 2: Idempotent repeat returns original
  it('should return identical response when repeating with same Idempotency-Key', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Idempotency-Key', uniqueKey)
      .send({ customerId: "user_99", items: ["Burger", "Fries"] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(createdId);
  });

  // Test 3: Failure path returns right 4xx shape
  it('should return 400 with problem details json on malformed body', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ customerId: "user_99" }); // missing items array

    expect(res.status).toBe(400);
    expect(res.body.title).toBe("Malformed Request Body");
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  // Test 4: Unknown ID returns 404
  it('should return 404 when reading unknown id', async () => {
    const res = await request(app).get('/orders/non-existent-uuid-123');
    expect(res.status).toBe(404);
    expect(res.body.title).toBe("Resource Not Found");
  });
});