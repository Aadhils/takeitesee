export type UserRole = 'customer' | 'professional' | 'business' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  issuedAt: string;
}

export interface SignInInput {
  email: string;
  credential: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone?: string;
  credential: string;
}
