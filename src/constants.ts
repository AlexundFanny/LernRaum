import type { LocationName } from './types';

/** Honorarsatz pro Stunde in Euro. Zentral an einer Stelle,
 *  damit eine Änderung nicht an mehreren Codestellen vergessen wird. */
export const HOURLY_RATE = 21;

/** Auswählbare Fächer in Protokoll und Einheitenplanung. */
export const SUBJECTS = [
  'Mathematik',
  'Deutsch',
  'Englisch',
  'Latein',
  'Französisch',
  'Spanisch',
  'Italienisch',
  'Rechnungswesen',
  'Lernstunde',
  'Sachunterricht',
  'Andere',
] as const;

/** Standorte des Instituts. */
export const LOCATIONS: LocationName[] = ['Floridsdorf', 'Wien Mitte'];

/**
 * Standard-Zeitblöcke. Eine Einheit dauert normalerweise 100 Minuten,
 * es gibt bis zu drei Blöcke pro Tag. Im Planer als Schnellauswahl,
 * die Zeiten bleiben trotzdem frei änderbar.
 */
export interface TimeBlock {
  label: string;
  start: string; // HH:MM
  end: string; // HH:MM
}

export const TIME_BLOCKS: TimeBlock[] = [
  { label: 'Block 1', start: '14:15', end: '15:55' },
  { label: 'Block 2', start: '16:00', end: '17:40' },
  { label: 'Block 3', start: '17:45', end: '19:25' },
];

/** Anwesenheitsoptionen mit Beschriftung. */
export const ATTENDANCE_OPTIONS = [
  { key: 'present', label: 'Anwesend' },
  { key: 'absent', label: 'Fehlt' },
  { key: 'late', label: 'Verspätet' },
  { key: 'excused', label: 'Entsch.' },
] as const;
