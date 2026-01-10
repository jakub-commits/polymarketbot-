import { Router, Request, Response } from 'express';
import { authService } from '../services/auth';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { user, tokens } = await authService.register(validatedData);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      data: {
        user,
        tokens,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    const isValidationError = error instanceof z.ZodError;

    res.status(isValidationError ? 400 : 409).json({
      success: false,
      error: isValidationError ? error.errors : message,
    });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(validatedData);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    res.json({
      success: true,
      data: {
        user,
        tokens,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    const isValidationError = error instanceof z.ZodError;

    res.status(isValidationError ? 400 : 401).json({
      success: false,
      error: isValidationError ? error.errors : message,
    });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.userId) {
      await authService.logout(req.user.userId);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    // Set new cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    res.json({
      success: true,
      data: { tokens },
    });
  } catch (error) {
    // Clear cookies on refresh failure
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    const user = await authService.getMe(req.user.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
});

export default router;
