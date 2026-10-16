import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { User, RegisterDTO, LoginDTO, AuthResponse, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-min-32-chars';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
const SALT_ROUNDS = 10;

export class AuthService {
  /**
   * Hash a password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare plain password with hashed password
   * @param plainPassword - Plain text password
   * @param hashedPassword - Bcrypt hashed password
   * @returns true if passwords match, false otherwise
   */
  static async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generate JWT token for user
   * @param userId - User ID
   * @param role - User role
   * @returns JWT token string
   */
  static generateToken(userId: number, role: UserRole): string {
    const payload = {
      userId,
      role,
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify and decode JWT token
   * @param token - JWT token string
   * @returns Decoded payload with userId and role
   * @throws Error if token is invalid or expired
   */
  static verifyToken(token: string): { userId: number; role: UserRole } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        role: UserRole;
      };
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Register a new user
   * @param data - Registration data (email, password, name, optional role)
   * @returns Auth response with token and user
   */
  static async register(data: RegisterDTO): Promise<AuthResponse> {
    const { email, password, name, role = 'customer' } = data;
    const validRoles: UserRole[] = ['customer', 'agent', 'admin'];
    const sanitizedRole: UserRole = validRoles.includes(role as UserRole) ? (role as UserRole) : 'customer';

    // Validate inputs
    if (!email || !password || !name) {
      return {
        success: false,
        message: 'Email, password, and name are required',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: 'Invalid email format',
      };
    }

    // Validate password length
    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters',
      };
    }

    // Check if email already exists
    const exists = await UserModel.emailExists(email);
    if (exists) {
      return {
        success: false,
        message: 'Email already exists',
      };
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await UserModel.create(email, passwordHash, name, sanitizedRole);

    // Generate token
    const token = this.generateToken(user.id, user.role);

    return {
      success: true,
      token,
      user,
    };
  }

  /**
   * Login user with email and password
   * @param data - Login credentials
   * @returns Auth response with token and user
   */
  static async login(data: LoginDTO): Promise<AuthResponse> {
    const { email, password } = data;

    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    // Find user by email
    const userWithPassword = await UserModel.findByEmail(email);
    if (!userWithPassword) {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Compare passwords
    const isMatch = await this.comparePassword(
      password,
      userWithPassword.passwordHash
    );
    if (!isMatch) {
      return {
        success: false,
        message: 'Invalid email or password',
      };
    }

    // Create user object without password
    const user: User = {
      id: userWithPassword.id,
      email: userWithPassword.email,
      name: userWithPassword.name,
      role: userWithPassword.role,
      createdAt: userWithPassword.createdAt,
    };

    // Generate token
    const token = this.generateToken(user.id, user.role);

    return {
      success: true,
      token,
      user,
    };
  }
}
