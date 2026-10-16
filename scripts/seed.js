/**
 * Database Seed Script
 * 
 * Creates demo users and sample tickets for testing
 * 
 * Run with: npm run db:seed
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : undefined,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

const SALT_ROUNDS = 10;

const seed = async () => {
  const client = await pool.connect();

  try {
    console.log('Starting database seed...\n');

    // Begin transaction
    await client.query('BEGIN');

    // Hash password for all demo users
    const password = await bcrypt.hash('password123', SALT_ROUNDS);

    // Create demo users
    console.log('Creating demo users...');

    // Admin user
    const adminResult = await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['admin@example.com', password, 'Admin User', 'admin']);
    console.log('✓ Admin user created');

    // Agent users
    const agent1Result = await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['agent1@example.com', password, 'Rasel', 'agent']);

    const agent2Result = await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['agent2@example.com', password, 'Biplob', 'agent']);
    console.log('✓ Agent users created');

    // Customer users
    const customer1Result = await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['customer1@example.com', password, 'Habib', 'customer']);

    const customer2Result = await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
      RETURNING id
    `, ['customer2@example.com', password, 'Sadia', 'customer']);
    console.log('✓ Customer users created');

    // Create sample tickets
    console.log('\nCreating sample tickets...');

    const customer1Id = customer1Result.rows[0]?.id || 4;
    const customer2Id = customer2Result.rows[0]?.id || 5;
    const agent1Id = agent1Result.rows[0]?.id || 2;

    // High priority ticket
    await client.query(`
      INSERT INTO tickets (title, description, status, priority, customer_id, assigned_agent_id, ai_confidence, urgency_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      'URGENT: Application crashed',
      'Our application is completely down and not working. This is critical and needs immediate attention. Customers cannot access the system.',
      'Assigned',
      'High',
      customer1Id,
      agent1Id,
      95,
      9.0
    ]);

    // Medium priority ticket
    await client.query(`
      INSERT INTO tickets (title, description, status, priority, customer_id, ai_confidence, urgency_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'Login page slow to load',
      'The login page takes a long time to load. It would be great if this could be fixed soon as it affects user experience.',
      'New',
      'Medium',
      customer2Id,
      70,
      5.5
    ]);

    // Low priority ticket
    await client.query(`
      INSERT INTO tickets (title, description, status, priority, customer_id, ai_confidence, urgency_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'Feature request: Dark mode',
      'It would be nice to have a dark mode option for the application. This is a minor enhancement that could improve user experience.',
      'New',
      'Low',
      customer1Id,
      60,
      2.0
    ]);

    console.log('Sample tickets created');

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n Seed completed successfully!');
    console.log('\nDemo Credentials:');
    console.log('==================');
    console.log('Admin:     admin@example.com / password123');
    console.log('Agent 1:   agent1@example.com / password123');
    console.log('Agent 2:   agent2@example.com / password123');
    console.log('Customer 1: customer1@example.com / password123');
    console.log('Customer 2: customer2@example.com / password123');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n Seed failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run seed
seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
