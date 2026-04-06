import api from './axios';
import type { Waypoint } from '../types';

// getWaypoints accepts an optional dimension filter.
// If dimension is passed, the backend only returns waypoints for that dimension.
export const getWaypoints = (realmId: string, dimension?: string) =>
  api.get<Waypoint[]>('/waypoints', {
    params: { realm_id: realmId, dimension }
  });

export const createWaypoint = (data: {
  realm_id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  dimension: string;
  description?: string;
}) => api.post<Waypoint>('/waypoints', data);

export const updateWaypoint = (id: string, data: {
  name: string;
  x: number;
  y: number;
  z: number;
  dimension: string;
  description?: string;
}) => api.put<Waypoint>(`/waypoints/${id}`, data);

export const deleteWaypoint = (id: string) =>
  api.delete(`/waypoints/${id}`);