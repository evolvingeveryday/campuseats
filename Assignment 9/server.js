// server.js - CampusEats Catalogue Service (Secured REST API)
// CS543: Web Services - Assignment 09 of 12
// IIIT Vadodara

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'fallback_secret_if_env_missing';

app.use(express.json()); // read JSON request bodies
app.use(express.static('public')); // serve front-end web page

// ============================================================================
// Task 1: Users & Hashing (Seeded with bcrypt hashes, never plain text)
// ============================================================================
const users = [
  {
    id: 1,
    username: 'customer',
    // bcrypt hash of 'customer123'
    passwordHash: bcrypt.hashSync('customer123', 10),
    role: 'customer'
  },
  {
    id: 2,
    username: 'restaurant',
    // bcrypt hash of 'restaurant123'
    passwordHash: bcrypt.hashSync('restaurant123', 10),
    role: 'restaurant'
  },
  {
    id: 3,
    username: 'admin',
    // bcrypt hash of 'admin123'
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  }
];

// ============================================================================
// Data: In-Memory Catalogue Items
// ============================================================================
let items = [
  { id: 1, name: 'Veg Thali', price: 90 },
  { id: 2, name: 'Paneer Roll', price: 70 },
];
let nextId = 3;

// ============================================================================
// The Two Guards (Middleware)
// ============================================================================

// Guard 1: Authentication -- "who are you?"
function auth(req, res, next) {
  const token = (req.get('Authorization') || '').split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// Guard 2: Authorization -- "may you?"
const requireRole = (...ok) => (req, res, next) =>
  ok.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'forbidden' });

// ============================================================================
// Routes
// ============================================================================

// Task 2: Login -- POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  // Issue JWT carrying user id and role, with expiry
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token, role: user.role });
});

// Task 3: Protected Read Routes (Authenticated users only)
// GET /items -- list the whole menu
app.get('/items', auth, (req, res) => {
  res.json(items);
});

// GET /items/:id -- one dish, or 404
app.get('/items/:id', auth, (req, res) => {
  const item = items.find(i => i.id === Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

// Task 4: Protected Write Route (Privileged roles only: restaurant, admin)
// POST /items -- add a dish
app.post('/items', auth, requireRole('restaurant', 'admin'), (req, res) => {
  const { name, price } = req.body || {};
  if (!name) return res.status(422).json({ error: 'name required' });
  const item = { id: nextId++, name, price: Number(price) || 0 };
  items.push(item);
  res.status(201).json(item); // 201 Created + the new dish
});

// DELETE /items/:id -- remove a dish (privileged roles only)
app.delete('/items/:id', auth, requireRole('restaurant', 'admin'), (req, res) => {
  const index = items.findIndex(i => i.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'not found' });
  items.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => console.log(`Secured Catalogue on http://localhost:${PORT}`));
