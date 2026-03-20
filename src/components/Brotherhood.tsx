'use client';

import { useState, useEffect } from 'react';
import { Handshake, Trash2, Plus, Shield } from 'lucide-react';
import { createClient } from '../utils/supabase/client';

interface Brother {
  id: string;
  name: string;
  last_contacted_at: string | null;
  created_at: string;
}

function isOverdue(lastContacted: string | null): boolean {
  if (!lastContacted) return true;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(lastContacted) < sevenDaysAgo;
}

function formatLastContact(lastContacted: string | null): string {
  if (!lastContacted) return 'Never';
  const date = new Date(lastContacted);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export default function Brotherhood() {
  const [supabase] = useState(() => createClient());
  const [brothers, setBrothers] = useState<Brother[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      await loadBrothers(user?.id ?? null);
    };
    init();
  }, []);

  const loadBrothers = async (uid: string | null) => {
    setLoading(true);
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('brotherhood_contacts')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true });
    if (data) setBrothers(data);
    setLoading(false);
  };

  const addBrother = async () => {
    const name = newName.trim();
    if (!name || !userId) return;
    setAdding(true);
    const { data, error } = await supabase
      .from('brotherhood_contacts')
      .insert({ user_id: userId, name, last_contacted_at: null })
      .select()
      .single();
    if (!error && data) {
      setBrothers(prev => [...prev, data]);
      setNewName('');
    }
    setAdding(false);
  };

  const markContacted = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('brotherhood_contacts')
      .update({ last_contacted_at: now })
      .eq('id', id);
    if (!error) {
      setBrothers(prev =>
        prev.map(b => b.id === id ? { ...b, last_contacted_at: now } : b)
      );
    }
  };

  const removeBrother = async (id: string) => {
    const { error } = await supabase
      .from('brotherhood_contacts')
      .delete()
      .eq('id', id);
    if (!error) {
      setBrothers(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addBrother();
  };

  const overdueCount = brothers.filter(b => isOverdue(b.last_contacted_at)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Shield size={18} className="text-indigo-500" />
        <h3 className="font-black text-lg uppercase tracking-tighter italic">The Brotherhood</h3>
        {overdueCount > 0 && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* Brothers List */}
      {loading ? (
        <div className="text-center py-6 text-gray-600 text-xs font-bold uppercase tracking-widest">Loading...</div>
      ) : brothers.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <Shield size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-[10px] font-black uppercase tracking-widest">No brothers added yet.</p>
          <p className="text-[10px] font-bold text-gray-700 mt-1">Dads don't do this alone.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          {brothers.map(brother => {
            const overdue = isOverdue(brother.last_contacted_at);
            return (
              <div
                key={brother.id}
                className="flex items-center gap-3 bg-background/60 border border-border rounded-2xl px-4 py-3"
              >
                {/* Status Dot */}
                <div
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    overdue ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]' : 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                  }`}
                />

                {/* Name + Status */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-tight truncate">{brother.name}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${overdue ? 'text-rose-400' : 'text-indigo-400'}`}>
                    {overdue ? 'Overdue · ' : 'Solid · '}
                    <span className="text-muted-foreground">{formatLastContact(brother.last_contacted_at)}</span>
                  </p>
                </div>

                {/* Contacted Button */}
                <button
                  onClick={() => markContacted(brother.id)}
                  title="Mark Contacted Today"
                  className="p-2 bg-card hover:bg-indigo-500/20 border border-border hover:border-indigo-500/40 rounded-xl transition-all text-muted-foreground hover:text-indigo-400"
                >
                  <Handshake size={15} />
                </button>

                {/* Remove Button */}
                <button
                  onClick={() => removeBrother(brother.id)}
                  title="Remove Brother"
                  className="p-2 bg-card hover:bg-rose-500/10 border border-border hover:border-rose-500/30 rounded-xl transition-all text-gray-600 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Brother Input */}
      {!userId ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600 mt-4">
          Sign in to track your brotherhood.
        </p>
      ) : (
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a brother..."
            maxLength={40}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            onClick={addBrother}
            disabled={!newName.trim() || adding}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      )}

      <p className="mt-5 text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center italic">
        "Iron sharpens iron. You need your brothers."
      </p>
    </div>
  );
}

