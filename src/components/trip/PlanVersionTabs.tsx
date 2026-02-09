'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Plus,
  Check,
  X,
  Pencil,
  Copy,
  Star,
  Trash2,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type PlanVersion = Database['public']['Tables']['plan_versions']['Row'];

interface PlanVersionTabsProps {
  plans: PlanVersion[];
  activePlanId: string;
  tripId: string;
  onSelectPlan: (planId: string) => void;
  onPlansChanged: () => void;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PLAN_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export default function PlanVersionTabs({
  plans,
  activePlanId,
  tripId,
  onSelectPlan,
  onPlansChanged,
}: PlanVersionTabsProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [loading, setLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newPlanInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Focus new plan input
  useEffect(() => {
    if (showAddForm && newPlanInputRef.current) {
      newPlanInputRef.current.focus();
    }
  }, [showAddForm]);

  const startEditing = (plan: PlanVersion) => {
    setEditingId(plan.id);
    setEditName(plan.name);
    setMenuOpenId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveName = async (planId: string) => {
    if (!editName.trim()) {
      cancelEditing();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) throw new Error('Failed to update plan');
      onPlansChanged();
    } catch (err) {
      console.error('Failed to rename plan:', err);
    } finally {
      setLoading(false);
      cancelEditing();
    }
  };

  const duplicatePlan = async (planId: string) => {
    setLoading(true);
    setMenuOpenId(null);
    try {
      const res = await fetch(`/api/plans/${planId}/duplicate`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to duplicate plan');
      const newPlan = await res.json();
      onPlansChanged();
      onSelectPlan(newPlan.id);
    } catch (err) {
      console.error('Failed to duplicate plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const setDefaultPlan = async (planId: string) => {
    setLoading(true);
    setMenuOpenId(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      if (!res.ok) throw new Error('Failed to set default plan');
      onPlansChanged();
    } catch (err) {
      console.error('Failed to set default plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (plans.length <= 1) {
      alert('Cannot delete the last plan');
      return;
    }

    if (!confirm('Are you sure you want to delete this plan?')) return;

    setLoading(true);
    setMenuOpenId(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete plan');

      // If we deleted the active plan, switch to another
      if (planId === activePlanId) {
        const remainingPlans = plans.filter((p) => p.id !== planId);
        if (remainingPlans.length > 0) {
          onSelectPlan(remainingPlans[0].id);
        }
      }
      onPlansChanged();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async () => {
    if (!newPlanName.trim()) {
      setShowAddForm(false);
      setNewPlanName('');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          name: newPlanName.trim(),
          color: PLAN_COLORS[plans.length % PLAN_COLORS.length],
        }),
      });

      if (!res.ok) throw new Error('Failed to create plan');
      const newPlan = await res.json();
      onPlansChanged();
      onSelectPlan(newPlan.id);
    } catch (err) {
      console.error('Failed to create plan:', err);
    } finally {
      setLoading(false);
      setShowAddForm(false);
      setNewPlanName('');
    }
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
          {plans.map((plan) => {
            const isActive = plan.id === activePlanId;
            const isEditing = editingId === plan.id;

            return (
              <div key={plan.id} className="relative flex-shrink-0">
                {isEditing ? (
                  <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 rounded-md">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(plan.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="w-32 px-2 py-0.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={loading}
                    />
                    <button
                      onClick={() => saveName(plan.id)}
                      disabled={loading}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={loading}
                      className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      onClick={() => onSelectPlan(plan.id)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                        ${isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: plan.color }}
                      />
                      <span>{plan.name}</span>
                      {plan.total_cost > 0 && (
                        <span className="text-xs text-gray-400">
                          {formatCurrency(plan.total_cost, plan.currency)}
                        </span>
                      )}
                      {plan.is_active && (
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      )}
                    </button>

                    {/* Context menu button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === plan.id ? null : plan.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Context menu dropdown */}
                    {menuOpenId === plan.id && (
                      <div
                        ref={menuRef}
                        className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20"
                      >
                        <button
                          onClick={() => startEditing(plan)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="w-4 h-4" />
                          Rename
                        </button>
                        <button
                          onClick={() => duplicatePlan(plan.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        {!plan.is_active && (
                          <button
                            onClick={() => setDefaultPlan(plan.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Star className="w-4 h-4" />
                            Set as default
                          </button>
                        )}
                        {plans.length > 1 && (
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add plan button/form */}
          {showAddForm ? (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 rounded-md flex-shrink-0">
              <input
                ref={newPlanInputRef}
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createPlan();
                  if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewPlanName('');
                  }
                }}
                placeholder="Plan name..."
                className="w-32 px-2 py-0.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={createPlan}
                disabled={loading}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewPlanName('');
                }}
                disabled={loading}
                className="p-1 text-gray-400 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
