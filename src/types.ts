// Zentrale Typdefinitionen, abgeleitet aus der tatsächlichen
// Supabase-Datenbankstruktur (Stand: Oktober 2026).

/** Benutzerprofil (Lehrer oder Admin). Verknüpft mit auth.users. */
export interface Profile {
  id: string; // uuid, = auth.users.id
  email: string;
  name: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

/** Schüler-Stammdaten. */
export interface Student {
  id: number;
  name: string;
  grade: string | null; // Schulstufe / Klasse
  birth_date: string | null; // ISO-Datum
  parents: string | null;
  address: string | null;
  email: string | null;
  contact: string | null;
  notes: string | null;
  created_at: string;
}

/** Standorte des Instituts. */
export type LocationName = 'Floridsdorf' | 'Wien Mitte';

/** Eine geplante Unterrichtseinheit im Stundenplan. */
export interface Session {
  id: number;
  teacher_id: string | null;
  teacher_name: string | null;
  date: string; // ISO-Datum (YYYY-MM-DD)
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  location: string;
  series_id: string | null;
  notes: string | null;
  created_at: string;
  // Via Join geladen:
  session_students?: SessionStudent[];
}

/** Zuordnung eines Schülers (mit Fach) zu einer Einheit. */
export interface SessionStudent {
  id: number;
  session_id: number;
  student_id: number;
  student_name: string;
  subject: string | null;
}

/** Ein ausgefülltes Protokoll zu einer Einheit. */
export interface Protocol {
  id: number;
  session_id: number | null;
  teacher_id: string | null;
  teacher_name: string;
  date: string;
  subject: string;
  topic: string;
  duration: number; // in Minuten
  notes: string | null;
  homework: string | null;
  created_at: string;
  // Via Join geladen:
  protocol_attendance?: ProtocolAttendance[];
  sessions?: Session | null;
}

/** Anwesenheitsstatus eines Schülers. */
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

/** Pro-Schüler-Eintrag innerhalb eines Protokolls. */
export interface ProtocolAttendance {
  id: number;
  protocol_id: number;
  student_id: number;
  student_name: string;
  attendance: AttendanceStatus;
  progress: number; // 1-5 Bewertung
  notes: string;
  homework: string;
}

/** Einladung eines neuen Lehrers. */
export interface TeacherInvite {
  id: number;
  email: string;
  name: string;
  used: boolean;
  invited_by: string | null;
  invited_at: string;
}

/** Mitteilung ans Team. */
export interface Message {
  id: number;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

/** Offene Vertretungsanfrage. */
export interface SubstitutionRequest {
  id: number;
  session_id: number;
  original_teacher_id: string;
  created_at: string;
  // Via Join geladen:
  sessions?: Session | null;
}

/** Art einer erfassten Leistung. */
export type ExamType = 'Schularbeit' | 'Test' | 'Prüfung';

/** Symbol-Bewertung als Alternative zur Schulnote. */
export type GradeSymbol = '+' | '~' | '-';

/**
 * Eine Schularbeit / ein Test / eine Prüfung eines Schülers.
 *
 * Achtung, zwei Skalen: `ProtocolAttendance.progress` ist die laufende
 * Bewertung pro Einheit mit 5 = sehr gut. `grade_number` hier ist die
 * Schulnote mit 1 = Sehr gut. Bewertet wird per Note und/oder per Symbol;
 * sind beide leer, ist der Termin eingetragen, aber noch nicht benotet.
 */
export interface StudentAssessment {
  id: number;
  protocol_id: number | null;
  session_id: number | null;
  student_id: number;
  student_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  subject: string | null;
  exam_type: ExamType;
  exam_date: string; // ISO-Datum (YYYY-MM-DD)
  grade_number: number | null; // 1-5, 1 = Sehr gut
  grade_symbol: GradeSymbol | null;
  notes: string | null;
  created_at: string;
}
