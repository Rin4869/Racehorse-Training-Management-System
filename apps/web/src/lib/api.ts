import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorBody } from './types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({ baseURL });

const ACCESS_TOKEN_KEY = 'racehorse.accessToken';
const REFRESH_TOKEN_KEY = 'racehorse.refreshToken';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable — ignore */
  }
}

export const getAccessToken = () => read(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => read(REFRESH_TOKEN_KEY);

export function setTokens(
  tokens: { accessToken: string; refreshToken: string } | null,
): void {
  write(ACCESS_TOKEN_KEY, tokens?.accessToken ?? null);
  write(REFRESH_TOKEN_KEY, tokens?.refreshToken ?? null);
}

/** Called when a refresh attempt fails — wired up by AuthProvider. */
let onAuthLost: (() => void) | null = null;
export function setOnAuthLost(fn: (() => void) | null): void {
  onAuthLost = fn;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await axios.post<{
      accessToken: string;
      refreshToken: string;
    }>(`${baseURL}/auth/refresh`, { refreshToken });
    setTokens(res.data);
    return res.data.accessToken;
  } catch {
    setTokens(null);
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(original);
      }
      onAuthLost?.();
    }
    return Promise.reject(error);
  },
);

export function apiErrorCode(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.error?.code ?? 'INTERNAL';
  }
  return 'INTERNAL';
}

export function apiErrorMessage(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    return err.response?.data?.error?.message;
  }
  return undefined;
}
