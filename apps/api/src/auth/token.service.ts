import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import { durationToMs } from '../common/duration';

export const AUTH_TOKEN_TYPES = {
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
} as const;
export type AuthTokenType = keyof typeof AUTH_TOKEN_TYPES;

const AUTH_TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Issues and validates the three token kinds used by auth:
 * short-lived access JWTs, hashed rotating refresh tokens, and one-shot
 * email-verify / password-reset tokens. Only hashes are stored.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async signAccessToken(userId: string): Promise<string> {
    const options: JwtSignOptions = {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ??
        '15m') as JwtSignOptions['expiresIn'],
    };
    return this.jwt.signAsync({ sub: userId }, options);
  }

  /** Creates a refresh-token row and returns the plaintext (shown once). */
  async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const ttl = durationToMs(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + ttl),
      },
    });
    return raw;
  }

  /** Validates + revokes the presented refresh token, returns its userId. */
  async consumeRefreshToken(raw: string): Promise<string> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!row || row.revokedAt) {
      throw new AppException('TOKEN_INVALID', 'Invalid refresh token');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new AppException('TOKEN_EXPIRED', 'Refresh token expired');
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return row.userId;
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Creates a one-shot verify/reset token and returns the plaintext. */
  async issueAuthToken(userId: string, type: AuthTokenType): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS[type]),
      },
    });
    return raw;
  }

  /** Validates + marks used a verify/reset token, returns its userId. */
  async consumeAuthToken(raw: string, type: AuthTokenType): Promise<string> {
    const row = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!row || row.type !== type || row.usedAt) {
      throw new AppException('TOKEN_INVALID', 'Invalid or used token');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new AppException('TOKEN_EXPIRED', 'Token expired');
    }
    await this.prisma.authToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return row.userId;
  }
}
