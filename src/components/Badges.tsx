import { CircleCheckBig, CircleX, Clock, GraduationCap } from 'lucide-react';
import type { AttendanceStatus, ExamType, GradeSymbol } from '../types';

/**
 * Badge für den Anwesenheitsstatus. Unterscheidet alle vier Zustände
 * korrekt — im alten Build wurden "Verspätet" und "Entschuldigt"
 * fälschlich als "Fehlt" dargestellt.
 */
export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case 'present':
      return (
        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold border border-emerald-100">
          <CircleCheckBig size={12} /> Anwesend
        </span>
      );
    case 'absent':
      return (
        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs font-bold border border-red-100">
          <CircleX size={12} /> Fehlt
        </span>
      );
    case 'late':
      return (
        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-bold border border-amber-100">
          <Clock size={12} /> Verspätet
        </span>
      );
    case 'excused':
      return (
        <span className="text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-xs font-bold border border-slate-100">
          Entschuldigt
        </span>
      );
    default:
      return null;
  }
}

/** Kleines, farbiges Badge für die Bewertungsstufe (1-5). */
export function ProgressBadge({ progress }: { progress: number | null | undefined }) {
  if (!progress) {
    return (
      <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded text-xs font-bold border border-gray-100">
        Keine Bewertung
      </span>
    );
  }

  const map: Record<number, { text: string; className: string }> = {
    5: { text: 'Sehr gut', className: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    4: { text: 'Gut', className: 'text-green-700 bg-green-50 border-green-100' },
    3: { text: 'Basis / Ok', className: 'text-blue-700 bg-blue-50 border-blue-100' },
    2: { text: 'Schwierigkeiten', className: 'text-amber-700 bg-amber-50 border-amber-100' },
    1: { text: 'Schlecht', className: 'text-red-700 bg-red-50 border-red-100' },
  };

  const entry = map[progress];
  if (!entry) {
    return (
      <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded text-xs font-bold border border-gray-100">
        Keine Bewertung
      </span>
    );
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${entry.className}`}>
      {entry.text}
    </span>
  );
}

/**
 * Badge für eine Schulnote (1-5). Umgekehrte Skala zur laufenden
 * Bewertung: hier ist 1 die beste Note.
 */
export function GradeBadge({
  grade,
  symbol,
}: {
  grade?: number | null;
  symbol?: GradeSymbol | null;
}) {
  const map: Record<number, string> = {
    1: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    2: 'text-green-700 bg-green-50 border-green-100',
    3: 'text-blue-700 bg-blue-50 border-blue-100',
    4: 'text-amber-700 bg-amber-50 border-amber-100',
    5: 'text-red-700 bg-red-50 border-red-100',
  };

  const symbolMap: Record<GradeSymbol, string> = {
    '+': 'text-emerald-700 bg-emerald-50 border-emerald-100',
    '~': 'text-amber-700 bg-amber-50 border-amber-100',
    '-': 'text-red-700 bg-red-50 border-red-100',
  };

  return (
    <span className="flex items-center gap-1">
      {grade ? (
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold border ${
            map[grade] || 'text-gray-500 bg-gray-50 border-gray-100'
          }`}
        >
          Note {grade}
        </span>
      ) : null}
      {symbol ? (
        <span
          className={`w-6 text-center py-0.5 rounded text-xs font-bold border ${symbolMap[symbol]}`}
        >
          {symbol === '-' ? '–' : symbol}
        </span>
      ) : null}
      {!grade && !symbol ? (
        <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded text-xs font-bold border border-gray-100">
          Offen
        </span>
      ) : null}
    </span>
  );
}

/** Badge für die Prüfungsart (Schularbeit / Test / Prüfung). */
export function ExamTypeBadge({ type }: { type: ExamType }) {
  const map: Record<ExamType, string> = {
    Schularbeit: 'text-violet-700 bg-violet-50 border-violet-100',
    Test: 'text-sky-700 bg-sky-50 border-sky-100',
    Prüfung: 'text-indigo-700 bg-indigo-50 border-indigo-100',
  };

  return (
    <span
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${map[type]}`}
    >
      <GraduationCap size={12} /> {type}
    </span>
  );
}
