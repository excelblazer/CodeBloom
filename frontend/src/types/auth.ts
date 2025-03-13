export interface User {
  email: string;
  isVerified: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  confirmPassword: string;
}

export interface MFAVerification {
  email: string;
  mfaCode: string;
}

export interface AuthResponse {
  message: string;
  error?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (credentials: RegisterCredentials) => Promise<AuthResponse>;
  verifyMFA: (verification: MFAVerification) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}
