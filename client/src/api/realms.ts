import api from './axios';
import type { Realm } from '../types';

export const getRealms = () =>
  api.get<Realm[]>('/realms');

export const createRealm = (name: string) =>
  api.post<Realm>('/realms', { name });

export const joinRealm = (invite_code: string) =>
  api.post<Realm>('/realms/join', { invite_code });