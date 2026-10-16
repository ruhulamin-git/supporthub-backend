import pool from '../config/database';
import { User, UserWithPassword, UserRole } from '../types';

export class UserModel {
  /**
   * Create a new user in the database
   * @param email - User email (must be unique)
   * @param passwordHash - Bcrypt hashed password
   * @param name - User full name
   * @param role - User role (customer, agent, admin)
   * @returns Created user (without password)
   */
  static async create(
    email: string,
    passwordHash: string,
    name: string,
    role: UserRole = 'customer'
  ): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role, created_at
    `;
    
    const result = await pool.query(query, [email, passwordHash, name, role]);
    const row = result.rows[0];
    
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at
    };
  }

  /**
   * Find user by email (includes password hash for authentication)
   * @param email - User email
   * @returns User with password hash, or null if not found
   */
  static async findByEmail(email: string): Promise<UserWithPassword | null> {
    const query = `
      SELECT id, email, password_hash, name, role, created_at
      FROM users
      WHERE email = $1
    `;
    
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      role: row.role,
      createdAt: row.created_at
    };
  }

  /**
   * Find user by ID (without password hash)
   * @param id - User ID
   * @returns User or null if not found
   */
  static async findById(id: number): Promise<User | null> {
    const query = `
      SELECT id, email, name, role, created_at
      FROM users
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at
    };
  }

  /**
   * Get all users with a specific role
   * @param role - User role to filter by
   * @returns Array of users
   */
  static async findByRole(role: UserRole): Promise<User[]> {
    const query = `
      SELECT id, email, name, role, created_at
      FROM users
      WHERE role = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [role]);
    
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at
    }));
  }

  /**
   * Check if email already exists in database
   * @param email - Email to check
   * @returns true if email exists, false otherwise
   */
  static async emailExists(email: string): Promise<boolean> {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)';
    const result = await pool.query(query, [email]);
    return result.rows[0].exists;
  }
}
