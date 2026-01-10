import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock config
jest.mock('../../../config', () => ({
  config: {
    jwtSecret: 'test-jwt-secret-that-is-at-least-32-characters',
    jwtExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock PrismaClient
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import after mocking
import { authService } from '../../../services/auth';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        name: 'Test User',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        refreshToken: null,
        lastLoginAt: null,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: 'refresh-token' });

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('User with this email already exists');
    });

    it('should throw error if password is too short', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'short',
        })
      ).rejects.toThrow('Password must be at least 8 characters long');
    });
  });

  describe('login', () => {
    it('should return user and tokens on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        name: 'Test User',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        refreshToken: null,
        lastLoginAt: null,
        verificationToken: null,
        resetToken: null,
        resetTokenExpiry: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: 'refresh-token' });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw error on invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error on invalid password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        isActive: true,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error if account is disabled', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        isActive: false,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Account is disabled');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', async () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        'test-jwt-secret-that-is-at-least-32-characters'
      );

      const payload = await authService.verifyToken(token);

      expect(payload.userId).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });

    it('should throw error on invalid token', async () => {
      await expect(authService.verifyToken('invalid-token')).rejects.toThrow('Invalid token');
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123', refreshToken: null });

      await authService.logout('user-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { refreshToken: null },
      });
    });
  });
});
