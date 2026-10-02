import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/helpers';
import type { AttendanceStatus, StudentAssessment } from '../types';
import { Modal } from './Modal';
import { AttendanceBadge, ExamTypeBadge, GradeBadge, ProgressBadge } from './Badges';

interface HistoryEntry {
  id: number;
  attendance: AttendanceStatus;
  progress: number;
  notes: string;
  homework: string;
  protocols: {
    id: number;
    date: string;
    subject: string;
    topic: string;
    teacher_name: string;
  };
}

interface StudentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: { id: number; name: string } | null;
}

/** Zeigt den zeitlichen Verlauf aller Protokolleinträge eines Schülers. */
export function StudentHistoryModal({ isOpen, onClose, student }: StudentHistoryModalProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && student) {
      void loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, student]);

  async function loadHistory() {
    if (!student) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('protocol_attendance')
        .select(
          `
          id,
          attendance,
          progress,
          notes,
          homework,
          protocols (
            id,
            date,
            subject,
            topic,
            teacher_name
          )
        `,
        )
        .eq('student_id', student.id);

      if (error) throw error;

      const sorted = ((data as unknown as HistoryEntry[]) || []).sort(
        (a, b) => new Date(b.protocols.date).getTime() - new Date(a.protocols.date).getTime(),
      );
      setEntries(sorted);

      // Schularbeiten, Tests und Prüfungen separat — die hängen am Schüler,
      // nicht am Protokoll, und können auch in der Zukunft liegen.
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('student_assessments')
        .select('*')
        .eq('student_id', student.id)
        .order('exam_date', { ascending: false });

      if (assessmentError) throw assessmentError;
      setAssessments((assessmentData as StudentAssessment[]) || []);
    } catch (err) {
      console.error('Fehler beim Laden des Verlaufs:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!student) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Verlauf: ${student.name}`} maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Schularbeiten, Tests und Prüfungen — eigener Block, damit die
            Notenentwicklung auf einen Blick sichtbar ist. */}
        {!loading && assessments.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <GraduationCap size={16} className="text-slate-500" />
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                Schularbeiten, Tests &amp; Prüfungen
              </h4>
            </div>
            <div className="divide-y divide-slate-50">
              {assessments.map((a) => {
                const future = a.exam_date > new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={a.id}
                    className="px-5 py-3 flex flex-wrap items-center gap-2 hover:bg-slate-50/60 transition-colors"
                  >
                    <ExamTypeBadge type={a.exam_type} />
                    <span className="text-sm font-bold text-slate-800">
                      {formatDate(a.exam_date)}
                    </span>
                    {future && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary-600 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded">
                        angekündigt
                      </span>
                    )}
                    {a.subject && <span className="text-xs text-slate-500">{a.subject}</span>}
                    <div className="ml-auto flex items-center gap-2">
                      <GradeBadge grade={a.grade_number} symbol={a.grade_symbol} />
                      {a.teacher_name && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {a.teacher_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">Lade Daten...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Keine Protokolleinträge vorhanden.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pb-4">
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-6">
                <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-white border-2 border-primary-200 ring-4 ring-white" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {formatDate(entry.protocols.date)}
                      <span className="text-slate-400 font-normal">|</span>
                      <span className="text-primary-600">{entry.protocols.subject}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Lehrer: {entry.protocols.teacher_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <ProgressBadge progress={entry.progress} />
                    <AttendanceBadge status={entry.attendance} />
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="mb-3 text-sm text-slate-800 font-medium border-b border-slate-50 pb-2">
                    Thema: {entry.protocols.topic}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entry.homework && (
                      <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                          <BookOpen size={12} /> Hausübung
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">
                          {entry.homework}
                        </div>
                      </div>
                    )}
                    {entry.notes && (
                      <div className="bg-primary-50/50 p-3 rounded-lg border border-primary-100/50">
                        <div className="text-[10px] font-bold text-primary-600 uppercase tracking-wide flex items-center gap-1 mb-1">
                          <MessageSquare size={12} /> Kommentar / Notiz
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">
                          {entry.notes}
                        </div>
                      </div>
                    )}
                  </div>
                  {!entry.homework && !entry.notes && (
                    <div className="text-xs text-slate-400 italic">
                      Keine individuellen Notizen oder Hausaufgaben eingetragen.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
