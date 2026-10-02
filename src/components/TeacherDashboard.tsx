import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Clock,
  Download,
  FileText,
  Funnel,
  MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  exportToCsv,
  formatDayMonth,
  getMonday,
  progressLabel,
  shortTime,
  toLocalDateString,
} from '../lib/helpers';
import type {
  Profile,
  Protocol,
  Session,
  Student,
  SubstitutionRequest,
} from '../types';
import { ProtocolModal } from './ProtocolModal';

interface TeacherDashboardProps {
  profile: Profile;
}

type Tab = 'calendar' | 'substitutions';

/** Lehreransicht: eigener Stundenplan, Protokolle, Vertretungsbörse. */
export function TeacherDashboard({ profile }: TeacherDashboardProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [openSubs, setOpenSubs] = useState<SubstitutionRequest[]>([]);
  const [mySubs, setMySubs] = useState<SubstitutionRequest[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [studentFilter, setStudentFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, tab]);

  async function loadData() {
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*, session_students(student_id, student_name, subject)')
      .eq('teacher_id', profile.id)
      .order('date');

    const { data: protocolData } = await supabase
      .from('protocols')
      .select('*, protocol_attendance(*)')
      .eq('teacher_id', profile.id)
      .order('date', { ascending: false });

    // Schülerliste für die Schulstufen-Anzeige
    const { data: studentData } = await supabase.from('students').select('*').order('name');

    if (sessionData) setSessions(sessionData as Session[]);
    if (protocolData) setProtocols(protocolData as Protocol[]);
    if (studentData) setStudents(studentData as Student[]);

    if (tab === 'substitutions') {
      const { data: open } = await supabase
        .from('substitution_requests')
        .select('*, sessions(*, session_students(student_name))')
        .neq('original_teacher_id', profile.id);
      const { data: mine } = await supabase
        .from('substitution_requests')
        .select('*, sessions(*, session_students(student_name))')
        .eq('original_teacher_id', profile.id);
      if (open) setOpenSubs(open as SubstitutionRequest[]);
      if (mine) setMySubs(mine as SubstitutionRequest[]);
    }
  }

  // Schulstufe je Schüler-ID
  const gradeById = useMemo(() => {
    const map = new Map<number, string>();
    students.forEach((s) => {
      if (s.grade) map.set(s.id, s.grade);
    });
    return map;
  }, [students]);

  // Schülerliste für den Filter (aus eigenen Einheiten und Protokollen)
  const filterStudents = useMemo(() => {
    const map = new Map<number, string>();
    sessions.forEach((s) =>
      s.session_students?.forEach((ss) => map.set(ss.student_id, ss.student_name)),
    );
    protocols.forEach((p) =>
      p.protocol_attendance?.forEach((a) => map.set(a.student_id, a.student_name)),
    );
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, protocols]);

  const filteredSessions = useMemo(
    () =>
      studentFilter === 'all'
        ? sessions
        : sessions.filter((s) =>
            s.session_students?.some((ss) => ss.student_id === studentFilter),
          ),
    [sessions, studentFilter],
  );

  const filteredProtocols = useMemo(
    () =>
      studentFilter === 'all'
        ? protocols
        : protocols.filter((p) =>
            p.protocol_attendance?.some((a) => a.student_id === studentFilter),
          ),
    [protocols, studentFilter],
  );

  function exportProtocols() {
    const rows = filteredProtocols.map((p) => ({
      Datum: p.date,
      Fach: p.subject,
      Thema: p.topic,
      Dauer: p.duration,
      Notizen: p.notes,
      Hausaufgabe: p.homework,
      Schueler: p.protocol_attendance
        ?.map((a) => `${a.student_name} (${attendanceWord(a.attendance)}, ${progressLabel(a.progress)})`)
        .join('; '),
    }));
    exportToCsv(rows, `Protokolle_${profile.name}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function acceptSubstitution(req: SubstitutionRequest) {
    if (!req.sessions) return;
    if (
      !confirm(
        `Möchten Sie die Einheit am ${new Date(req.sessions.date).toLocaleDateString()} übernehmen? Sie wird in Ihren Kalender übertragen.`,
      )
    )
      return;
    try {
      const { error } = await supabase.rpc('accept_substitution', {
        request_id: req.id,
        new_teacher_id: profile.id,
        new_teacher_name: profile.name,
      });
      if (error) throw error;
      alert('Einheit erfolgreich übernommen! Sie finden diese nun in Ihrem Stundenplan.');
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(err);
      alert('Fehler bei Übernahme: ' + message);
    }
  }

  async function withdrawSubstitution(id: number) {
    if (!confirm('Vertretungsanfrage zurückziehen?')) return;
    try {
      const { error } = await supabase.from('substitution_requests').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Fehler: ' + message);
    }
  }

  // Wochentage der aktuellen Woche
  const monday = getMonday(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  function sessionsForDay(day: Date): Session[] {
    const dateStr = toLocalDateString(day);
    return filteredSessions
      .filter((s) => s.date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  function hasProtocol(sessionId: number): boolean {
    return protocols.some((p) => p.session_id === sessionId);
  }

  // "Offen" zählt nur vergangene/heutige Einheiten ohne Protokoll,
  // nicht zukünftige (die kann man ja noch nicht protokollieren).
  const todayStr = toLocalDateString(new Date());
  const openCount = useMemo(
    () =>
      filteredSessions.filter((s) => s.date <= todayStr && !hasProtocol(s.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredSessions, protocols, todayStr],
  );

  const StatCard = ({ label, value }: { label: string; value: number | string }) => (
    <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col justify-center gap-1 h-full">
      <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold text-slate-700">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Reiter */}
      <div className="bg-white p-1.5 rounded-xl border border-gray-200 inline-flex shadow-sm">
        <button
          onClick={() => setTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === 'calendar'
              ? 'bg-primary-50 text-primary-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Calendar size={16} /> Mein Stundenplan
        </button>
        <button
          onClick={() => setTab('substitutions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            tab === 'substitutions'
              ? 'bg-blue-50 text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <ArrowRightLeft size={16} /> Vertretungsbörse
        </button>
      </div>

      {tab === 'calendar' && (
        <>
          {/* Statistik + Filter */}
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
              <StatCard label="Geplant" value={filteredSessions.length} />
              <StatCard label="Protokolle" value={filteredProtocols.length} />
              <StatCard label="Offen" value={openCount} />
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-gray-100 flex items-center gap-3 xl:w-80">
              <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Funnel size={20} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Schüler Filter
                </label>
                <div className="flex items-center justify-between">
                  <select
                    value={studentFilter}
                    onChange={(e) =>
                      setStudentFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    className="bg-transparent outline-none font-medium text-slate-700 cursor-pointer w-full text-sm py-1"
                  >
                    <option value="all">Alle Schüler anzeigen</option>
                    {filterStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {studentFilter !== 'all' && (
                    <button
                      onClick={() => setStudentFilter('all')}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <CircleX size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stundenplan */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={20} className="text-primary-600" />
                Stundenplan
              </h2>
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                <button
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-semibold text-slate-600 text-sm px-2 min-w-[120px] text-center">
                  {formatDayMonth(weekDays[0])} - {formatDayMonth(weekDays[6])}
                </span>
                <button
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-slate-50/50">
              {weekDays.map((day, idx) => {
                const daySessions = sessionsForDay(day);
                const now = new Date();
                const isToday =
                  day.getDate() === now.getDate() &&
                  day.getMonth() === now.getMonth() &&
                  day.getFullYear() === now.getFullYear();

                return (
                  <div
                    key={idx}
                    className={`min-h-[180px] group transition-colors ${
                      isToday ? 'bg-blue-50/30' : 'bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`p-3 text-center border-b border-gray-100/50 ${
                        isToday ? 'text-primary-600' : 'text-slate-500'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide opacity-80">
                        {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                      </div>
                      <div className={`text-lg font-bold ${isToday ? 'scale-110 inline-block' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                    <div className="p-2 space-y-2">
                      {daySessions.map((s) => {
                        const done = hasProtocol(s.id);
                        const count = s.session_students?.length || 0;
                        const subjects = Array.from(
                          new Set(s.session_students?.map((ss) => ss.subject)),
                        ).filter((x): x is string => !!x);
                        const subject = subjects.length > 0 ? subjects[0] : '';

                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSession(s);
                              setModalOpen(true);
                            }}
                            className={`relative p-3 rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                              done
                                ? 'bg-white border-emerald-200 shadow-emerald-100'
                                : 'bg-white border-gray-200 border-l-4 border-l-amber-400'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                {shortTime(s.start_time)}
                              </span>
                              {done && <CircleCheckBig size={14} className="text-emerald-500" />}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 truncate">
                              <MapPin size={10} /> {s.location}
                            </div>
                            {/* Schülernamen mit Schulstufe */}
                            <div className="space-y-0.5 mb-2">
                              {(s.session_students || []).slice(0, 3).map((ss, i) => {
                                const grade = gradeById.get(ss.student_id);
                                return (
                                  <div
                                    key={i}
                                    className="text-[11px] text-slate-600 truncate flex items-center gap-1"
                                  >
                                    <span className="truncate">{ss.student_name}</span>
                                    {grade && (
                                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded shrink-0">
                                        {grade}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {count > 3 && (
                                <div className="text-[10px] text-slate-400">+{count - 3} weitere</div>
                              )}
                            </div>
                            <div className="pt-2 border-t border-gray-50 flex items-center justify-end">
                              {subject && (
                                <span className="text-[9px] font-bold text-primary-600 uppercase tracking-wide bg-primary-50 px-1.5 py-0.5 rounded-full">
                                  {subject.slice(0, 3)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Letzte Protokolle */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-primary-600" />
                Letzte Protokolle
              </h2>
              <button
                onClick={exportProtocols}
                className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-primary-600 border border-slate-200 hover:border-primary-600 px-3 py-1.5 rounded-lg transition-all uppercase tracking-wide"
              >
                <Download size={14} /> CSV Export
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {filteredProtocols.length === 0 && (
                <p className="text-gray-400 text-center py-12 italic">Keine Protokolle gefunden.</p>
              )}
              {filteredProtocols.map((p) => {
                const presentCount =
                  p.protocol_attendance?.filter(
                    (a) => a.attendance === 'present' || a.attendance === 'late',
                  ).length || 0;
                const session = sessions.find((s) => s.id === p.session_id);
                const total =
                  session?.session_students?.length || p.protocol_attendance?.length || 0;

                return (
                  <div key={p.id} className="p-5 hover:bg-slate-50/80 transition-colors group">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-slate-800 text-sm group-hover:text-primary-700 transition-colors">
                            {p.subject}
                          </h3>
                          <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-full">
                            {p.duration} Min
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{p.topic}</p>
                      </div>
                      <div className="flex items-center gap-3 self-start sm:self-center">
                        <div className="text-right mr-2 hidden sm:block">
                          <div className="text-xs font-bold text-slate-700">
                            {new Date(p.date).toLocaleDateString('de-DE')}
                          </div>
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wide ${
                              presentCount === total ? 'text-emerald-500' : 'text-amber-500'
                            }`}
                          >
                            {presentCount} / {total} Anwesend
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Anwesenheits-Punkte je Schüler — korrekt je Status eingefärbt */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.protocol_attendance?.map((a) => {
                        const present = a.attendance === 'present' || a.attendance === 'late';
                        return (
                          <div
                            key={a.student_id}
                            className={`pl-1 pr-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                              present
                                ? 'bg-white border-emerald-100 text-emerald-700 shadow-sm'
                                : 'bg-red-50 border-red-100 text-red-700'
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                present ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            {a.student_name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === 'substitutions' && (
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-blue-500" /> Verfügbare Vertretungen
            </h3>
            <div className="space-y-3">
              {openSubs.length === 0 && (
                <div className="p-8 bg-white border border-dashed border-gray-200 rounded-xl text-center text-gray-400 text-sm">
                  Keine offenen Vertretungsanfragen.
                </div>
              )}
              {openSubs.map((req) =>
                req.sessions ? (
                  <div
                    key={req.id}
                    className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          {new Date(req.sessions.date).toLocaleDateString()}
                          <span className="font-normal text-gray-400">|</span>
                          {shortTime(req.sessions.start_time)} - {shortTime(req.sessions.end_time)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {req.sessions.location} | {req.sessions.teacher_name}
                        </div>
                      </div>
                      <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                        Offen
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {req.sessions.session_students?.map((ss, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                        >
                          {ss.student_name}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => acceptSubstitution(req)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                      Übernehmen
                    </button>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock size={20} className="text-amber-500" /> Meine Anfragen
            </h3>
            <div className="space-y-3">
              {mySubs.length === 0 && (
                <div className="p-8 bg-gray-50 border border-transparent rounded-xl text-center text-gray-400 text-sm">
                  Sie haben keine offenen Anfragen.
                </div>
              )}
              {mySubs.map((req) =>
                req.sessions ? (
                  <div
                    key={req.id}
                    className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm opacity-90"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                          {new Date(req.sessions.date).toLocaleDateString()}
                          <span className="font-normal text-gray-400">|</span>
                          {shortTime(req.sessions.start_time)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">{req.sessions.location}</div>
                      </div>
                      <button
                        onClick={() => withdrawSubstitution(req.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Zurückziehen"
                      >
                        <CircleX size={18} />
                      </button>
                    </div>
                    <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg font-medium border border-amber-100 flex items-center gap-2">
                      <Clock size={12} /> Warten auf Übernahme...
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}

      <ProtocolModal
        session={selectedSession}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSession(null);
        }}
        onSave={() => void loadData()}
        currentProfileId={profile.id}
        currentProfileName={profile.name}
        isAdmin={profile.is_admin}
      />
    </div>
  );
}

/** Kurzwort für den CSV-Export (ersetzt die alte, fehlerhafte present/absent-Logik). */
function attendanceWord(status: string): string {
  switch (status) {
    case 'present':
      return 'Anwesend';
    case 'late':
      return 'Verspätet';
    case 'excused':
      return 'Entschuldigt';
    default:
      return 'Fehlt';
  }
}
