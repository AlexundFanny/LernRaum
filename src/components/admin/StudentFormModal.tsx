import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Student } from '../../types';
import { Modal } from '../Modal';

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  student: Partial<Student>;
}

/** Anlegen und Bearbeiten eines Schülers. */
export function StudentFormModal({ isOpen, onClose, onSaved, student }: StudentFormModalProps) {
  const [form, setForm] = useState<Partial<Student>>(student);
  const [saving, setSaving] = useState(false);

  // Formular bei jedem Öffnen mit dem übergebenen Schüler füllen
  const [lastStudent, setLastStudent] = useState(student);
  if (student !== lastStudent) {
    setLastStudent(student);
    setForm(student);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);

    // Nicht genutzte Spalte "age" nicht mitschicken
    const payload = { ...form };
    delete (payload as Record<string, unknown>).age;

    try {
      if (form.id) {
        await supabase.from('students').update(payload).eq('id', form.id);
      } else {
        await supabase.from('students').insert(payload);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Schüler Verwalten">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              required
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Klasse / Schulstufe</label>
            <input
              type="text"
              value={form.grade || ''}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Geburtsdatum</label>
            <input
              type="date"
              value={form.birth_date || ''}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Eltern / Kontakt</label>
            <input
              type="text"
              value={form.parents || ''}
              onChange={(e) => setForm({ ...form, parents: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          disabled={saving}
          className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Speichere...' : 'Speichern'}
        </button>
      </form>
    </Modal>
  );
}
