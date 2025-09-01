const db = require('./db');

async function testConnection() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
    console.log('Current time from DB:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
}

testConnection();