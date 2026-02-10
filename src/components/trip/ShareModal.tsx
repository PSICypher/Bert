'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Mail, UserPlus, Trash2, Clock, Check } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type TripShare = Database['public']['Tables']['trip_shares']['Row'];

interface ShareModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSIONS = [
  { value: 'view', label: 'View only', description: 'Can view but not edit' },
  { value: 'edit', label: 'Can edit', description: 'Can make changes to the trip' },
  { value: 'admin', label: 'Admin', description: 'Full access including sharing' },
] as const;

export function ShareModal({ tripId, isOpen, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<TripShare[]>([]);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data);
      }
    } catch (err) {
      console.error('Failed to load shares:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (isOpen) {
      loadShares();
      setError(null);
    }
  }, [isOpen, loadShares]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/trips/${tripId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      if (res.ok) {
        setEmail('');
        setPermission('view');
        await loadShares();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send invitation');
      }
    } catch (err) {
      setError('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/shares/${shareId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: newPermission }),
      });

      if (res.ok) {
        setShares((prev) =>
          prev.map((s) => (s.id === shareId ? { ...s, permission: newPermission } : s))
        );
      }
    } catch (err) {
      console.error('Failed to update permission:', err);
    }
  };

  const handleRemove = async (shareId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch (err) {
      console.error('Failed to remove share:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Share Trip</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite by email
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sending}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permission level
              </label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit' | 'admin')}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              >
                {PERMISSIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || sending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        <div className="border-t max-h-64 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Shared with</h3>
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Not shared with anyone yet
              </p>
            ) : (
              <div className="space-y-3">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {share.shared_with_email}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {share.accepted_at ? (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span>Accepted</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                    <select
                      value={share.permission}
                      onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                      className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {PERMISSIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(share.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
