import { useEffect, useState } from 'react';
import { BookOpen, CircleCheckBig, Clock, Search, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SUBJECTS, LOCATIONS, TIME_BLOCKS } from '../../constants';
import { toLocalDateString } from '../../lib/helpers';
import type { Profile, Session, Student } from '../../types';
import { Modal } from '../Modal';

/** Ausgewählter Schüler mit Fach im Planer. */
interface PickedStudent {
  id: number;
  subject: string;
}

type Repeat = 'none' | 'daily' | 'weekly';

interface SessionPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  teachers: Profile[];
  students: Student[];
  editSession: Session | null; // null = neue Einheit
}

/** Anlegen und Bearbeiten einer Einheit, inkl. Serien und Schülerauswahl. */
export function SessionPlannerModal({
  isOpen,
  onClose,
  onSaved,
  teachers,
  students,
  editSession,
}: SessionPlannerModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    teacher_id: '',
    date: toLocalDateString(new Date()),
    start_time: '14:15',
    end_time: '15:55',
    location: 'Floridsdorf' as string,
  });
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [repeatCount, setRepeatCount] = useState(1);
  const [picked, setPicked] = useState<PickedStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Beim Öffnen initialisieren
  useEffect(() => {
    if (!isOpen) return;
    if (editSession) {
      setForm({
        teacher_id: editSession.teacher_id || '',
        date: editSession.date,
        start_time: editSession.start_time.slice(0, 5),
        end_time: editSession.end_time.slice(0, 5),
        location: editSession.location,
      });
      setPicked(
        (editSession.session_students || []).map((s) => ({
          id: s.student_id,
          subject: s.subject || 'Andere',
        })),
      );
    } else {
      setForm({
        teacher_id: '',
        date: toLocalDateString(new Date()),
        start_time: '14:15',
        end_time: '15:55',
        location: 'Floridsdorf',
      });
      setPicked([]);
    }
    setRepeat('none');
    setRepeatCount(1);
    setStudentSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editSession]);

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  function togglePicked(studentId: number) {
    setPicked((prev) =>
      prev.some((p) => p.id === studentId)
        ? prev.filter((p) => p.id !== studentId)
        : [...prev, { id: studentId, subject: 'Mathematik' }],
    );
  }

  function setPickedSubject(studentId: number, subject: string) {
    setPicked((prev) => prev.map((p) => (p.id === studentId ? { ...p, subject } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (!form.teacher_id) throw new Error('Bitte Lehrer wählen');
      const teacher = teachers.find((t) => t.id === form.teacher_id);

      if (editSession) {
        // Bearbeiten
        const { error } = await supabase
          .from('sessions')
          .update({
            teacher_id: form.teacher_id,
            teacher_name: teacher?.name,
            date: form.date,
            start_time: form.start_time,
            end_time: form.end_time,
            location: form.location,
          })
          .eq('id', editSession.id);
        if (error) throw error;

        await supabase.from('session_students').delete().eq('session_id', editSession.id);
        if (picked.length > 0) {
          const rows = picked.map((p) => ({
            session_id: editSession.id,
            student_id: p.id,
            student_name: students.find((s) => s.id === p.id)?.name,
            subject: p.subject,
          }));
          await supabase.from('session_students').insert(rows);
        }
      } else {
        // Neu anlegen (ggf. als Serie). series_id verknüpft die Einheiten einer Serie.
        const baseDate = new Date(form.date);
        const total = repeat === 'none' ? 1 : repeatCount + 1;
        const seriesId = repeat === 'none' ? null : `serie_${Date.now()}`;

        for (let i = 0; i < total; i++) {
          const d = new Date(baseDate);
          if (repeat === 'daily') d.setDate(baseDate.getDate() + i);
          if (repeat === 'weekly') d.setDate(baseDate.getDate() + i * 7);
          const dateStr = toLocalDateString(d);

          const { data: created, error } = await supabase
            .from('sessions')
            .insert({
              teacher_id: form.teacher_id,
              teacher_name: teacher?.name,
              date: dateStr,
              start_time: form.start_time,
              end_time: form.end_time,
              location: form.location,
              series_id: seriesId,
            })
            .select()
            .single();
          if (error) throw error;

          if (picked.length > 0 && created.id) {
            const rows = picked.map((p) => ({
              session_id: created.id,
              student_id: p.id,
              student_name: students.find((s) => s.id === p.id)?.name,
              subject: p.subject,
            }));
            await supabase.from('session_students').insert(rows);
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Fehler: ' + message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editSession ? 'Einheit Bearbeiten' : 'Einheit Planen'}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lehrer + Datum */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
              Lehrkraft
            </label>
            <select
              required
              value={form.teacher_id || ''}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer text-gray-700"
            >
              <option value="">Bitte auswählen...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
              Datum
            </label>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-gray-700"
            />
          </div>
        </div>

        {/* Standardzeit-Schnellwahl */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
            Standardzeiten (100 Min.)
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_BLOCKS.map((block) => {
              const active = form.start_time === block.start && form.end_time === block.end;
              return (
                <button
                  key={block.label}
                  type="button"
                  onClick={() => setForm({ ...form, start_time: block.start, end_time: block.end })}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    active
                      ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                  }`}
                >
                  {block.label}
                  <span className="block text-[10px] font-normal opacity-80">
                    {block.start}–{block.end}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zeiten + Standort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Von</label>
            <input
              required
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">Bis</label>
            <input
              required
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
              Standort
            </label>
            <select
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none cursor-pointer text-gray-700"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Wiederholung (nur bei neuer Einheit) */}
        {!editSession && (
          <div className="p-4 bg-primary-50/30 rounded-2xl border border-primary-100 flex flex-wrap md:flex-nowrap gap-5 items-end">
            <div className="w-full md:w-1/2">
              <label className="block text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-2 ml-1">
                Einheit Wiederholen
              </label>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {(
                  [
                    { id: 'none', label: 'Keine' },
                    { id: 'daily', label: 'Täglich' },
                    { id: 'weekly', label: 'Wöchentlich' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRepeat(opt.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      repeat === opt.id
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {repeat !== 'none' && (
              <div className="w-full md:w-auto flex-1 animate-fade-in">
                <label className="block text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-2 ml-1">
                  Anzahl
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-center font-bold text-slate-700"
                  />
                  <div className="text-[10px] text-slate-400 leading-tight uppercase font-bold min-w-[80px]">
                    Wiederholungen
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schülerauswahl + Zusammenfassung */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-2 px-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                Schüler auswählen
              </label>
              <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-primary-100">
                {picked.length} Gewählt
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[340px]">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 group">
                <Search
                  size={16}
                  className="text-slate-400 group-focus-within:text-primary-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Schüler nach Name suchen..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
                />
              </div>
              <div className="overflow-y-auto p-2 divide-y divide-slate-50 custom-scrollbar">
                {filteredStudents.map((student) => {
                  const isPicked = picked.some((p) => p.id === student.id);
                  const pickedEntry = picked.find((p) => p.id === student.id);
                  return (
                    <div
                      key={student.id}
                      onClick={() => togglePicked(student.id)}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-all ${
                        isPicked ? 'bg-primary-50/50 ring-1 ring-primary-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center mr-3 transition-all ${
                          isPicked ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-300'
                        }`}
                      >
                        {isPicked && <CircleCheckBig size={14} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div
                          className={`text-sm font-bold transition-colors ${
                            isPicked ? 'text-primary-900' : 'text-slate-700'
                          }`}
                        >
                          {student.name}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-tighter">
                          {student.grade || 'Keine Klasse'}
                        </div>
                      </div>
                      {isPicked && (
                        <div
                          className="flex items-center gap-1.5 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BookOpen size={12} className="text-primary-400" />
                          <select
                            value={pickedEntry?.subject}
                            onChange={(e) => setPickedSubject(student.id, e.target.value)}
                            className="text-[10px] font-bold border border-primary-100 rounded-lg px-2 py-1 bg-white text-primary-700 outline-none uppercase shadow-sm cursor-pointer hover:border-primary-300 transition-all"
                          >
                            {SUBJECTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col h-full">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
              Zusammenfassung
            </label>
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col shadow-inner">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-4">
                {picked.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4">
                    <Users size={32} className="opacity-20 mb-2" />
                    <p className="text-xs italic">
                      Wählen Sie links Schüler aus, um sie dieser Einheit hinzuzufügen.
                    </p>
                  </div>
                ) : (
                  picked.map((p) => {
                    const student = students.find((s) => s.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group animate-fade-in"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800">{student?.name}</div>
                          <div className="text-[10px] text-primary-500 font-bold uppercase">
                            {p.subject}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Anzahl Schüler:</span>
                  <span className="text-slate-900 font-bold">{picked.length}</span>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? (
                    <Clock size={18} className="animate-spin" />
                  ) : (
                    <>
                      <CircleCheckBig size={18} />{' '}
                      {editSession
                        ? 'Änderungen Speichern'
                        : repeat !== 'none'
                          ? 'Serie erstellen'
                          : 'Einheit erstellen'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
