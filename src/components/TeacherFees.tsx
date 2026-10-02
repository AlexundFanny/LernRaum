import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, Euro, SquarePen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { exportToCsv, monthRange } from '../lib/helpers';
import { HOURLY_RATE } from '../constants';
import type { Profile, Protocol, Session } from '../types';
import { ProtocolModal } from './ProtocolModal';

interface TeacherFeesProps {
  profile: Profile;
}

/**
 * Jahre für die Auswahl: dynamisch um das aktuelle Jahr herum,
 * damit die Liste nicht wie früher (fest 2024-2026) veraltet.
 */
function selectableYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = 2024; y <= current + 1; y++) years.push(y);
  return years;
}

/** Lehrer-Honorarübersicht pro Monat mit CSV-Export. */
export function TeacherFees({ profile }: TeacherFeesProps) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  async function loadData() {
    // Monatsgrenzen als lokale Datums-Strings (kein UTC -> kein Tag-Versatz).
    const { first, last } = monthRange(year, month);
    const { data } = await supabase
      .from('protocols')
      .select('*, protocol_attendance(*)')
      .eq('teacher_id', profile.id)
      .gte('date', first)
      .lte('date', last)
      .order('date', { ascending: true });
    if (data) setProtocols(data as Protocol[]);
  }

  const feeForProtocol = (minutes: number) => (minutes / 60) * HOURLY_RATE;

  const totalFee = useMemo(
    () => protocols.reduce((sum, p) => sum + feeForProtocol(p.duration), 0),
    [protocols],
  );
  const totalMinutes = useMemo(
    () => protocols.reduce((sum, p) => sum + p.duration, 0),
    [protocols],
  );

  function exportFees() {
    const rows = protocols.map((p) => ({
      Datum: p.date,
      Thema: p.topic,
      Dauer_Minuten: p.duration,
      Honorar: feeForProtocol(p.duration).toFixed(2).replace('.', ','),
    }));
    exportToCsv(rows, `Honorar_${profile.name}_${month + 1}_${year}.csv`);
  }

  async function openProtocol(p: Protocol) {
    const { data } = await supabase
      .from('sessions')
      .select('*, session_students(student_id, student_name)')
      .eq('id', p.session_id)
      .single();
    if (data) {
      setSelectedSession(data as Session);
      setModalOpen(true);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-primary-600 shadow-inner">
            <Euro size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Honorarübersicht &amp; Abrechnung</h2>
            <p className="text-gray-500 font-medium">Satz: €{HOURLY_RATE.toFixed(2)} / Stunde</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
          <div className="px-3 flex items-center gap-2 text-gray-500 border-r border-gray-200">
            <Calendar size={18} />
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1"
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
            className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer py-1"
          >
            {selectableYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Einzelaufstellung (Protokolle)
          </div>
          <button
            onClick={exportFees}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title="CSV Download"
          >
            <Download size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="px-6 py-4 font-medium w-32">Datum</th>
                <th className="px-6 py-4 font-medium w-48">Lehrer</th>
                <th className="px-6 py-4 font-medium">Thema</th>
                <th className="px-6 py-4 font-medium text-right w-32">Dauer (Min)</th>
                <th className="px-6 py-4 font-medium text-right w-20">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {protocols.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Keine Daten für diesen Monat.
                  </td>
                </tr>
              ) : (
                protocols.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {new Date(p.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-medium">{p.teacher_name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="truncate max-w-xs" title={p.topic}>
                        <span className="font-semibold text-gray-800">{p.subject}</span>: {p.topic}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700 tabular-nums">
                      {p.duration} min
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openProtocol(p)}
                        className="text-primary-400 hover:text-primary-600 p-1 hover:bg-primary-50 rounded transition-colors"
                      >
                        <SquarePen size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Monatsabschluss
                </td>
                <td className="px-6 py-4 text-right text-gray-500 font-bold">Gesamt:</td>
                <td className="px-6 py-4 text-right font-bold text-gray-900 tabular-nums bg-gray-100/50">
                  {(totalMinutes / 60).toFixed(1)} Std
                </td>
                <td className="px-6 py-4 text-right font-normal text-primary-700 text-base tabular-nums bg-primary-50/50">
                  {totalFee.toFixed(2)} <span className="font-bold">€</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

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
