import { useEffect, useState } from 'react';
import { Clock, Mail, Plus, Trash2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/helpers';
import type { Message, Profile } from '../types';
import { Modal } from './Modal';

interface MessagesProps {
  profile: Profile;
}

/** Mitteilungen ans Team: lesen für alle, schreiben/löschen für Admins. */
export function Messages({ profile }: MessagesProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: profiles } = await supabase.from('profiles').select('id, name');

    if (profiles) {
      const map: Record<string, string> = {};
      profiles.forEach((p: { id: string; name: string }) => {
        map[p.id] = p.name;
      });
      setAuthors(map);
    }
    if (msgs) setMessages(msgs as Message[]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.is_admin) return;
    try {
      const { error } = await supabase
        .from('messages')
        .insert({ title, content, created_by: profile.id });
      if (error) throw error;
      setTitle('');
      setContent('');
      setModalOpen(false);
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Fehler: ' + message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Nachricht wirklich löschen?')) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Fehler beim Löschen der Nachricht: ' + message);
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mail size={24} className="text-primary-600" /> Mitteilungen
          </h2>
          <p className="text-slate-500">Neuigkeiten und Informationen für das Team</p>
        </div>
        {profile.is_admin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus size={18} /> Nachricht verfassen
          </button>
        )}
      </div>

      <div className="space-y-6">
        {messages.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="text-slate-400 mb-2">Keine Mitteilungen vorhanden.</div>
            {profile.is_admin && (
              <div className="text-sm text-primary-600">
                Erstellen Sie die erste Nachricht für Ihr Team.
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-900">{m.title}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <Users size={12} /> {m.created_by ? authors[m.created_by] || 'Unbekannt' : 'Unbekannt'}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                    <Clock size={12} /> {formatDate(m.created_at)}
                  </span>
                  {profile.is_admin && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors ml-1"
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Neue Mitteilung">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Betreff</label>
            <input
              required
              className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wichtige Info..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Nachricht</label>
            <textarea
              required
              rows={6}
              className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Text hier eingeben..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Abbrechen
            </button>
            <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
              Veröffentlichen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
