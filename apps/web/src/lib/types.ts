export type Role = 'MANAGER' | 'TRAINER' | 'VET' | 'GROOM' | 'OWNER';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export type HorseStatus = 'ACTIVE' | 'RESTING' | 'RETIRED';
export type SessionStatus = 'PLANNED' | 'DONE' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface Horse {
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  ownerId: string;
  owner: UserRef;
  status: HorseStatus;
  photoPath: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TrainingSession {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  trainerId: string;
  trainer: UserRef;
  scheduledAt: string;
  type: string;
  status: SessionStatus;
  resultMetric: string | null;
  resultValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecord {
  id: string;
  horseId: string;
  horse: { id: string; name: string; ownerId: string };
  vetId: string;
  vet: UserRef;
  examDate: string;
  diagnosis: string;
  treatment: string | null;
  attachmentPath: string | null;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
