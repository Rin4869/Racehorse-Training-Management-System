import { createContext } from 'react';
import type { User } from '../lib/types';

/** Thrown by loginWithGoogle() when the Google account is brand new and
 * must confirm an emailed OTP before it can be created as PENDING. */
export class OtpRequiredError extends Error {
  readonly email: string;
  constructor(email: string) {
    super('otp required');
    this.email = email;
  }
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
