import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import RealmSelect from './pages/RealmSelect';
import MapPage from './pages/MapPage';

// App.tsx is the router — it maps URLs to pages.
// AuthProvider wraps everything so every page can access login state.
// PrivateRoute protects any page that needs a logged-in user.
// The * route catches anything unrecognised and redirects to /login.

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/realms" element={
            <PrivateRoute><RealmSelect /></PrivateRoute>
          } />
          <Route path="/map/:realmId" element={
            <PrivateRoute><MapPage /></PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;