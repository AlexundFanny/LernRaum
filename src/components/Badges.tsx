import { CircleCheckBig, CircleX, Clock, GraduationCap } from 'lucide-react';
import type { AttendanceStatus, ExamType, GradeSymbol } from '../types';

/*
 * Farbsystem der Anwendung — gilt für alle Komponenten:
 *   primary  Aktionen, aktive Zustände, Akzente (die einzige "bunte" Farbe
 *            für Bedienelemente — darum nie für Inhalte verwenden)
 *   slate    alle neutralen Flächen, Texte, Rahmen
 *   emerald  positiv, erledigt, anwesend
 *   amber    braucht Aufmerksamkeit, offen, verspätet
 *   red      negativ, Fehler, löschen
 *   navy     nur die Sidebar
 *
 * Badges sind durchgehend aufgebaut als: bg-<farbe>-50, border-<farbe>-200,
 * text-<farbe>-700.
 */

/** Einheitlicher Aufbau aller Badges. */
const BADGE = 'px-2 py-0.5 rounded text-xs font-bold border';

/** Neutrales Badge für "kein Wert vorhanden". */
const NEUTRAL = 'text-slate-400 bg-slate-50 border-slate-200';

/**
 * Gemeinsame, fünfstufige Skala von gut (Index 0) nach schlecht (Index 4).
 *
 * Beide Bewertungen im Projekt greifen darauf zu, nur in umgekehrter
 * Richtung — eine gute Leistung sieht damit überall gleich aus, obwohl die
 * Zahlen gegenläufig sind (laufende Bewertung 5 = sehr gut, Schulnote
 * 1 = Sehr gut). Die Mitte ist absichtlich neutral und nicht blau, weil
 * blau in dieser Anwendung für Bedienelemente reserviert ist.
 */
const RATING_SCALE = [
  'text-emerald-700 bg-emerald-50 border-emerald-200',
  'text-emerald-600 bg-emerald-50/60 border-emerald-100',
  'text-slate-600 bg-slate-50 border-slate-200',
  'text-amber-700 bg-amber-50 border-amber-200',
  'text-red-700 bg-red-50 border-red-200',
] as const;

/**
 * Badge für den Anwesenheitsstatus. Unterscheidet alle vier Zustände
 * korrekt — im alten Build wurden "Verspätet" und "Entschuldigt"
 * fälschlich als "Fehlt" dargestellt.
 */
export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case 'present':
      return (
        <span className={`${BADGE} ${RATING_SCALE[0]} flex items-center gap-1`}>
          <CircleCheckBig size={12} /> Anwesend
        </span>
      );
    case 'absent':
      return (
        <span className={`${BADGE} ${RATING_SCALE[4]} flex items-center gap-1`}>
          <CircleX size={12} /> Fehlt
        </span>
      );
    case 'late':
      return (
        <span className={`${BADGE} ${RATING_SCALE[3]} flex items-center gap-1`}>
          <Clock size={12} /> Verspätet
        </span>
      );
    case 'excused':
      return <span className={`${BADGE} ${RATING_SCALE[2]}`}>Entschuldigt</span>;
    default:
      return null;
  }
}

/**
 * Badge für die laufende Bewertung pro Einheit (1-5, wobei 5 sehr gut ist).
 */
export function ProgressBadge({ progress }: { progress: number | null | undefined }) {
  const labels: Record<number, string> = {
    5: 'Sehr gut',
    4: 'Gut',
    3: 'Basis / Ok',
    2: 'Schwierigkeiten',
    1: 'Schlecht',
  };

  const label = progress ? labels[progress] : undefined;
  if (!label) {
    return <span className={`${BADGE} ${NEUTRAL}`}>Keine Bewertung</span>;
  }

  // 5 ist die beste Stufe, also Skalenanfang.
  return <span className={`${BADGE} ${RATING_SCALE[5 - progress!]}`}>{label}</span>;
}

/**
 * Badge für die Bewertung einer Leistung: Schulnote 1-5 (1 = Sehr gut)
 * und/oder Symbol (+ ~ −). Nutzt dieselbe Skala wie ProgressBadge, nur in
 * umgekehrter Richtung.
 */
export function GradeBadge({
  grade,
  symbol,
}: {
  grade?: number | null;
  symbol?: GradeSymbol | null;
}) {
  const symbolScale: Record<GradeSymbol, string> = {
    '+': RATING_SCALE[0],
    '~': RATING_SCALE[2],
    '-': RATING_SCALE[4],
  };

  if (!grade && !symbol) {
    return <span className={`${BADGE} ${NEUTRAL}`}>Offen</span>;
  }

  return (
    <span className="flex items-center gap-1">
      {grade ? (
        <span className={`${BADGE} ${RATING_SCALE[grade - 1] || NEUTRAL}`}>Note {grade}</span>
      ) : null}
      {symbol ? (
        <span className={`${BADGE} ${symbolScale[symbol]} w-7 text-center`}>
          {symbol === '-' ? '–' : symbol}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Badge für die Prüfungsart. Bewusst neutral: die Farbe am Eintrag soll die
 * Bewertung zeigen, nicht die Art der Prüfung. Unterschieden wird über den
 * Text.
 */
export function ExamTypeBadge({ type }: { type: ExamType }) {
  return (
    <span className={`${BADGE} ${RATING_SCALE[2]} flex items-center gap-1`}>
      <GraduationCap size={12} /> {type}
    </span>
  );
}
