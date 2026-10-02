import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Calendar,
  ChevronLeft,
  Euro,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import type { Profile } from './types';
import { AuthScreen } from './components/AuthScreen';
import { TeacherDashboard } from './components/TeacherDashboard';
import { TeacherFees } from './components/TeacherFees';
import { Messages } from './components/Messages';
import { AdminPanel } from './components/admin/AdminPanel';

type View = 'auth' | 'teacher' | 'admin';
type Page = 'dashboard' | 'fees' | 'messages';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>('auth');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Passwort-Reset
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        void loadProfile(session.user.id);
      } else {
        setLoading(false);
        setView('auth');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (session) {
        void loadProfile(session.user.id);
      } else {
        setProfile(null);
        setView('auth');
        setRecoveryMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      setView((data as Profile).is_admin ? 'admin' : 'teacher');
    } catch (err) {
      console.error('Fehler beim Laden des Profils', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setView('auth');
    setRecoveryMode(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Passwort erfolgreich geändert!');
      setRecoveryMode(false);
      setNewPassword('');
    } catch (err) {
      alert('Fehler beim Ändern des Passworts: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-primary-600">Laden...</div>
    );
  }

  if (!session || view === 'auth') {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden relative">
      {/* Passwort-Reset-Overlay */}
      {recoveryMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-200">
            <div className="text-center mb-6">
              <div className="h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600">
                <KeyRound size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Neues Passwort setzen</h2>
              <p className="text-slate-500 mt-2">
                Bitte gib dein neues Passwort ein, um den Vorgang abzuschließen.
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Neues Passwort</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>
              <button
                disabled={savingPassword}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50"
              >
                {savingPassword ? 'Speichere...' : 'Passwort Speichern'}
              </button>
              <button
                type="button"
                onClick={() => setRecoveryMode(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm"
              >
                Abbrechen (Zum Dashboard)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile-Overlay für die Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-navy-950 text-slate-300 flex flex-col shadow-xl z-30 fixed md:static inset-y-0 left-0 w-64 transition-transform duration-300 overflow-x-hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 bg-navy-950/50">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
            <span className="font-bold text-lg text-white tracking-tight">LernRaum</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-6 flex flex-col gap-1">
          <div className="px-6 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Dashboard
          </div>

          {view === 'teacher' && (
            <>
              <NavItem
                icon={Calendar}
                label="Übersicht & Planer"
                isActive={page === 'dashboard'}
                onClick={() => {
                  setPage('dashboard');
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={Euro}
                label="Honorar & Protokolle"
                isActive={page === 'fees'}
                onClick={() => {
                  setPage('fees');
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={Mail}
                label="Mitteilungen"
                isActive={page === 'messages'}
                onClick={() => {
                  setPage('messages');
                  setSidebarOpen(false);
                }}
              />
            </>
          )}

          {view === 'admin' && (
            <>
              <NavItem
                icon={LayoutDashboard}
                label="Verwaltung"
                isActive={page === 'dashboard'}
                onClick={() => {
                  setPage('dashboard');
                  setSidebarOpen(false);
                }}
              />
              <NavItem
                icon={Mail}
                label="Mitteilungen"
                isActive={page === 'messages'}
                onClick={() => {
                  setPage('messages');
                  setSidebarOpen(false);
                }}
              />
            </>
          )}

          {/* Admins können zwischen Admin- und Lehreransicht wechseln */}
          {profile?.is_admin && (
            <div className="mt-8 border-t border-slate-800/50 pt-4">
              <div className="px-6 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Ansicht
              </div>
              <button
                onClick={() => {
                  setView(view === 'admin' ? 'teacher' : 'admin');
                  setPage('dashboard');
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-6 py-3 text-slate-400 hover:bg-navy-800 hover:text-white transition-all"
              >
                <Settings size={20} />
                <span>{view === 'admin' ? 'Lehrer-Ansicht' : 'Admin-Bereich'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-navy-900 border-t border-navy-800">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-primary-700 flex items-center justify-center font-bold text-white shrink-0 ring-2 ring-navy-800">
              {profile?.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{profile?.name}</div>
              <div className="text-xs text-slate-400 truncate">{profile?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 w-full p-2 rounded-lg transition-all border border-transparent hover:border-slate-700 px-2"
          >
            <LogOut size={16} />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Hauptbereich */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center shadow-sm z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:text-primary-600"
          >
            <Menu size={24} />
          </button>
          <span className="ml-4 font-bold text-slate-800">LernRaum</span>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          {view === 'teacher' && page === 'dashboard' && profile && (
            <TeacherDashboard profile={profile} />
          )}
          {view === 'teacher' && page === 'fees' && profile && <TeacherFees profile={profile} />}
          {view === 'admin' && page === 'dashboard' && profile && <AdminPanel profile={profile} />}
          {page === 'messages' && profile && <Messages profile={profile} />}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: typeof Calendar;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
        isActive
          ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20 rounded-r-lg mr-4'
          : 'text-slate-400 hover:bg-navy-800 hover:text-white'
      }`}
      title={label}
    >
      <Icon size={20} className={isActive ? 'text-white' : ''} />
      <span className="font-medium text-sm tracking-wide">{label}</span>
    </button>
  );
}
