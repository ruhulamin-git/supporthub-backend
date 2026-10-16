/**
 * Database Migration Script
 * 
 * This script creates all tables with proper relationships,
 * constraints, and indexes for the support system.
 * 
 * Run with: npm run db:migrate
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : undefined,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

const migration = async () => {
  const client = await pool.connect();

  try {
    console.log('Starting database migration...\n');

    // Begin transaction
    await client.query('BEGIN');

    // 1. Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Users table created');

    // 2. Create tickets table
    console.log('Creating tickets table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL CHECK (LENGTH(description) >= 10 AND LENGTH(description) <= 2000),
        status VARCHAR(50) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Assigned', 'In Progress', 'Resolved', 'Closed')),
        priority VARCHAR(50) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
        customer_id INTEGER NOT NULL REFERENCES users(id),
        assigned_agent_id INTEGER REFERENCES users(id),
        ai_confidence DECIMAL(5,2),
        urgency_score DECIMAL(5,2),
        sentiment_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Tickets table created');

    // 3. Create comments table
    console.log('Creating comments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        text TEXT NOT NULL CHECK (LENGTH(text) >= 1 AND LENGTH(text) <= 1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Comments table created');

    // 4. Create status_history table
    console.log('Creating status_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS status_history (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        from_status VARCHAR(50),
        to_status VARCHAR(50) NOT NULL,
        changed_by INTEGER NOT NULL REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Status_history table created');

    // 5. Create indexes for performance
    console.log('\nCreating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
    `);
    console.log('✓ Index on tickets.customer_id created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id);
    `);
    console.log('✓ Index on tickets.assigned_agent_id created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    `);
    console.log('✓ Index on tickets.status created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
    `);
    console.log('✓ Index on tickets.priority created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
    `);
    console.log('✓ Index on comments.ticket_id created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_status_history_ticket ON status_history(ticket_id);
    `);
    console.log('✓ Index on status_history.ticket_id created');

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run migration
migration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
