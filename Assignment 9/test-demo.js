// test-demo.js - Executes and demonstrates the 5 verification cases for Assignment 9
require('dotenv').config();
const { spawn } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('='.repeat(70));
  console.log('CS543 ASSIGNMENT 09: SECURING THE API - DEMONSTRATION SUITE');
  console.log('='.repeat(70));

  console.log('\n[INFO] Starting local Express server (node server.js)...');
  const server = spawn('node', ['server.js'], { stdio: ['inherit', 'pipe', 'pipe'], shell: true });

  server.stdout.on('data', data => {
    process.stdout.write(`[SERVER] ${data}`);
  });
  server.stderr.on('data', data => {
    process.stderr.write(`[SERVER ERROR] ${data}`);
  });

  await sleep(2500);

  const BASE = 'http://127.0.0.1:3000';
  let customerToken = '';
  let restaurantToken = '';

  const results = [];

  try {
    // ------------------------------------------------------------------------
    // CASE 1: Request with NO token -> 401 Unauthorized
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('CASE 1: Request with NO token -> Expected: 401 Unauthorized');
    console.log('='.repeat(70));
    console.log(`> GET ${BASE}/items`);
    console.log(`> Headers: (none)`);

    const res1 = await fetch(`${BASE}/items`);
    const body1 = await res1.json();
    console.log(`< HTTP Status: ${res1.status} ${res1.statusText}`);
    console.log(`< Body:`, JSON.stringify(body1, null, 2));

    if (res1.status === 401) {
      console.log('-> CASE 1 PASSED: Guard 1 (auth) blocked unauthenticated request.');
      results.push({ case: '1. No token -> 401', status: res1.status, pass: true, body: body1 });
    } else {
      throw new Error(`Expected 401, got ${res1.status}`);
    }

    // ------------------------------------------------------------------------
    // CASE 2: Successful login -> Token issued
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('CASE 2: Successful login -> Expected: 200 OK + JWT Token');
    console.log('='.repeat(70));
    console.log(`> POST ${BASE}/login`);
    console.log(`> Payload: {"username":"customer", "password":"customer123"}`);

    const res2 = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'customer', password: 'customer123' })
    });
    const body2 = await res2.json();
    console.log(`< HTTP Status: ${res2.status} ${res2.statusText}`);
    console.log(`< Body:`, JSON.stringify(body2, null, 2));

    customerToken = body2.token;
    if (res2.status === 200 && customerToken) {
      console.log('-> CASE 2 PASSED: Password verified with bcrypt, JWT issued for customer.');
      results.push({ case: '2. Login -> 200 + token', status: res2.status, pass: true, tokenPreview: customerToken.slice(0, 30) + '...' });
    } else {
      throw new Error(`Expected 200 + token, got ${res2.status}`);
    }

    // Also get restaurant token for later privileged write
    console.log('\n> [SETUP] Logging in as restaurant...');
    const res2b = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'restaurant', password: 'restaurant123' })
    });
    const body2b = await res2b.json();
    restaurantToken = body2b.token;
    console.log(`< Logged in as restaurant (role: ${body2b.role})`);

    // ------------------------------------------------------------------------
    // CASE 3: Request with valid token -> 200 OK (Protected Read)
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('CASE 3: Request with valid token -> Expected: 200 OK');
    console.log('='.repeat(70));
    console.log(`> GET ${BASE}/items`);
    console.log(`> Headers: Authorization: Bearer ${customerToken.slice(0, 25)}...`);

    const res3 = await fetch(`${BASE}/items`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const body3 = await res3.json();
    console.log(`< HTTP Status: ${res3.status} ${res3.statusText}`);
    console.log(`< Body:`, JSON.stringify(body3, null, 2));

    if (res3.status === 200 && Array.isArray(body3)) {
      console.log('-> CASE 3 PASSED: Token verified by jwt.verify, catalogue items retrieved.');
      results.push({ case: '3. Valid token read -> 200', status: res3.status, pass: true, itemCount: body3.length });
    } else {
      throw new Error(`Expected 200, got ${res3.status}`);
    }

    // ------------------------------------------------------------------------
    // CASE 4: Privileged role on write route -> 201 Created
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('CASE 4: Privileged role on write route -> Expected: 201 Created');
    console.log('='.repeat(70));
    console.log(`> POST ${BASE}/items`);
    console.log(`> Headers: Authorization: Bearer ${restaurantToken.slice(0, 25)}... (Role: restaurant)`);
    console.log(`> Payload: {"name":"Masala Dosa", "price":60}`);

    const res4 = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restaurantToken}`
      },
      body: JSON.stringify({ name: 'Masala Dosa', price: 60 })
    });
    const body4 = await res4.json();
    console.log(`< HTTP Status: ${res4.status} ${res4.statusText}`);
    console.log(`< Body:`, JSON.stringify(body4, null, 2));

    if (res4.status === 201 && body4.name === 'Masala Dosa') {
      console.log('-> CASE 4 PASSED: requireRole("restaurant") permitted write; item created.');
      results.push({ case: '4. Privileged write -> 201', status: res4.status, pass: true, createdItem: body4 });
    } else {
      throw new Error(`Expected 201, got ${res4.status}`);
    }

    // ------------------------------------------------------------------------
    // CASE 5: Another role (customer) on write route -> 403 Forbidden
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('CASE 5: Non-privileged role (customer) on write route -> Expected: 403 Forbidden');
    console.log('='.repeat(70));
    console.log(`> POST ${BASE}/items`);
    console.log(`> Headers: Authorization: Bearer ${customerToken.slice(0, 25)}... (Role: customer)`);
    console.log(`> Payload: {"name":"Unauthorized Dish", "price":150}`);

    const res5 = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({ name: 'Unauthorized Dish', price: 150 })
    });
    const body5 = await res5.json();
    console.log(`< HTTP Status: ${res5.status} ${res5.statusText}`);
    console.log(`< Body:`, JSON.stringify(body5, null, 2));

    if (res5.status === 403) {
      console.log('-> CASE 5 PASSED: requireRole guard rejected customer role with 403 Forbidden.');
      results.push({ case: '5. Non-privileged write -> 403', status: res5.status, pass: true, body: body5 });
    } else {
      throw new Error(`Expected 403, got ${res5.status}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('DEMONSTRATION SUMMARY: ALL 5 CASES PASSED PERFECTLY!');
    console.log('='.repeat(70));
    console.table(results);

  } finally {
    console.log('\n[INFO] Stopping Express server...');
    try {
      if (server.pid) {
        process.kill(server.pid);
      }
    } catch (e) {}
    process.exit(0);
  }
}

runDemo().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
