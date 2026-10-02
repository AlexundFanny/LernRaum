import { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  BookOpen,
  CircleCheckBig,
  Clock,
  GraduationCap,
  Plus,
  Trash2,
  MessageSquare,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, durationMinutes, shortTime } from '../lib/helpers';
import {
  SUBJECTS,
  ATTENDANCE_OPTIONS,
  EXAM_TYPES,
  SCHOOL_GRADES,
  GRADE_SYMBOLS,
} from '../constants';
import type {
  AttendanceStatus,
  ExamType,
  GradeSymbol,
  Session,
  StudentAssessment,
} from '../types';
import { Modal } from './Modal';
import { StudentHistoryModal } from './StudentHistoryModal';
import { ExamTypeBadge, GradeBadge } from './Badges';

/** Ein Schülerzeile im Protokoll (Entwurfszustand). */
interface AttendanceRow {
  id?: number;
  student_id: number;
  student_name: string;
  attendance: AttendanceStatus;
  progress: number;
  notes: string;
  homework: string;
}

/**
 * Eine Leistung (Schularbeit / Test / Prüfung) im Entwurfszustand.
 *
 * Gezeigt werden alle Leistungen des Schülers, nicht nur die aus dieser
 * Einheit — so sieht der Lehrer auch eine angekündigte Schularbeit, die ein
 * Kollege eingetragen hat. Ändern darf er nur die eigenen Einträge, weil
 * die Sicherheitsregeln der Datenbank nichts anderes zulassen.
 */
interface AssessmentDraft {
  key: string; // stabiler React-Key, auch für ungespeicherte Zeilen
  id?: number; // gesetzt = liegt bereits in der Datenbank
  student_id: number;
  student_name: string;
  exam_type: ExamType;
  exam_date: string;
  grade_number: number | null;
  grade_symbol: GradeSymbol | null;
  teacher_name: string | null;
  editable: boolean;
}

let draftCounter = 0;
function nextDraftKey(): string {
  draftCounter += 1;
  return `neu-${draftCounter}`;
}

interface ProtocolModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  currentProfileId: string;
  currentProfileName: string;
  isAdmin?: boolean;
}

/**
 * Dialog zum Erfassen/Bearbeiten eines Protokolls zu einer Einheit.
 * Pro Schüler: Anwesenheit, Bewertung, Kommentar, Hausübung.
 * Für die Gruppe: Fach, Thema, Notizen, Hausaufgaben.
 */
