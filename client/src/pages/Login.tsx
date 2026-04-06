import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api/auth';
import netherBg from '../assets/realm_background.webp';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // stop browser from reloading the page
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      login(res.data.token, res.data.user);
      navigate('/realms');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center px-4 bg-[#1a0a2e]"
      style={{ backgroundImage: `url(${netherBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-baseline gap-1">
            <span
              className="font-mono font-black text-2xl tracking-widest text-fuchsia-400 uppercase px-3 py-1 border-2 border-purple-500 rounded-sm"
              style={{ textShadow: '2px 2px 0 #7e22ce, 0 0 12px #d946ef', background: 'rgba(88,28,135,0.4)' }}
            >
              REALM
            </span>
            <span className="font-mono text-2xl font-medium text-white tracking-wide">Map</span>
          </div>
          <p className="text-purple-300/60 text-sm mt-2">Sign in to your account</p>
        </div>

        <div
          className="rounded-xl p-6 border border-purple-900"
          style={{ background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-purple-300/80 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-purple-300/80 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-purple-400/50 text-sm mt-4">
          No account?{' '}
          <Link to="/register" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;