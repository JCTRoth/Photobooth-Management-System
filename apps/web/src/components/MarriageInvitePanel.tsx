import { useState, useEffect, useCallback } from 'react';
import {
  getMarriageInvites,
  addMarriageInvites,
  resendMarriageInvite,
  removeMarriageInvite,
} from '@/services/api';
import type { MarriageEmailStatus } from '@/types/auth';

interface Props {
  eventId: string;
}

const statusColors: Record<string, string> = {
  Pending: 'var(--text-muted)',
  Confirmed: '#22c55e',
  Expired: 'var(--danger)',
};

export function MarriageInvitePanel({ eventId }: Props) {
  const [invites, setInvites] = useState<MarriageEmailStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMarriageInvites(eventId);
      setInvites(data);
    } catch {
      setError('Could not load invites.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const emails = emailInput
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (emails.length === 0) return;
      const added = await addMarriageInvites(eventId, emails);
      setInvites((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]));
        added.forEach((i) => map.set(i.id, i));
        return Array.from(map.values());
      });
      setEmailInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleResend = async (invite: MarriageEmailStatus) => {
    try {
      await resendMarriageInvite(eventId, invite.id);
      alert(`Verification email resent to ${invite.email}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  const handleRemove = async (invite: MarriageEmailStatus) => {
    if (!confirm(`Remove ${invite.email} from this event?`)) return;
    try {
      await removeMarriageInvite(eventId, invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  return (
    <div className="card" style={{ marginBottom: 32 }}>
      <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>📧 Invited Contacts</h2>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="email@example.com, another@example.com"
          style={{ flex: 1, minWidth: 200 }}
        />
        <button type="submit" disabled={adding || !emailInput.trim()} className="btn btn-primary">
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </form>
      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontSize: '0.9rem' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : invites.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No invites sent yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Confirmed</th>
              <th style={{ padding: '6px 8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px' }}>{invite.email}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ color: statusColors[invite.status] ?? 'inherit', fontWeight: 600 }}>
                    {invite.status}
                  </span>
                </td>
                <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                  {invite.verifiedAt ? new Date(invite.verifiedAt).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '8px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {invite.status !== 'Confirmed' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleResend(invite)}
                      title="Resend verification email"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemove(invite)}
                    title="Remove from event"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
