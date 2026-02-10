'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import type { Database } from '@/lib/database.types';

type Comment = Database['public']['Tables']['comments']['Row'];

interface CommentThreadProps {
  tripId: string;
  itemType: string;
  itemId: string;
  userEmail?: string;
}

export function CommentThread({ tripId, itemType, itemId, userEmail }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/comments?trip_id=${tripId}&item_type=${itemType}&item_id=${itemId}`
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId, itemType, itemId]);

  useEffect(() => {
    if (expanded) {
      loadComments();
    }
  }, [expanded, loadComments]);

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, expanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          item_type: itemType,
          item_id: itemId,
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setMessage('');
        await loadComments();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="border rounded-lg bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Comments</span>
          {comments.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {comments.length}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          <div className="max-h-64 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white rounded-lg p-3 shadow-sm"
                  onMouseEnter={() => setHoveredId(comment.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                        {comment.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(comment.created_at)}
                      </p>
                    </div>
                    {hoveredId === comment.id && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment..."
                className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