export function ProtocolModal({
  session,
  isOpen,
  onClose,
  onSave,
  currentProfileId,
  currentProfileName,
  isAdmin = false,
}: ProtocolModalProps) {
  const [saving, setSaving] = useState(false);
  const [protocolId, setProtocolId] = useState<number | null>(null);
  const [protocolTeacherId, setProtocolTeacherId] = useState<string | null>(null);
  const [subUnavailable, setSubUnavailable] = useState(false); // Vertretung bereits angefragt?

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentDraft[]>([]);
  const [removedAssessmentIds, setRemovedAssessmentIds] = useState<number[]>([]);
  const [historyStudent, setHistoryStudent] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (session && isOpen) {
      void loadProtocol();
      void checkSubstitution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isOpen]);

  async function checkSubstitution() {
    if (!session) return;
    const { data } = await supabase
      .from('substitution_requests')
      .select('id')
      .eq('session_id', session.id)
      .maybeSingle();
    setSubUnavailable(!!data);
  }

  async function loadProtocol() {
    if (!session) return;
    setSaving(true);
    try {
      // Schüler der Einheit laden
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*, session_students(student_id, student_name, subject)')
        .eq('id', session.id)
        .single();

      const sessionStudents =
        sessionData?.session_students || session.session_students || [];

      const rowMap = new Map<number, AttendanceRow>();
      sessionStudents.forEach((s: { student_id: number; student_name: string }) => {
        rowMap.set(s.student_id, {
          student_id: s.student_id,
          student_name: s.student_name,
          attendance: 'present',
          progress: 3,
          notes: '',
          homework: '',
        });
      });

      // Vorhandenes Protokoll laden
      const { data: existing } = await supabase
        .from('protocols')
        .select('*, protocol_attendance(*)')
        .eq('session_id', session.id)
        .maybeSingle();

      if (existing) {
        setProtocolId(existing.id);
        setProtocolTeacherId(existing.teacher_id);
        setSubject(existing.subject);
        setTopic(existing.topic);
        setNotes(existing.notes || '');
        setHomework(existing.homework || '');

        if (existing.protocol_attendance && Array.isArray(existing.protocol_attendance)) {
          existing.protocol_attendance.forEach(
            (a: {
              id: number;
              student_id: number;
              student_name: string;
              attendance: AttendanceStatus;
              progress: number;
              notes: string;
              homework: string;
            }) => {
              rowMap.set(a.student_id, {
                id: a.id,
                student_id: a.student_id,
                student_name: a.student_name,
                attendance: a.attendance || 'present',
                progress: a.progress || 3,
                notes: a.notes || '',
                homework: a.homework || '',
              });
            },
          );
        }
      } else {
        setProtocolId(null);
        setProtocolTeacherId(null);
        setSubject('');
        setTopic('');
        setNotes('');
        setHomework('');
      }

      setRows(Array.from(rowMap.values()));
      await loadAssessments(Array.from(rowMap.keys()));
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setSaving(false);
    }
  }

  /** Alle bisher erfassten Leistungen der Schüler dieser Einheit. */
  async function loadAssessments(studentIds: number[]) {
    setRemovedAssessmentIds([]);
    if (studentIds.length === 0) {
      setAssessments([]);
      return;
    }

    const { data, error } = await supabase
      .from('student_assessments')
      .select('*')
      .in('student_id', studentIds)
      .order('exam_date', { ascending: false });

    if (error) {
      console.error('Leistungen konnten nicht geladen werden:', error);
      setAssessments([]);
      return;
    }

    setAssessments(
      ((data as StudentAssessment[]) || []).map((a) => ({
        key: `db-${a.id}`,
        id: a.id,
        student_id: a.student_id,
        student_name: a.student_name,
        exam_type: a.exam_type,
        exam_date: a.exam_date,
        grade_number: a.grade_number,
        grade_symbol: a.grade_symbol,
        teacher_name: a.teacher_name,
        editable: isAdmin || a.teacher_id === currentProfileId,
      })),
    );
  }

  function updateRow(studentId: number, field: keyof AttendanceRow, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)),
    );
  }

  /** Neue, leere Leistungszeile für einen Schüler. Datum = Datum der Einheit. */
  function addAssessment(studentId: number, studentName: string) {
    setAssessments((prev) => [
      ...prev,
      {
        key: nextDraftKey(),
        student_id: studentId,
        student_name: studentName,
        exam_type: 'Schularbeit',
        exam_date: session?.date || '',
        grade_number: null,
        grade_symbol: null,
        teacher_name: currentProfileName,
        editable: true,
      },
    ]);
  }

  function updateAssessment(key: string, patch: Partial<AssessmentDraft>) {
    setAssessments((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  /** Leistungen eines Schülers, neueste zuerst. */
  function assessmentsFor(studentId: number): AssessmentDraft[] {
    return assessments
      .filter((a) => a.student_id === studentId)
      .sort((a, b) => b.exam_date.localeCompare(a.exam_date));
  }

  function removeAssessment(key: string) {
    const target = assessments.find((a) => a.key === key);
    if (target?.id) {
      if (!confirm('Diesen Eintrag wirklich entfernen?')) return;
      setRemovedAssessmentIds((prev) => [...prev, target.id as number]);
    }
    setAssessments((prev) => prev.filter((a) => a.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || saving) return;

    // Die Datenbank verlangt mindestens eine der beiden Bewertungsarten.
    // Lieber hier abfangen als den Nutzer in einen Constraint-Fehler laufen
    // lassen, bei dem schon das halbe Protokoll geschrieben wäre.
    const unrated = assessments.find(
      (a) => a.editable && a.grade_number === null && a.grade_symbol === null,
    );
    if (unrated) {
      alert(
        `Bitte bei der Leistung von ${unrated.student_name} eine Note oder ein Symbol auswählen.`,
      );
      return;
    }
    const undated = assessments.find((a) => a.editable && !a.exam_date);
    if (undated) {
      alert(`Bitte bei der Leistung von ${undated.student_name} ein Datum angeben.`);
      return;
    }

    setSaving(true);
    try {
      const minutes = durationMinutes(session.start_time, session.end_time);
      const isNew = !protocolId;

      // Bei Admin-Bearbeitung die Werte der Einheit beibehalten
      const teacherId =
        isAdmin && session.teacher_id ? session.teacher_id : protocolTeacherId || currentProfileId;
      const teacherName =
        isAdmin && session.teacher_name ? session.teacher_name : currentProfileName;

      let pid = protocolId;

      if (isNew) {
        const { data, error } = await supabase
          .from('protocols')
          .insert({
            session_id: session.id,
            teacher_id: currentProfileId,
            teacher_name: teacherName,
            date: session.date,
            subject,
            topic,
            duration: minutes,
            notes,
            homework,
          })
          .select()
          .single();
        if (error) throw error;
        if (!data) throw new Error('Keine ID zurückerhalten');
        pid = data.id;
      } else {
        const { error } = await supabase
          .from('protocols')
          .update({
            date: session.date,
            subject,
            topic,
            duration: minutes,
            notes,
            homework,
            teacher_name: teacherName,
          })
          .eq('id', pid);
        if (error) throw error;
      }

      // Anwesenheitszeilen speichern
      if (pid && rows.length > 0) {
        const payload = rows.map((r) => {
          const entry: Record<string, unknown> = {
            protocol_id: pid,
            student_id: r.student_id,
            student_name: r.student_name,
            attendance: r.attendance,
            progress: r.progress,
            notes: r.notes,
            homework: r.homework,
          };
          if (r.id) entry.id = r.id;
          return entry;
        });

        const { error } = await supabase.from('protocol_attendance').upsert(payload);
        if (error) {
          console.warn('Vollständiges Speichern der Anwesenheit fehlgeschlagen', error);
          const existingOnly = payload.filter((p) => p.id);
          if (existingOnly.length > 0) {
            await supabase.from('protocol_attendance').upsert(existingOnly);
            alert('Hinweis: Nur bestehende Einträge wurden aktualisiert.');
          } else {
            throw error;
          }
        }
      }

      // Leistungen (SA/Test/Prüfung) speichern
      if (removedAssessmentIds.length > 0) {
        const { error } = await supabase
          .from('student_assessments')
          .delete()
          .in('id', removedAssessmentIds);
        if (error) throw error;
      }

      const newAssessments = assessments.filter((a) => !a.id);
      if (newAssessments.length > 0) {
        const { error } = await supabase.from('student_assessments').insert(
          newAssessments.map((a) => ({
            protocol_id: pid,
            session_id: session.id,
            student_id: a.student_id,
            student_name: a.student_name,
            teacher_id: currentProfileId,
            teacher_name: currentProfileName,
            subject,
            exam_type: a.exam_type,
            exam_date: a.exam_date,
            grade_number: a.grade_number,
            grade_symbol: a.grade_symbol,
          })),
        );
        if (error) throw error;
      }

      for (const a of assessments.filter((x) => x.id && x.editable)) {
        const { error } = await supabase
          .from('student_assessments')
          .update({
            exam_type: a.exam_type,
            exam_date: a.exam_date,
            grade_number: a.grade_number,
            grade_symbol: a.grade_symbol,
          })
          .eq('id', a.id);
        if (error) throw error;
      }

      // Bei neuem Protokoll ggf. Lehrer-Zuordnung anpassen
      if (isNew && pid && teacherId !== currentProfileId) {
        await supabase.from('protocols').update({ teacher_id: teacherId }).eq('id', pid);
      }

      onSave();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Speichern fehlgeschlagen:', err);
      alert('Fehler beim Speichern: ' + message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!protocolId) return;
    if (!confirm('Protokoll wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    if (saving) return;
    setSaving(true);
    try {
      await supabase.from('protocol_attendance').delete().eq('protocol_id', protocolId);
      await supabase.from('protocols').delete().eq('id', protocolId);
      onSave();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Löschen fehlgeschlagen: ' + message);
      setSaving(false);
    }
  }

  async function requestSubstitution() {
    if (!session) return;
    if (
      !confirm(
        'Möchten Sie diese Einheit wirklich zur Vertretung freigeben? Andere Lehrer können diese dann übernehmen.',
      )
    )
      return;
    setSaving(true);
    try {
      const { error } = await supabase.from('substitution_requests').insert({
        session_id: session.id,
        original_teacher_id: currentProfileId,
      });
      if (error) throw error;
      setSubUnavailable(true);
      onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      alert('Fehler: ' + message);
    } finally {
      setSaving(false);
    }
  }

  if (!session) return null;

  const canDelete = isAdmin || (!!protocolId && protocolTeacherId === currentProfileId);
  const isFuture = new Date(session.date) >= new Date(new Date().setHours(0, 0, 0, 0));
  const isOwner = session.teacher_id === currentProfileId;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Protokollierung" maxWidth="max-w-4xl">
        {/* Kopfzeile mit Einheiten-Infos */}
        <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 text-sm text-slate-700 items-center shadow-sm relative">
          <div className="flex items-center gap-2 font-medium bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Clock size={16} className="text-primary-600" /> {formatDate(session.date)},{' '}
            {shortTime(session.start_time)} - {shortTime(session.end_time)}
          </div>
          <div className="bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            {session.location}
          </div>
          {isAdmin && session.teacher_name && (
            <div className="bg-white px-4 py-1.5 rounded-xl border border-slate-200 font-medium text-primary-700 shadow-sm">
              Lehrer: {session.teacher_name}
            </div>
          )}
          {isOwner && isFuture && !protocolId && (
            <div className="ml-auto">
              {subUnavailable ? (
                <span className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg animate-fade-in">
                  <ArrowRightLeft size={14} /> Vertretung gesucht
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestSubstitution}
                  disabled={saving}
                  className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-all"
                >
                  {saving ? (
                    'Sende Anfrage...'
                  ) : (
                    <>
                      <ArrowRightLeft size={14} /> Vertretung suchen
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Anwesenheit & Bewertung */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <UserPlus size={18} className="text-gray-500" />
              <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                Anwesenheit &amp; Bewertung
              </h4>
            </div>
            <div className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">
                  Keine Schüler in dieser Einheit zugeordnet.
                </div>
              )}
              {rows.map((row) => (
                <div key={row.student_id} className="p-5 hover:bg-gray-50 transition-colors group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 lg:w-1/4">
                      <span className="font-bold text-gray-800 text-lg">{row.student_name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHistoryStudent({ id: row.student_id, name: row.student_name })
                        }
                        className="text-gray-400 hover:text-primary-600 hover:bg-white p-1.5 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                        title="Verlauf anzeigen"
                      >
                        <Clock size={16} />
                      </button>
                    </div>
                    <div className="flex gap-1.5 bg-gray-100/80 p-1.5 rounded-xl self-start border border-gray-200">
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => updateRow(row.student_id, 'attendance', opt.key)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            row.attendance === opt.key
                              ? 'bg-white text-primary-700 shadow-sm ring-1 ring-gray-200'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 self-start lg:self-center w-full lg:w-auto">
                      <label className="text-xs text-gray-400 font-bold uppercase whitespace-nowrap lg:hidden">
                        Bewertung:
                      </label>
                      <select
                        value={row.progress}
                        onChange={(e) =>
                          updateRow(row.student_id, 'progress', parseInt(e.target.value))
                        }
                        className="w-full lg:w-auto px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-sm"
                      >
                        <option value={5}>Sehr gut</option>
                        <option value={4}>Gut</option>
                        <option value={3}>Basis / Ok</option>
                        <option value={2}>Schwierigkeiten</option>
                        <option value={1}>Schlecht</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-1">
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within/input:text-primary-500 transition-colors">
                        <MessageSquare size={14} />
                      </div>
                      <input
                        type="text"
                        value={row.notes || ''}
                        onChange={(e) => updateRow(row.student_id, 'notes', e.target.value)}
                        placeholder="Kommentar..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-200 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder-gray-400 hover:bg-white hover:border-gray-200"
                      />
                    </div>
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within/input:text-primary-500 transition-colors">
                        <BookOpen size={14} />
                      </div>
                      <input
                        type="text"
                        value={row.homework || ''}
                        onChange={(e) => updateRow(row.student_id, 'homework', e.target.value)}
                        placeholder="Hausübung..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-200 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder-gray-400 hover:bg-white hover:border-gray-200"
                      />
                    </div>
                  </div>

                  {/* Leistungen: Schularbeit / Test / Prüfung mit Note.
                      Kommt zusätzlich zur laufenden Bewertung oben. */}
                  <div className="mt-4 pl-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap size={12} /> Schularbeiten, Tests &amp; Prüfungen
                      </div>
                      <button
                        type="button"
                        onClick={() => addAssessment(row.student_id, row.student_name)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-2 py-1 rounded-lg transition-all"
                      >
                        <Plus size={12} /> Hinzufügen
                      </button>
                    </div>

                    {assessmentsFor(row.student_id).length === 0 ? (
                      <div className="text-xs text-gray-400 italic bg-gray-50/60 border border-dashed border-gray-200 rounded-xl px-3 py-2">
                        Noch keine Schularbeit, kein Test und keine Prüfung erfasst.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assessmentsFor(row.student_id).map((a) =>
                          a.editable ? (
                            <div
                              key={a.key}
                              className="grid grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.4fr_1.2fr_auto] gap-2 items-center bg-white border border-gray-200 rounded-xl p-2 shadow-sm"
                            >
                              <select
                                value={a.exam_type}
                                onChange={(e) =>
                                  updateAssessment(a.key, {
                                    exam_type: e.target.value as ExamType,
                                  })
                                }
                                className="px-2 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                {EXAM_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="date"
                                value={a.exam_date}
                                onChange={(e) =>
                                  updateAssessment(a.key, { exam_date: e.target.value })
                                }
                                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500"
                              />

                              <select
                                value={a.grade_number ?? ''}
                                onChange={(e) =>
                                  updateAssessment(a.key, {
                                    grade_number: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                <option value="">Keine Note</option>
                                {SCHOOL_GRADES.map((g) => (
                                  <option key={g.value} value={g.value}>
                                    {g.label}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={a.grade_symbol ?? ''}
                                onChange={(e) =>
                                  updateAssessment(a.key, {
                                    grade_symbol: e.target.value
                                      ? (e.target.value as GradeSymbol)
                                      : null,
                                  })
                                }
                                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                              >
                                <option value="">Kein Symbol</option>
                                {GRADE_SYMBOLS.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => removeAssessment(a.key)}
                                className="justify-self-end text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                title="Eintrag entfernen"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            // Eintrag eines Kollegen: nur lesen. Die
                            // Sicherheitsregeln lassen fremde Änderungen nicht zu.
                            <div
                              key={a.key}
                              className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                            >
                              <ExamTypeBadge type={a.exam_type} />
                              <span className="text-xs font-bold text-slate-600">
                                {formatDate(a.exam_date)}
                              </span>
                              <GradeBadge grade={a.grade_number} symbol={a.grade_symbol} />
                              {a.teacher_name && (
                                <span className="text-[10px] text-slate-400 ml-auto">
                                  von {a.teacher_name}
                                </span>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fach & Thema */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
                Fach
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm transition-shadow"
              >
                <option value="">Bitte wählen...</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
                Thema
              </label>
              <input
                required
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-shadow"
                placeholder="Was wurde gemacht?"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
              Verlauf &amp; Notizen (Gruppe)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none shadow-sm transition-shadow"
              placeholder="Details zur Einheit..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
              Hausaufgaben (Gruppe)
            </label>
            <textarea
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none resize-none shadow-sm transition-shadow"
              placeholder="Aufgaben bis zum nächsten Mal..."
            />
          </div>

          <div className="flex justify-between pt-6 border-t border-gray-100 items-center">
            {canDelete && protocolId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} /> Löschen
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-lg shadow-primary-500/30 disabled:opacity-50 transition-all hover:scale-[1.02] font-bold flex items-center gap-2"
              >
                <CircleCheckBig size={18} /> {saving ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <StudentHistoryModal
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
        student={historyStudent}
      />
    </>
  );
}
