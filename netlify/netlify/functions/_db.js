const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

function requireDbUrl() {
  if (!process.env.DATABASE_URL) {
    const err = new Error('DATABASE_URL environment variable is missing in Netlify.');
    err.statusCode = 500;
    throw err;
  }
}

function checkAdmin(event) {
  const pin = event.headers['x-admin-pin'] || event.headers['X-Admin-Pin'];
  const expected = process.env.ADMIN_PIN || '629122';
  if (pin !== expected) {
    const err = new Error('Unauthorized admin request.');
    err.statusCode = 401;
    throw err;
  }
}

module.exports = { getPool, json, requireDbUrl, checkAdmin };
