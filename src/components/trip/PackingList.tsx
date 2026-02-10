'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type PackingItem = Database['public']['Tables']['packing_items']['Row'];

interface PackingListProps {
  tripId: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const CATEGORIES = [
  { name: 'Clothes', emoji: '👕' },
  { name: 'Toiletries', emoji: '🧴' },
  { name: 'Electronics', emoji: '📱' },
  { name: 'Documents', emoji: '📄' },
  { name: 'Kids', emoji: '🧸' },
  { name: 'Beach/Pool', emoji: '🏖️' },
  { name: 'Medications', emoji: '💊' },
  { name: 'Misc', emoji: '📦' },
] as const;

export function PackingList({ tripId, destination, startDate, endDate }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.name))
  );
  const [newItemName, setNewItemName] = useState('');
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/packing?trip_id=${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load packing items:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, PackingItem[]> = {};
    CATEGORIES.forEach((c) => {
      grouped[c.name] = [];
    });
    items.forEach((item) => {
      const category = grouped[item.category] ? item.category : 'Misc';
      grouped[category].push(item);
    });
    return grouped;
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const packed = items.filter((i) => i.packed).length;
    return { total, packed, percentage: total > 0 ? Math.round((packed / total) * 100) : 0 };
  }, [items]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleTogglePacked = async (item: PackingItem) => {
    try {
      const res = await fetch(`/api/packing?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packed: !item.packed }),
      });

      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i))
        );
      }
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  const handleAddItem = async (category: string) => {
    if (!newItemName.trim()) return;

    try {
      const res = await fetch('/api/packing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          category,
          name: newItemName.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [...prev, data]);
        setNewItemName('');
        setAddingToCategory(null);
      }
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/packing?id=${itemId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleGenerateList = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-packing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          travellerCount: 4,
          activities: ['theme parks', 'beach', 'swimming'],
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            await fetch('/api/packing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trip_id: tripId,
                category: item.category || 'Misc',
                name: item.name,
                quantity: item.quantity || 1,
              }),
            });
          }
          await loadItems();
        }
      } else {
        setError('Failed to generate packing list');
      }
    } catch (err) {
      setError('Failed to generate packing list');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Packing Progress</span>
          </div>
          <span className="text-sm text-gray-600">
            {stats.packed} / {stats.total} items ({stats.percentage}%)
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
      </div>

      {/* AI Generate Button */}
      {items.length === 0 && (
        <button
          onClick={handleGenerateList}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Sparkles className="w-5 h-5" />
          {generating ? 'Generating...' : 'Generate Packing List with AI'}
        </button>
      )}

      {error && (
        <div className="flex items-center justify-between bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {CATEGORIES.map((category) => {
          const categoryItems = itemsByCategory[category.name] || [];
          const isExpanded = expandedCategories.has(category.name);
          const packedCount = categoryItems.filter((i) => i.packed).length;

          return (
            <div key={category.name} className="border rounded-lg bg-white overflow-hidden">
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{category.emoji}</span>
                  <span className="font-medium text-gray-900">{category.name}</span>
                  {categoryItems.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({packedCount}/{categoryItems.length})
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t">
                  {categoryItems.length > 0 && (
                    <div className="divide-y">
                      {categoryItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 group"
                        >
                          <button
                            onClick={() => handleTogglePacked(item)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              item.packed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500'
                            }`}
                          >
                            {item.packed && <Check className="w-3 h-3" />}
                          </button>
                          <span
                            className={`flex-1 text-sm ${
                              item.packed ? 'text-gray-400 line-through' : 'text-gray-700'
                            }`}
                          >
                            {item.name}
                            {item.quantity > 1 && (
                              <span className="ml-1 text-gray-400">×{item.quantity}</span>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-2">
                    {addingToCategory === category.name ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddItem(category.name);
                            if (e.key === 'Escape') {
                              setAddingToCategory(null);
                              setNewItemName('');
                            }
                          }}
                          placeholder="Item name"
                          className="flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddItem(category.name)}
                          disabled={!newItemName.trim()}
                          className="p-1.5 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAddingToCategory(null);
                            setNewItemName('');
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToCategory(category.name)}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 px-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add item
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
