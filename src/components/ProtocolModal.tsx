import { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  BookOpen,
  CircleCheckBig,
  Clock,
  Trash2,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, durationMinutes, shortTime } from '../lib/helpers';
import { SUBJECTS, ATTENDANCE_OPTIONS } from '../constants';
import type { AttendanceStatus, Session } from '../types';
import { Modal } from './Modal';
import { StudentHistoryModal } from './StudentHistoryModal';

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
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setSaving(false);
    }
  }

  function updateRow(studentId: number, field: keyof AttendanceRow, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || saving) return;
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
