import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDTO, LoginDTO } from '../types';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data: RegisterDTO = req.body;

    const result = await AuthService.register(data);

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data: LoginDTO = req.body;

    const result = await AuthService.login(data);

    if (!result.success) {
      return res.status(401).json({
        error: true,
        message: result.message,
      });
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 * Token is actually invalidated on client side by removing it from storage
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;
