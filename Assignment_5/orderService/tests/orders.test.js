// tests/orders.test.js
const request = require('supertest');
const app = require('../app');

const AUTH = { Authorization: 'Bearer test-token-abc' };

describe('Orders Service REST Assertions', () => {
  let createdId;
  const uniqueKey = "test-key-12345";

  // --- Part A / B2: create ---
  it('should create order and return 201 with Location header', async () => {
    const res = await request(app)
      .post('/orders')
      .set(AUTH)
      .set('Idempotency-Key', uniqueKey)
      .send({ customerId: "user_99", items: ["Burger", "Fries"] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBeDefined();
    createdId = res.body.id;
  });

  // --- C3: idempotent repeat ---
  it('should return identical response when repeating with same Idempotency-Key', async () => {
    const res = await request(app)
      .post('/orders')
      .set(AUTH)
      .set('Idempotency-Key', uniqueKey)
      .send({ customerId: "user_99", items: ["Burger", "Fries"] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(createdId);
  });

  // --- B2/B1: 400 malformed body ---
  it('should return 400 with problem details json on malformed body', async () => {
    const res = await request(app)
      .post('/orders')
      .set(AUTH)
      .send({ customerId: "user_99" }); // missing items array

    expect(res.status).toBe(400);
    expect(res.body.title).toBe("Malformed Request Body");
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  // --- B2: 422 domain refusal ---
  it('should return 422 when order exceeds max items domain rule', async () => {
    const res = await request(app)
      .post('/orders')
      .set(AUTH)
      .send({ customerId: "user_99", items: new Array(11).fill("Item") });

    expect(res.status).toBe(422);
  });

  // --- B3: 401 unauthorized ---
  it('should return 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/orders')
      .send({ customerId: "user_99", items: ["Burger"] });

    expect(res.status).toBe(401);
  });

  // --- 404 ---
  it('should return 404 when reading unknown id', async () => {
    const res = await request(app).get('/orders/non-existent-uuid-123');
    expect(res.status).toBe(404);
    expect(res.body.title).toBe("Resource Not Found");
  });

  // --- B4/C1: ETag + conditional GET ---
  it('should return an ETag on single-item GET and 304 on matching If-None-Match', async () => {
    const first = await request(app).get(`/orders/${createdId}`);
    expect(first.status).toBe(200);
    const etag = first.headers.etag;
    expect(etag).toBeDefined();

    const second = await request(app)
      .get(`/orders/${createdId}`)
      .set('If-None-Match', etag);

    expect(second.status).toBe(304);
  });

  // --- C2: conditional write / 412 ---
  it('should return 412 when If-Match does not match current ETag', async () => {
    const res = await request(app)
      .patch(`/orders/${createdId}`)
      .set(AUTH)
      .set('If-Match', '"stale-etag-value"')
      .send({ items: ["Pizza"] });

    expect(res.status).toBe(412);
  });

  it('should succeed when If-Match matches current ETag', async () => {
    const current = await request(app).get(`/orders/${createdId}`);
    const res = await request(app)
      .patch(`/orders/${createdId}`)
      .set(AUTH)
      .set('If-Match', current.headers.etag)
      .send({ items: ["Pizza"] });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(["Pizza"]);
  });

  // --- A5: OPTIONS + Allow ---
  it('should return Allow header on OPTIONS for a single resource', async () => {
    const res = await request(app).options(`/orders/${createdId}`);
    expect(res.status).toBe(204);
    expect(res.headers.allow).toContain('GET');
    expect(res.headers.allow).toContain('DELETE');
  });

  // --- Non-CRUD action + retry-safety ---
  it('cancel is retry-safe: repeating it returns 200 instead of erroring', async () => {
    const first = await request(app).post(`/orders/${createdId}/cancel`).set(AUTH);
    expect(first.status).toBe(202);

    const second = await request(app).post(`/orders/${createdId}/cancel`).set(AUTH);
    expect(second.status).toBe(200);
  });

  // --- DELETE ---
  it('should delete an order and return 204', async () => {
    const create = await request(app)
      .post('/orders')
      .set(AUTH)
      .send({ customerId: "user_1", items: ["Coffee"] });

    const del = await request(app).delete(`/orders/${create.body.id}`).set(AUTH);
    expect(del.status).toBe(204);

    const getAfter = await request(app).get(`/orders/${create.body.id}`);
    expect(getAfter.status).toBe(404);
  });

  // --- B5: rate limit headers present ---
  it('should include rate limit headers on responses', async () => {
    const res = await request(app).get('/orders');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  // --- B6: CORS ---
  it('should include Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/orders');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  // --- B7: security headers ---
  it('should include security headers', async () => {
    const res = await request(app).get('/orders');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });
});
