import type { AttendanceStatus } from '../types';

// ---------------------------------------------------------------------------
// Datum & Zeit
// ---------------------------------------------------------------------------

/**
 * Formatiert ein ISO-Datum als "TT.MM.JJJJ".
 * Arbeitet rein auf dem Datumsteil, um Zeitzonen-Verschiebungen zu vermeiden.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const datePart = iso.slice(0, 10); // YYYY-MM-DD
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return '';
  return `${d}.${m}.${y}`;
}

/** Formatiert ein Date-Objekt als "TT.MM." (Tag und Monat). */
export function formatDayMonth(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.`;
}

/**
 * Wandelt ein Date in einen lokalen YYYY-MM-DD-String um.
 * WICHTIG: nutzt die lokalen Datumsteile, nicht toISOString(),
 * damit es keine Zeitzonen-Verschiebung um einen Tag gibt.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Liefert den ersten und letzten Tag eines Monats als YYYY-MM-DD-Strings.
 * Rein über die Kalenderteile berechnet (kein UTC), damit Protokolle vom
 * Monatsletzten korrekt im richtigen Monat landen.
 *
 * @param year  vierstelliges Jahr
 * @param month Monatsindex 0-11 (wie bei JavaScript-Date)
 */
export function monthRange(year: number, month: number): { first: string; last: string } {
  const firstDay = 1;
  const lastDay = new Date(year, month + 1, 0).getDate(); // Tag 0 des Folgemonats
  const mm = String(month + 1).padStart(2, '0');
  return {
    first: `${year}-${mm}-${String(firstDay).padStart(2, '0')}`,
    last: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Montag der Woche relativ zur aktuellen Woche.
 * @param weekOffset 0 = diese Woche, -1 = letzte, +1 = nächste
 */
export function getMonday(weekOffset = 0): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Sonntag
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Kürzt "HH:MM:SS" auf "HH:MM". */
export function shortTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

/**
 * Berechnet das Alter aus einem Geburtsdatum.
 * Gibt "-" zurück, wenn kein Datum vorhanden ist.
 */
export function ageFromBirthDate(birthDate: string | null | undefined): string {
  if (!birthDate) return '-';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age.toString();
}

/**
 * Dauer in Minuten zwischen zwei "HH:MM"- oder "HH:MM:SS"-Zeiten.
 * Fällt auf 60 zurück, wenn die Rechnung kein positives Ergebnis liefert.
 */
export function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : 60;
}

// ---------------------------------------------------------------------------
// Beschriftungen
// ---------------------------------------------------------------------------

/** Klartext zur Bewertungsstufe 1-5. */
export function progressLabel(progress: number): string {
  switch (progress) {
    case 5:
      return 'Sehr gut';
    case 4:
      return 'Gut';
    case 3:
      return 'Basis / Ok';
    case 2:
      return 'Schwierigkeiten';
    case 1:
      return 'Schlecht / Ungenügend';
    default:
      return 'Keine Bewertung';
  }
}

/** Klartext zum Anwesenheitsstatus. */
export function attendanceLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return 'Anwesend';
    case 'absent':
      return 'Fehlt';
    case 'late':
      return 'Verspätet';
    case 'excused':
      return 'Entschuldigt';
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// CSV-Export
// ---------------------------------------------------------------------------

/**
 * Exportiert ein Array von Objekten als CSV-Datei (Semikolon getrennt,
 * UTF-8 mit BOM für korrekte Umlaute in Excel) und löst den Download aus.
 */
export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows || rows.length === 0) return;

  const separator = ';';
  const keys = Object.keys(rows[0]);
  const header = keys.join(separator);

  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          let value = row[key];
          if (value === null || value === undefined) value = '';
          const text = value instanceof Date ? value.toLocaleString() : String(value);
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(separator),
    )
    .join('\n');

  const csv = '﻿' + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
