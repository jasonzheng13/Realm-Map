import axios from 'axios';

// One shared axios instance for the whole app.
// baseURL means every api call automatically starts with http://localhost:3001/api
// so you never have to type the full URL in your API functions.
// The request interceptor runs before EVERY outgoing request —
// it grabs the JWT from localStorage and attaches it as a Bearer token automatically.

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;