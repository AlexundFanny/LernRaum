import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Euro,
  FileText,
  Mail,
  Plus,
  Search,
  Settings,
  SquarePen,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToCsv, monthRange, shortTime, ageFromBirthDate } from '../../lib/helpers';
import { HOURLY_RATE } from '../../constants';
import type { Profile, Protocol, Session, Student, TeacherInvite } from '../../types';
import { ProtocolModal } from '../ProtocolModal';
import { StudentHistoryModal } from '../StudentHistoryModal';
import { StudentFormModal } from './StudentFormModal';
import { SessionPlannerModal } from './SessionPlannerModal';

type AdminTab = 'sessions' | 'students' | 'teachers' | 'protocols' | 'finance';

interface AdminPanelProps {
  profile: Profile;
}

/** Zusammengefasste Honorardaten pro Lehrer (Finanz-Übersicht). */
interface TeacherFeeSummary {
  id: string;
  name: string;
  minutes: number;
  count: number;
  hours: string;
  fee: string;
}

/** Jahre dynamisch (nicht fest 2024-2026 wie früher). */
function selectableYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = 2024; y <= current + 1; y++) years.push(y);
  return years;
}

export function AdminPanel({ profile }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('sessions');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [financeTeacher, setFinanceTeacher] = useState<string | 'all'>('all');

  // Modals
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Partial<Student>>({});
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editTeacher, setEditTeacher] = useState<Partial<Profile>>({});
  const [historyStudent, setHistoryStudent] = useState<{ id: number; name: string } | null>(null);
  const [protocolSession, setProtocolSession] = useState<Session | null>(null);
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [protocolTeacherId, setProtocolTeacherId] = useState('');
  const [protocolTeacherName, setProtocolTeacherName] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');

  useEffect(() => {
    void loadData();
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, month, year]);

  async function loadData() {
    if (tab === 'students' || tab === 'sessions' || tab === 'protocols' || tab === 'finance') {
      const { data } = await supabase.from('students').select('*').order('name');
      if (data) setStudents(data as Student[]);
    }
    if (tab === 'teachers' || tab === 'sessions' || tab === 'finance') {
      const { data } = await supabase.from('profiles').select('*').order('name');
      if (data) setTeachers(data as Profile[]);
    }
    if (tab === 'teachers') {
      const { data } = await supabase
        .from('teacher_invites')
        .select('*')
        .eq('used', false)
        .order('invited_at', { ascending: false });
      if (data) setInvites(data as TeacherInvite[]);
    }
    if (tab === 'sessions') {
      const { data } = await supabase
        .from('sessions')
        .select('*, session_students(student_id, student_name, subject)')
        .order('date', { ascending: false });
      if (data) setSessions(data as Session[]);
    }
    if (tab === 'protocols' || tab === 'finance') {
      // Monatsgrenzen als lokale Strings (Zeitzonen-Fix)
      const { first, last } = monthRange(year, month);
      const { data } = await supabase
        .from('protocols')
        .select('*, protocol_attendance(*), sessions(*)')
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false });
      if (data) setProtocols(data as Protocol[]);
    }
  }

  // --- Gefilterte Ansichten ---

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (dateFrom) list = list.filter((s) => s.date >= dateFrom);
    if (dateTo) list = list.filter((s) => s.date <= dateTo);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s) =>
        s.teacher_name?.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.session_students?.some((ss) => ss.student_name.toLowerCase().includes(q)),
    );
  }, [sessions, search, dateFrom, dateTo]);

  const feeSummary = useMemo<TeacherFeeSummary[]>(() => {
    const map: Record<string, { name: string; minutes: number; count: number }> = {};
    protocols.forEach((p) => {
      if (!p.teacher_id) return;
      if (!map[p.teacher_id]) map[p.teacher_id] = { name: p.teacher_name, minutes: 0, count: 0 };
      map[p.teacher_id].minutes += p.duration || 0;
      map[p.teacher_id].count += 1;
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        id,
        name: v.name,
        minutes: v.minutes,
        count: v.count,
        hours: (v.minutes / 60).toFixed(1),
        fee: ((v.minutes / 60) * HOURLY_RATE).toFixed(2),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [protocols]);

  const financeProtocols = useMemo(() => {
    let list = protocols;
    if (financeTeacher !== 'all') list = list.filter((p) => p.teacher_id === financeTeacher);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.subject.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q) ||
          p.teacher_name.toLowerCase().includes(q) ||
          p.protocol_attendance?.some((a) => a.student_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [protocols, search, financeTeacher]);

  const financeTotalFee = useMemo(
    () => financeProtocols.reduce((sum, p) => sum + (p.duration / 60) * HOURLY_RATE, 0).toFixed(2),
    [financeProtocols],
  );

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.grade?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    );
  }, [students, search]);

  const filteredTeachers = useMemo(() => {
    if (!search) return teachers;
    const q = search.toLowerCase();
    return teachers.filter(
      (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q),
    );
  }, [teachers, search]);

  const filteredProtocols = useMemo(() => {
    if (!search) return protocols;
    const q = search.toLowerCase();
    return protocols.filter(
      (p) =>
        p.subject.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.teacher_name.toLowerCase().includes(q) ||
        p.protocol_attendance?.some((a) => a.student_name.toLowerCase().includes(q)),
    );
  }, [protocols, search]);

  // --- Aktionen ---

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('teacher_invites')
        .insert({ email: inviteEmail.trim().toLowerCase(), name: inviteName, used: false, invited_by: profile.id });
      if (error) throw error;
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function withdrawInvite(id: number) {
    if (!confirm('Einladung wirklich zurückziehen?')) return;
    try {
      const { error } = await supabase.from('teacher_invites').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function openEditSession(s: Session) {
    setEditSession(s);
    setSessionModalOpen(true);
  }

  async function openProtocolForProtocol(p: Protocol) {
    const { data } = await supabase
      .from('sessions')
      .select('*, session_students(student_id, student_name, subject)')
      .eq('id', p.session_id)
      .single();
    if (data) {
      setProtocolSession(data as Session);
      setProtocolTeacherId(p.teacher_id || '');
      setProtocolTeacherName(p.teacher_name);
      setProtocolModalOpen(true);
    } else {
      alert('Zugehörige Einheit nicht gefunden.');
    }
  }

  async function saveTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!editTeacher.id || !editTeacher.name) return;
    await supabase
      .from('profiles')
      .update({ name: editTeacher.name, is_admin: editTeacher.is_admin })
      .eq('id', editTeacher.id);
    setTeacherModalOpen(false);
    setEditTeacher({});
    void loadData();
  }

  async function deleteTeacher(id: string) {
    if (
      !confirm('WARNUNG: Lehrer wirklich löschen? Dies löscht ALLE zugehörigen Daten!')
    )
      return;
    try {
      await supabase.from('messages').delete().eq('created_by', id);
      const { data: protos } = await supabase.from('protocols').select('id').eq('teacher_id', id);
      if (protos && protos.length > 0) {
        const ids = protos.map((p: { id: number }) => p.id);
        await supabase.from('protocol_attendance').delete().in('protocol_id', ids);
        await supabase.from('protocols').delete().in('id', ids);
      }
      const { data: sess } = await supabase.from('sessions').select('id').eq('teacher_id', id);
      if (sess && sess.length > 0) {
        const ids = sess.map((s: { id: number }) => s.id);
        await supabase.from('session_students').delete().in('session_id', ids);
        await supabase.from('sessions').delete().in('id', ids);
      }
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function deleteStudent(id: number) {
    if (!confirm('Wirklich löschen?')) return;
    try {
      await supabase.from('session_students').delete().eq('student_id', id);
      await supabase.from('protocol_attendance').delete().eq('student_id', id);
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function deleteSession(id: number) {
    if (!confirm('Einheit löschen?')) return;
    try {
      await supabase.from('session_students').delete().eq('session_id', id);
      const { data: protos } = await supabase.from('protocols').select('id').eq('session_id', id);
      if (protos && protos.length > 0) {
        const ids = protos.map((p: { id: number }) => p.id);
        await supabase.from('protocol_attendance').delete().in('protocol_id', ids);
        await supabase.from('protocols').delete().in('id', ids);
      }
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function deleteProtocol(id: number) {
    if (!confirm('Protokoll löschen?')) return;
    try {
      await supabase.from('protocol_attendance').delete().eq('protocol_id', id);
      const { error } = await supabase.from('protocols').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function exportAllProtocols() {
    exportToCsv(protocols as unknown as Record<string, unknown>[], 'alle_protokolle.csv');
  }

  function exportFinance() {
    const rows = financeProtocols.map((p) => ({
      Lehrer: p.teacher_name,
      Datum: p.date,
      Fach: p.subject,
      Thema: p.topic,
      Dauer_Min: p.duration,
      Honorar_Euro: ((p.duration / 60) * HOURLY_RATE).toFixed(2).replace('.', ','),
    }));
    exportToCsv(rows, `Finanzen_${month + 1}_${year}.csv`);
  }

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: AdminTab;
    label: string;
    icon: typeof Calendar;
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all rounded-lg mb-1 mx-1 ${
        tab === id
          ? 'bg-white text-primary-700 shadow-sm ring-1 ring-gray-200'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={18} className={tab === id ? 'text-primary-600' : 'text-gray-400'} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="bg-gray-50/50 p-1.5 rounded-xl border border-gray-200 flex flex-wrap gap-1">
        <TabButton id="sessions" label="Einheiten" icon={Calendar} />
        <TabButton id="students" label="Schüler" icon={Users} />
        <TabButton id="teachers" label="Team" icon={Settings} />
        <TabButton id="protocols" label="Protokolle" icon={FileText} />
        <TabButton id="finance" label="Finanzen" icon={Euro} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px] flex flex-col overflow-hidden">
        {/* ---------- FINANZEN ---------- */}
        {tab === 'finance' && (
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                {financeTeacher !== 'all' && (
                  <button
                    onClick={() => setFinanceTeacher('all')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {financeTeacher === 'all'
                      ? 'Honorarübersicht Monat'
                      : `Abrechnung: ${teachers.find((t) => t.id === financeTeacher)?.name}`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {financeTeacher === 'all'
                      ? 'Gesamthonorare aller Lehrkräfte'
                      : 'Einzelaufstellung der Protokolle'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1 px-2"
                  >
                    {Array.from({ length: 12 }, (_, m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m, 1).toLocaleString('de-DE', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1 px-2"
                  >
                    {selectableYears().map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={exportFinance}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <Download size={16} /> Export
                </button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {financeTeacher === 'all' ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="px-8 py-4">Lehrkraft</th>
                      <th className="px-6 py-4 text-center">Einheiten</th>
                      <th className="px-6 py-4 text-right">Gesamtstunden</th>
                      <th className="px-8 py-4 text-right">Monatshonorar</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {feeSummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-gray-400 italic">
                          Keine Abrechnungsdaten für diesen Monat gefunden.
                        </td>
                      </tr>
                    ) : (
                      feeSummary.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setFinanceTeacher(row.id)}
                          className="hover:bg-primary-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-8 py-5">
                            <div className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                {row.name.charAt(0)}
                              </div>
                              {row.name}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center font-medium text-gray-600">
                            {row.count} EH
                          </td>
                          <td className="px-6 py-5 text-right font-medium text-gray-600">
                            {row.hours} Std
                          </td>
                          <td className="px-8 py-5 text-right font-medium text-slate-900 text-base">
                            € {row.fee}
                          </td>
                          <td className="px-6 py-5 text-gray-300 group-hover:text-primary-400 transition-colors">
                            <ChevronRight size={20} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {feeSummary.length > 0 && (
                    <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                      <tr className="text-base font-normal">
                        <td className="px-8 py-6 text-slate-500 font-bold uppercase text-xs">
                          Gesamtsumme Alle
                        </td>
                        <td className="px-6 py-6 text-center text-slate-900">
                          {feeSummary.reduce((s, r) => s + r.count, 0)} EH
                        </td>
                        <td className="px-6 py-6 text-right text-slate-900">
                          {feeSummary.reduce((s, r) => s + parseFloat(r.hours), 0).toFixed(1)} Std
                        </td>
                        <td className="px-8 py-6 text-right text-primary-700">
                          €{' '}
                          <span className="font-bold">
                            {feeSummary.reduce((s, r) => s + parseFloat(r.fee), 0).toFixed(2)}
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                <table className="w-full text-left text-sm animate-fade-in">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="px-8 py-4 w-32">Datum</th>
                      <th className="px-6 py-4">Einheit / Thema</th>
                      <th className="px-6 py-4 text-right w-32">Dauer</th>
                      <th className="px-8 py-4 text-right w-32">Honorar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {financeProtocols.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-20 text-center text-gray-400 italic">
                          Keine Protokolle für diese Lehrkraft in diesem Monat.
                        </td>
                      </tr>
                    ) : (
                      financeProtocols.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-8 py-5 text-gray-600 font-medium">
                            {new Date(p.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-5">
                            <div className="font-bold text-primary-700">{p.subject}</div>
                            <div className="text-xs text-gray-500 mt-0.5 italic">{p.topic}</div>
                          </td>
                          <td className="px-6 py-5 text-right font-medium text-gray-600">
                            {p.duration} Min
                          </td>
                          <td className="px-8 py-5 text-right font-medium text-slate-900">
                            € {((p.duration / 60) * HOURLY_RATE).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-100">
                    <tr className="text-base font-normal">
                      <td colSpan={2} className="px-8 py-6 text-slate-500 font-bold uppercase text-xs">
                        Monatsabschluss
                      </td>
                      <td className="px-6 py-6 text-right text-slate-900">
                        {financeProtocols.reduce((s, p) => s + p.duration, 0)} Min
                      </td>
                      <td className="px-8 py-6 text-right text-primary-700">
                        € <span className="font-bold">{financeTotalFee}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ---------- EINHEITEN ---------- */}
        {tab === 'sessions' && (
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stundenplan Verwaltung</h2>
                <p className="text-sm text-gray-500">Alle geplanten Einheiten</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg p-2 outline-none"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg p-2 outline-none"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-48 transition-all">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-700 w-full"
                  />
                </div>
                <button
                  onClick={() => {
                    setEditSession(null);
                    setSessionModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm font-medium"
                >
                  <Plus size={16} /> Neue Einheit
                </button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 w-48">Zeitpunkt</th>
                    <th className="px-6 py-4 w-48">Lehrer</th>
                    <th className="px-6 py-4">Schüler &amp; Fach</th>
                    <th className="px-6 py-4 text-right w-32">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">
                          {new Date(s.date).toLocaleDateString('de-DE')}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Calendar size={12} /> {shortTime(s.start_time)} - {shortTime(s.end_time)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-700">{s.teacher_name || '-'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{s.location}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {s.session_students?.map((ss) => (
                            <span
                              key={ss.student_name}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100"
                            >
                              {ss.student_name}
                              {ss.subject && (
                                <span className="ml-1.5 opacity-60 border-l border-primary-200 pl-1.5">
                                  {ss.subject.slice(0, 3)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditSession(s)}
                            className="p-2 text-gray-400 hover:text-primary-600 rounded hover:bg-white"
                          >
                            <SquarePen size={16} />
                          </button>
                          <button
                            onClick={() => deleteSession(s.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-white"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------- SCHÜLER ---------- */}
        {tab === 'students' && (
          <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Schülerverzeichnis</h2>
                <p className="text-sm text-gray-500">{filteredStudents.length} Schüler</p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 md:w-64 transition-all">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, Klasse, Adresse..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-700 w-full"
                  />
                </div>
                <button
                  onClick={() => {
                    setEditStudent({});
                    setStudentModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium whitespace-nowrap"
                >
                  <UserPlus size={16} /> Schüler anlegen
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-primary-100 transition-all duration-200 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                      onClick={() => setHistoryStudent({ id: s.id, name: s.name })}
                      className="p-1.5 bg-white shadow-sm border rounded text-gray-500 hover:text-primary-600"
                      title="Verlauf"
                    >
                      <Clock size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setEditStudent(s);
                        setStudentModalOpen(true);
                      }}
                      className="p-1.5 bg-white shadow-sm border rounded text-gray-500 hover:text-primary-600"
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      onClick={() => deleteStudent(s.id)}
                      className="p-1.5 bg-white shadow-sm border rounded text-gray-500 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{s.name}</h3>
                      <p className="text-xs text-gray-500">
                        {s.grade ? `Klasse ${s.grade}` : 'Keine Klasse'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Alter</span>
                      <span>{ageFromBirthDate(s.birth_date)} Jahre</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">Kontakt</span>
                      <span className="truncate max-w-[150px]">{s.parents || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- TEAM ---------- */}
        {tab === 'teachers' && (
          <div className="p-6 overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Team-Verwaltung</h2>
                <p className="text-sm text-gray-500">Lehrer und Profile</p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 md:w-64 transition-all">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name oder Email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-700 w-full"
                  />
                </div>
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-sm text-sm font-medium whitespace-nowrap"
                >
                  <Mail size={16} /> Einladen
                </button>
              </div>
            </div>

            {invites.length > 0 && (
              <div className="mb-8 animate-fade-in">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Ausstehende Einladungen
                </h3>
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Mail size={18} className="text-primary-400" />
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                          <span className="text-sm font-medium text-gray-900">{inv.name}</span>
                          <span className="text-xs text-gray-400">{inv.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <Clock size={12} /> {new Date(inv.invited_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => withdrawInvite(inv.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle size={14} /> Aktive Nutzer
            </h3>
            <div className="grid gap-4">
              {filteredTeachers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors bg-white shadow-sm group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                        t.is_admin ? 'bg-primary-600' : 'bg-slate-400'
                      }`}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div className="cursor-pointer" onClick={() => setFinanceTeacher(t.id)}>
                      <div className="font-bold text-gray-800 group-hover:text-primary-600 transition-colors">
                        {t.name}
                      </div>
                      <div className="text-xs text-gray-500">{t.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {t.is_admin ? (
                      <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-semibold border border-primary-100">
                        {t.is_super_admin ? 'Super-Admin' : 'Admin'}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-semibold">
                        Lehrer
                      </span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setTab('finance');
                          setFinanceTeacher(t.id);
                        }}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-white rounded transition-colors"
                        title="Honorar ansehen"
                      >
                        <Euro size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditTeacher(t);
                          setTeacherModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-white rounded transition-colors"
                      >
                        <SquarePen size={16} />
                      </button>
                      {/* Super-Admins kann man nicht aus Versehen löschen */}
                      {!t.is_super_admin && (
                        <button
                          onClick={() => deleteTeacher(t.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- PROTOKOLLE ---------- */}
        {tab === 'protocols' && (
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Protokoll Archiv</h2>
                <p className="text-sm text-gray-500">{filteredProtocols.length} Einträge</p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1 px-2"
                  >
                    {Array.from({ length: 12 }, (_, m) => (
                      <option key={m} value={m}>
                        {new Date(2000, m, 1).toLocaleString('de-DE', { month: 'short' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1 px-2"
                  >
                    {selectableYears().map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 md:w-64 transition-all">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Fach, Thema, Lehrer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent outline-none text-sm text-gray-700 w-full"
                  />
                </div>
                <button
                  onClick={exportAllProtocols}
                  className="flex items-center gap-2 text-gray-600 hover:text-primary-600 hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 transition-all text-sm font-medium whitespace-nowrap"
                >
                  <FileText size={16} /> Export
                </button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 w-32">Datum</th>
                    <th className="px-6 py-4 w-48">Lehrer</th>
                    <th className="px-6 py-4">Inhalt</th>
                    <th className="px-6 py-4 w-24 text-center">Anwesend</th>
                    <th className="px-6 py-4 text-right w-32">Optionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredProtocols.map((p) => {
                    const present =
                      p.protocol_attendance?.filter(
                        (a) => a.attendance === 'present' || a.attendance === 'late',
                      ).length || 0;
                    const total = p.protocol_attendance?.length || 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {new Date(p.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{p.teacher_name}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-primary-700">{p.subject}</div>
                          <div className="text-gray-500 text-xs">{p.topic}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                              present === total
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {present} / {total}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openProtocolForProtocol(p)}
                              className="p-2 text-gray-400 hover:text-primary-600 rounded hover:bg-white"
                            >
                              <SquarePen size={16} />
                            </button>
                            <button
                              onClick={() => deleteProtocol(p.id)}
                              className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-white"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <StudentFormModal
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        onSaved={() => void loadData()}
        student={editStudent}
      />

      <SessionPlannerModal
        isOpen={sessionModalOpen}
        onClose={() => {
          setSessionModalOpen(false);
          setEditSession(null);
        }}
        onSaved={() => void loadData()}
        teachers={teachers}
        students={students}
        editSession={editSession}
      />

      {/* Einladen */}
      {inviteModalOpen && (
        <ModalWrapper title="Lehrer Einladen" onClose={() => setInviteModalOpen(false)}>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500"
                placeholder="max@schule.at"
              />
            </div>
            <button className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors">
              Einladung Senden
            </button>
          </form>
        </ModalWrapper>
      )}

      {/* Lehrer bearbeiten */}
      {teacherModalOpen && (
        <ModalWrapper title="Benutzer Bearbeiten" onClose={() => setTeacherModalOpen(false)}>
          <form onSubmit={saveTeacher} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                type="text"
                value={editTeacher.name || ''}
                onChange={(e) => setEditTeacher({ ...editTeacher, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg outline-none transition-all focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {/* Admin-Rechte vergibt laut DB-Regel nur ein Super-Admin.
                Der Schalter erscheint daher nur für Super-Admins. */}
            {profile.is_super_admin ? (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <input
                  type="checkbox"
                  checked={editTeacher.is_admin || false}
                  onChange={(e) => setEditTeacher({ ...editTeacher, is_admin: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label className="text-sm text-gray-700">Administrator-Rechte</label>
              </div>
            ) : (
              <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded border border-gray-200">
                Admin-Rechte können nur von einem Super-Admin geändert werden.
              </div>
            )}
            <button className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors">
              Speichern
            </button>
          </form>
        </ModalWrapper>
      )}

      <ProtocolModal
        session={protocolSession}
        isOpen={protocolModalOpen}
        onClose={() => {
          setProtocolModalOpen(false);
          setProtocolSession(null);
        }}
        onSave={() => void loadData()}
        currentProfileId={protocolTeacherId || profile.id}
        currentProfileName={protocolTeacherName || profile.name}
        isAdmin={true}
      />

      <StudentHistoryModal
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
        student={historyStudent}
      />
    </div>
  );
}

/** Kleines Inline-Modal für die zwei einfachen Formulare (Einladen, Lehrer bearbeiten). */
function ModalWrapper({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}
