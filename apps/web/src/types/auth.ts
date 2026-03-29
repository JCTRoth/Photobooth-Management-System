export type AuthRole = 'Admin' | 'MarriageUser';

export interface AuthState {
  accessToken: string | null;
  role: AuthRole | null;
  eventId: string | null;
  eventName: string | null;
  mustChangePassword: boolean;
}

export interface AdminLoginResponse {
  requiresCode: boolean;
  accessToken?: string;
  role?: 'Admin';
  mustChangePassword?: boolean;
}

export interface AdminVerifyResponse {
  accessToken: string;
  role: 'Admin';
  mustChangePassword: boolean;
}

export interface AdminPasswordResetResponse {
  message: string;
}

export interface RefreshResponse {
  accessToken: string;
  mustChangePassword?: boolean;
}

export interface MarriageVerifyResponse {
  accessToken: string;
  role: 'MarriageUser';
  eventId: string;
  eventName: string;
}

export interface MarriageEmailStatus {
  id: string;
  email: string;
  status: 'Pending' | 'Confirmed' | 'Expired';
  verifiedAt: string | null;
  lastSentAt: string | null;
}
