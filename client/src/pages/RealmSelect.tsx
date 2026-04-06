import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRealms, createRealm, joinRealm } from '../api/realms';
import type { Realm } from '../types';
import netherBg from '../assets/realm_background.webp';

type ModalType = 'create' | 'join' | null;

const RealmSelect = () => {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [selectedRealm, setSelectedRealm] = useState<Realm | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [realmName, setRealmName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [newInviteCode, setNewInviteCode] = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Runs once when the component mounts — fetches the user's realms
  useEffect(() => {
    fetchRealms();
  }, []);

  const fetchRealms = async () => {
    try {
      const res = await getRealms();
      setRealms(res.data);
      if (res.data.length > 0) setSelectedRealm(res.data[0]);
    } catch {
      setError('Failed to load realms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRealm = async () => {
    if (!realmName.trim()) return;
    setModalError('');
    setModalLoading(true);
    try {
      const res = await createRealm(realmName.trim());
      const created = res.data;
      setRealms(prev => [...prev, created]);
      setSelectedRealm(created);
      setNewInviteCode(created.invite_code);
      setRealmName('');
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Failed to create realm');
    } finally {
      setModalLoading(false);
    }
  };

  const handleJoinRealm = async () => {
    if (!inviteCode.trim()) return;
    setModalError('');
    setModalLoading(true);
    try {
      const res = await joinRealm(inviteCode.trim().toUpperCase());
      const joined = res.data;
      setRealms(prev => [...prev, joined]);
      setSelectedRealm(joined);
      setModal(null);
      setInviteCode('');
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Invalid invite code');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEnterRealm = () => {
    if (!selectedRealm) return;
    navigate(`/map/${selectedRealm.id}`);
  };

  const closeModal = () => {
    setModal(null);
    setModalError('');
    setRealmName('');
    setInviteCode('');
    setNewInviteCode('');
    setModalLoading(false);
  };

  const Logo = () => (
    <div className="inline-flex items-baseline gap-1">
      <span
        className="font-mono font-black text-lg tracking-widest text-fuchsia-400 uppercase px-2 py-0.5 border-2 border-purple-500 rounded-sm"
        style={{ textShadow: '2px 2px 0 #7e22ce, 0 0 10px #d946ef', background: 'rgba(88,28,135,0.4)' }}
      >
        REALM
      </span>
      <span className="font-mono text-lg font-medium text-white tracking-wide">Map</span>
    </div>
  );

  return (
    <div
      className="min-h-screen relative flex flex-col bg-[#1a0a2e]"
      style={{ backgroundImage: `url(${netherBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      {/* Navbar */}
      <nav
        className="relative z-10 flex items-center justify-between px-6 h-14 border-b border-purple-900/60"
        style={{ background: 'rgba(15,10,25,0.85)', backdropFilter: 'blur(8px)' }}
      >
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-purple-300/60 text-sm">Hey, {user?.username}</span>
          <button
            onClick={logout}
            className="text-sm text-purple-400/60 hover:text-fuchsia-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-white">Your Realms</h2>
              <p className="text-sm text-purple-400/60 mt-0.5">Pick a realm to open its map</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModal('join')}
                className="text-sm border border-purple-900 text-purple-300/70 hover:border-fuchsia-500 hover:text-fuchsia-400 rounded-lg px-3 py-1.5 transition-colors"
              >
                Join realm
              </button>
              <button
                onClick={() => setModal('create')}
                className="text-sm bg-purple-900/40 border border-purple-700 text-fuchsia-300 hover:bg-purple-800/50 rounded-lg px-3 py-1.5 transition-colors"
              >
                + New realm
              </button>
            </div>
          </div>

          {loading && (
            <p className="text-purple-400/50 text-sm text-center py-8">Loading realms...</p>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center py-8">{error}</p>
          )}

          {!loading && !error && realms.length === 0 && (
            <div
              className="rounded-xl border border-purple-900/60 p-10 text-center"
              style={{ background: 'rgba(15,10,25,0.7)' }}
            >
              <p className="text-purple-300/50 text-sm">No realms yet.</p>
              <p className="text-purple-400/40 text-xs mt-1">Create one or join with an invite code.</p>
            </div>
          )}

          {!loading && realms.length > 0 && (
            <div className="space-y-2 mb-4">
              {realms.map(realm => (
                <div
                  key={realm.id}
                  onClick={() => setSelectedRealm(realm)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all"
                  style={{
                    background: selectedRealm?.id === realm.id ? 'rgba(126,34,206,0.2)' : 'rgba(15,10,25,0.75)',
                    borderColor: selectedRealm?.id === realm.id ? '#d946ef' : 'rgba(88,28,135,0.4)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'rgba(88,28,135,0.4)', border: '1px solid #6b21a8' }}
                  >
                    🌍
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{realm.name}</p>
                    <p className="text-xs text-purple-400/50 mt-0.5 font-mono">{realm.invite_code}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && realms.length > 0 && (
            <button
              onClick={handleEnterRealm}
              disabled={!selectedRealm}
              className="w-full bg-purple-800 hover:bg-purple-700 disabled:opacity-40 text-fuchsia-100 font-medium rounded-xl py-3 text-sm border border-purple-600 transition-colors"
            >
              Enter Realm →
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-purple-900 p-6"
            style={{ background: 'rgba(20,10,35,0.97)', backdropFilter: 'blur(12px)' }}
            onClick={e => e.stopPropagation()}
          >
            {modal === 'create' && (
              <>
                <h3 className="text-base font-medium text-white mb-4">Create a new realm</h3>
                {newInviteCode ? (
                  <div>
                    <p className="text-sm text-purple-300/70 mb-3">Realm created! Share this invite code:</p>
                    <div className="flex items-center justify-between bg-black/40 border border-purple-900 rounded-lg px-3 py-2 font-mono text-sm text-fuchsia-300">
                      <span>{newInviteCode}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(newInviteCode)}
                        className="text-xs text-purple-400 hover:text-fuchsia-400 transition-colors ml-2"
                      >
                        copy
                      </button>
                    </div>
                    <button
                      onClick={closeModal}
                      className="w-full mt-4 bg-purple-800 hover:bg-purple-700 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-purple-300/80 mb-1">Realm name</label>
                    <input
                      type="text"
                      value={realmName}
                      onChange={e => setRealmName(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors mb-4"
                      placeholder="Jason's Realm"
                    />
                    {modalError && <p className="text-red-400 text-xs mb-3">{modalError}</p>}
                    <div className="flex gap-2">
                      <button onClick={closeModal} className="flex-1 bg-transparent border border-purple-900 text-purple-400 rounded-lg py-2 text-sm hover:border-purple-600 transition-colors">Cancel</button>
                      <button
                        onClick={handleCreateRealm}
                        disabled={modalLoading || !realmName.trim()}
                        className="flex-1 bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
                      >
                        {modalLoading ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {modal === 'join' && (
              <>
                <h3 className="text-base font-medium text-white mb-1">Join a realm</h3>
                <p className="text-xs text-purple-400/50 mb-4">Ask your realm owner for the invite code</p>
                <label className="block text-sm text-purple-300/80 mb-1">Invite code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg px-3 py-2 text-white text-sm outline-none border border-purple-900 bg-black/40 focus:border-fuchsia-500 transition-colors font-mono mb-4"
                  placeholder="REALM-XXXXXX"
                />
                {modalError && <p className="text-red-400 text-xs mb-3">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 bg-transparent border border-purple-900 text-purple-400 rounded-lg py-2 text-sm hover:border-purple-600 transition-colors">Cancel</button>
                  <button
                    onClick={handleJoinRealm}
                    disabled={modalLoading || !inviteCode.trim()}
                    className="flex-1 bg-purple-800 hover:bg-purple-700 disabled:opacity-50 text-fuchsia-100 font-medium rounded-lg py-2 text-sm border border-purple-600 transition-colors"
                  >
                    {modalLoading ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealmSelect;