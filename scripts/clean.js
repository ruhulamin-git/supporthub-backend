/**
 * Database Clean Script
 * 
 * Truncates all tables and resets ID sequences.
 * 
 * Run with: npm run db:clean
 */

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : undefined,
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

const clean = async () => {
  const client = await pool.connect();

  try {
    console.log('Cleaning database...\n');
    await client.query('BEGIN');

    // Truncate all tables and reset auto-increment primary key sequences
    await client.query('TRUNCATE TABLE status_history, comments, tickets, users RESTART IDENTITY CASCADE;');

    await client.query('COMMIT');
    console.log('Database successfully cleaned!');
    console.log('All users, tickets, comments, and status history have been deleted.');
    console.log('All ID sequences have been reset to 1.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Clean failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

clean().catch(err => {
  console.error('Error executing clean:', err);
  process.exit(1);
});
