// server.js - CampusEats Catalogue Service REST API
// CS543: Web Services - Assignment 8 of 12
// IIIT Vadodara

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware Configuration
// ============================================================================

// express.json() is built-in middleware based on body-parser.
// It parses incoming HTTP requests with Content-Type: application/json
// and populates req.body with the parsed JavaScript object.
// Without express.json(), req.body remains undefined on POST requests.
app.use(express.json());

// Serve static frontend assets (index.html, style.css, app.js) from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// Data: In-Memory Array (Source of Truth)
// ============================================================================
let nextId = 5;

const items = [
  { id: 1, name: 'Paneer Tikka Roll', price: 120, category: 'Rolls & Wraps', available: true },
  { id: 2, name: 'Crispy Veg Burger', price: 80, category: 'Burgers', available: true },
  { id: 3, name: 'Masala Chai', price: 25, category: 'Beverages', available: true },
  { id: 4, name: 'Chole Bhature Platter', price: 150, category: 'Meals', available: false }
];

// ============================================================================
// REST API Handlers
// ============================================================================

/**
 * 1. GET /items
 * List all items in the catalogue.
 * Status: 200 OK
 */
app.get('/items', (req, res) => {
  res.status(200).json(items);
});

/**
 * 2. GET /items/:id
 * Fetch a single item by its ID.
 * Reads id from route parameter req.params.id.
 * Status: 200 OK if found, 404 Not Found if absent.
 */
app.get('/items/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const item = items.find(i => i.id === targetId);

  if (!item) {
    return res.status(404).json({ error: `Item with id ${req.params.id} not found` });
  }

  res.status(200).json(item);
});

/**
 * 3. POST /items
 * Create a new item record.
 * Reads JSON payload from req.body.
 * Validates payload — replies 422 Unprocessable Entity if required field is missing.
 * Replies 201 Created on success.
 */
app.post('/items', (req, res) => {
  const { name, price, category, available } = req.body;

  // Validate required field: name
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(422).json({ error: 'Validation failed: "name" is required and cannot be empty.' });
  }

  // Validate required field: price (must be a valid non-negative number)
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
    return res.status(422).json({ error: 'Validation failed: "price" is required and must be a non-negative number.' });
  }

  const newItem = {
    id: nextId++,
    name: name.trim(),
    price: Number(price),
    category: category && typeof category === 'string' && category.trim() ? category.trim() : 'General',
    available: available === undefined ? true : Boolean(available)
  };

  items.push(newItem);
  res.status(201).json(newItem);
});

// Start the server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  CampusEats Menu / Catalogue Service (REST API)`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`=======================================================`);
    console.log(`  Routes available:`);
    console.log(`    GET  /items      - List all menu items (200)`);
    console.log(`    GET  /items/:id  - Fetch single item by ID (200 / 404)`);
    console.log(`    POST /items      - Create new menu item (201 / 422)`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
