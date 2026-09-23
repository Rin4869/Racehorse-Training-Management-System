import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable error codes returned to clients so the frontend can localise messages.
 * Keep in sync with docs/PLAN.md §4.
 */
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_PENDING'
  | 'ACCOUNT_DISABLED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<AppErrorCode, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  EMAIL_NOT_VERIFIED: HttpStatus.FORBIDDEN,
  ACCOUNT_PENDING: HttpStatus.FORBIDDEN,
  ACCOUNT_DISABLED: HttpStatus.FORBIDDEN,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  TOKEN_EXPIRED: HttpStatus.UNAUTHORIZED,
  TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Throw this anywhere in the app. The global exception filter renders it as
 * `{ error: { code, message, details? } }`.
 */
export class AppException extends HttpException {
  constructor(
    readonly code: AppErrorCode,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code, STATUS_BY_CODE[code]);
  }
}
