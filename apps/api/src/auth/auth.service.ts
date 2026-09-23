import { Injectable, Logger } from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AppException } from '../common/app-exception';
import { TokenService } from './token.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    createdAt: u.createdAt,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppException('CONFLICT', 'Email is already registered');
    }
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        status: UserStatus.PENDING,
      },
    });
    const token = await this.tokens.issueAuthToken(user.id, 'VERIFY_EMAIL');
    await this.mail.sendVerifyEmail(user.email, user.name, token);
    return {
      message:
        'Registered. Check your email to verify, then wait for a manager to approve your account.',
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const userId = await this.tokens.consumeAuthToken(token, 'VERIFY_EMAIL');
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { message: 'Email verified. A manager will approve your account.' };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: PublicUser;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) {
      throw new AppException('UNAUTHENTICATED', 'Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new AppException('EMAIL_NOT_VERIFIED', 'Email not verified');
    }
    if (user.status === UserStatus.PENDING) {
      throw new AppException(
        'ACCOUNT_PENDING',
        'Account awaiting manager approval',
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException('ACCOUNT_DISABLED', 'Account is disabled');
    }
    return {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const userId = await this.tokens.consumeRefreshToken(refreshToken);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllRefreshTokens(userId);
      throw new AppException('UNAUTHENTICATED', 'Account is not active');
    }
    return {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
    };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokens.revokeRefreshToken(refreshToken);
    return { message: 'Logged out' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    if (user) {
      const token = await this.tokens.issueAuthToken(user.id, 'RESET_PASSWORD');
      await this.mail.sendResetPassword(user.email, user.name, token);
    } else {
      this.logger.warn(`forgot-password for unknown email ${dto.email}`);
    }
    return {
      message: 'If that email exists, a reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.tokens.consumeAuthToken(
      dto.token,
      'RESET_PASSWORD',
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
      },
    });
    await this.tokens.revokeAllRefreshTokens(userId);
    return { message: 'Password updated. Please log in again.' };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');
    return toPublicUser(user);
  }
}
