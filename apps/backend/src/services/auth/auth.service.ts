import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

class AuthService {
  private readonly SALT_ROUNDS = 12;

  async register(input: RegisterInput): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    const { email, password, name } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
      },
    });

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    logger.info({ userId: user.id }, 'User registered successfully');

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  async login(input: LoginInput): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    // Update user with refresh token and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: tokens.refreshToken,
        lastLoginAt: new Date(),
      },
    });

    logger.info({ userId: user.id }, 'User logged in successfully');

    // Return user without password hash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    logger.info({ userId }, 'User logged out');
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid refresh token');
    }

    // Find user with matching refresh token
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        refreshToken,
        isActive: true,
      },
    });

    if (!user) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    // Update refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return tokens;
  }

  async getMe(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      return null;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid token');
    }
  }

  private generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }
}

export const authService = new AuthService();
