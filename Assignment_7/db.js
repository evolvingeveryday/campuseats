import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campuseats_graphql',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  decimalNumbers: true
});

function mapDish(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    available: Boolean(row.available)
  };
}

export async function waitForDatabase(maxAttempts = 25, delayMs = 1500) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.log(`Waiting for MySQL (${attempt}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`Could not connect to MySQL: ${lastError?.message || 'unknown database error'}`);
}

export async function listDishes() {
  const [rows] = await pool.execute(
    'SELECT id, name, price, available FROM dishes ORDER BY id ASC'
  );
  return rows.map(mapDish);
}

export async function getDishById(id) {
  const [rows] = await pool.execute(
    'SELECT id, name, price, available FROM dishes WHERE id = ? LIMIT 1',
    [Number(id)]
  );
  return mapDish(rows[0]);
}

export async function addDish({ name, price, available = true }) {
  const [result] = await pool.execute(
    'INSERT INTO dishes (name, price, available) VALUES (?, ?, ?)',
    [name.trim(), Number(price), available ? 1 : 0]
  );
  return getDishById(result.insertId);
}

export async function closeDatabase() {
  await pool.end();
}
