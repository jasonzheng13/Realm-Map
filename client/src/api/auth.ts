import api from './axios';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export const register = (username: string, email: string, password: string) =>
  api.post<AuthResponse>('/auth/register', { username, email, password });

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password });