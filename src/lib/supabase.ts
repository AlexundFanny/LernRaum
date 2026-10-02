import { createClient } from '@supabase/supabase-js';

// Zugangsdaten kommen aus den Umgebungsvariablen (.env).
// Als Rückfall werden die bekannten Produktivwerte genutzt, damit die App
// auch ohne .env-Datei startet. Der Anon-Key ist für den Browser bestimmt
// und öffentlich; der Datenschutz liegt in den RLS-Regeln der Datenbank.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://nbwjpkoipjqwekgqyfbd.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5id2pwa29pcGpxd2VrZ3F5ZmJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNTY5MzIsImV4cCI6MjA4MDYzMjkzMn0.zTgEwNck2Lp0lGK0Mb9VYSnOXSuWFLWa_67S48Ffcms';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
