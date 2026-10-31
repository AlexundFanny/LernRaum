import { useState } from 'react';
import { ArrowRight, ChevronLeft, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'register' | 'forgot';

interface StatusMessage {
  type: 'error' | 'success';
  text: string;
}

/**
 * Login-, Registrierungs- und Passwort-vergessen-Ansicht.
 *
 * Registrierung ist nur mit Einladung möglich. Geprüft wird das ausschließlich
 * im Datenbank-Trigger (handle_new_user), der ohne gültige Einladung ablehnt
 * und neue Konten nie zu Admins macht. Es werden daher bewusst keine
 * Rollen-Daten in den Metadaten mitgeschickt.
 */
/** Übersetzt die häufigsten Supabase-Auth-Fehler ins Deutsche. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  // Wirft der Trigger handle_new_user (keine gültige Einladung), meldet
  // Supabase nur allgemein einen Datenbankfehler.
  if (m.includes('database error')) {
    return 'Für diese E-Mail gibt es keine offene Einladung. Bitte die Adresse prüfen oder bei der Leitung nachfragen.';
  }
  if (m.includes('already registered')) {
    return 'Für diese E-Mail gibt es bereits ein Konto. Bitte anmelden.';
  }
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort ist falsch.';
  if (m.includes('email not confirmed')) {
    return 'Die E-Mail-Adresse ist noch nicht bestätigt. Bitte den Link in der Bestätigungs-Mail öffnen.';
  }
  if (m.includes('password should be at least')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'Registrierungen sind in Supabase gerade deaktiviert.';
  }
  if (m.includes('rate limit')) return 'Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.';
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(translateAuthError(error.message));
      // onAuthStateChange im App-Rahmen übernimmt den Rest.
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Keine Vorab-Prüfung der Einladung im Browser: Die Tabelle
      // teacher_invites ist (zu Recht) nur für Admins lesbar, eine Abfrage vor
      // dem Login fände also nie etwas. Die Prüfung macht allein der
      // Datenbank-Trigger handle_new_user, der auch den Namen aus der
      // Einladung übernimmt.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error(translateAuthError(error.message));

      if (data.session) {
        // Ohne E-Mail-Bestätigung ist man sofort angemeldet;
        // onAuthStateChange im App-Rahmen übernimmt den Rest.
        return;
      }

      // Bei aktivierter E-Mail-Bestätigung meldet Supabase ein bereits
      // bestehendes Konto nicht als Fehler, sondern mit leeren identities.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('Für diese E-Mail gibt es bereits ein Konto. Bitte anmelden.');
      }

      setMessage({
        type: 'success',
        text: 'Konto erstellt! Bitte bestätige deine E-Mail über den Link, den wir dir geschickt haben, und melde dich dann an.',
      });
      setMode('login');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage({
        type: 'success',
        text: 'Link zum Zurücksetzen wurde gesendet! Bitte E-Mails prüfen.',
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Fehler beim Zurücksetzen';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1120] relative overflow-hidden">
      {/* Hintergrund-Leuchten */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary-900/20 blur-[100px]" />
        <div className="absolute top-[60%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary-900/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10 p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/10 p-8 rounded-3xl shadow-2xl transition-all duration-300">
          <div className="text-center mb-8">
            <img
              src="/logo.png"
              alt="LernRaum Protokoll"
              className="h-24 w-auto mx-auto mb-6 object-contain drop-shadow-lg rounded-xl"
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">LernRaum Protokoll</h1>
            {mode === 'forgot' && (
              <p className="text-slate-400 text-sm mt-2">Passwort zurücksetzen</p>
            )}
          </div>

          {message && (
            <div
              className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-2 ${
                message.type === 'error'
                  ? 'bg-red-500/10 text-red-200 border border-red-500/20'
                  : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <form
              onSubmit={mode === 'login' ? handleLogin : handleRegister}
              className="space-y-5 animate-fade-in"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-3">
                  E-Mail Adresse
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-sm shadow-inner"
                    placeholder="name@schule.at"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">
                    Passwort
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setMessage(null);
                      }}
                      className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                    >
                      Vergessen?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <div className="font-mono font-bold text-sm">***</div>
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-sm shadow-inner"
                    placeholder="Passwort eingeben"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 group"
              >
                {loading ? 'Verarbeite...' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
                {!loading && (
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5 animate-fade-in">
              <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl text-sm text-primary-100 mb-4">
                Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du dein Passwort
                sofort zurücksetzen kannst.
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-3">
                  E-Mail Adresse
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-sm shadow-inner"
                    placeholder="name@schule.at"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
              >
                {loading ? 'Sende...' : 'Passwort zurücksetzen'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setMessage(null);
                }}
                className="w-full py-2 text-slate-400 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
              >
                <ChevronLeft size={16} /> Zurück zur Anmeldung
              </button>
            </form>
          )}

          {mode !== 'forgot' && (
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setMessage(null);
                }}
                className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto font-medium"
              >
                {mode === 'login' ? (
                  <>
                    Neu hier? <span className="text-primary-400">Registrieren</span>
                  </>
                ) : (
                  <>
                    Bereits registriert? <span className="text-primary-400">Zur Anmeldung</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
