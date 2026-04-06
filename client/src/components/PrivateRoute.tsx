import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

// PrivateRoute is a wrapper component.
// If the user has a token → render whatever page is inside it.
// If no token → kick them to /login.
// Used in App.tsx like: <PrivateRoute><MapPage /></PrivateRoute>

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

export default PrivateRoute;