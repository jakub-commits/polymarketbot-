import { Request, Response, NextFunction } from 'express';
import { authService, TokenPayload } from '../services/auth';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header or cookie
    let token = req.headers.authorization?.replace('Bearer ', '');

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Verify token
    const payload = await authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.headers.authorization?.replace('Bearer ', '');

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const payload = await authService.verifyToken(token);
      req.user = payload;
    }

    next();
  } catch {
    // Token invalid but continue without auth
    next();
  }
};
