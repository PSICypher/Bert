'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  RefreshCw,
  AlertCircle,
  PartyPopper,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type PackingItem = Database['public']['Tables']['packing_items']['Row'];
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];
type Accommodation = Database['public']['Tables']['accommodations']['Row'];
type TransportRow = Database['public']['Tables']['transport']['Row'];

interface PackingListProps {
  tripId: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  days?: ItineraryDay[];
  transport?: TransportRow[];
  accommodations?: Accommodation[];
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

const PROGRESS_MESSAGES = [
  { threshold: 0, message: "Let's get packing! 🎒" },
  { threshold: 25, message: 'Great start! Keep going 💪' },
  { threshold: 50, message: 'Halfway there! 🎯' },
  { threshold: 75, message: 'Almost there! 🔥' },
  { threshold: 90, message: 'So close! Just a few more ✨' },
  { threshold: 100, message: 'All packed! Ready for adventure! 🎉' },
];

function getProgressMessage(percentage: number): string {
  for (let i = PROGRESS_MESSAGES.length - 1; i >= 0; i--) {
    if (percentage >= PROGRESS_MESSAGES[i].threshold) {
      return PROGRESS_MESSAGES[i].message;
    }
  }
  return PROGRESS_MESSAGES[0].message;
}

function hashItinerary(days?: ItineraryDay[], transport?: TransportRow[], accommodations?: Accommodation[]): string {
  const dayData = (days || []).map(d => ({
    n: d.day_number,
    l: d.location,
    a: (d.activities as Array<{ name: string }> || []).map(a => a.name).sort(),
  }));
  const transportData = (transport || []).map(t => ({ type: t.type, vehicle: t.vehicle }));
  const accData = (accommodations || []).map(a => ({ name: a.name, type: a.type }));
  return JSON.stringify({ d: dayData, t: transportData, a: accData });
}

function detectItineraryChanges(
  days?: ItineraryDay[],
  transport?: TransportRow[],
  accommodations?: Accommodation[],
  prevDays?: ItineraryDay[],
  prevTransport?: TransportRow[],
  prevAccommodations?: Accommodation[]
): string | null {
  if (!prevDays && !prevTransport && !prevAccommodations) return null;

  // Check for new activities
  const prevActivities = new Set(
    (prevDays || []).flatMap(d => (d.activities as Array<{ name: string }> || []).map(a => a.name))
  );
  const currentActivities = (days || []).flatMap(d => {
    const acts = d.activities as Array<{ name: string }> || [];
    return acts.map(a => ({ name: a.name, day: d.day_number, location: d.location }));
  });
  const newActivities = currentActivities.filter(a => !prevActivities.has(a.name));

  // Check for new transport types
  const prevTransportTypes = new Set((prevTransport || []).map(t => t.type));
  const newTransport = (transport || []).filter(t => !prevTransportTypes.has(t.type));

  // Check for boat trips specifically
  const boatTypes = ['boat', 'ferry', 'cruise', 'ship'];
  const hasNewBoat = newTransport.some(t => boatTypes.some(bt => t.type.toLowerCase().includes(bt)));
  if (hasNewBoat) {
    const boat = newTransport.find(t => boatTypes.some(bt => t.type.toLowerCase().includes(bt)));
    return `🚢 A boat trip${boat?.dropoff_location ? ` to ${boat.dropoff_location}` : ''}? You might want to pack differently!`;
  }

  // Check for beach activities
  const beachKeywords = ['beach', 'snorkel', 'surf', 'swim', 'pool', 'water park'];
  const newBeachActivity = newActivities.find(a => beachKeywords.some(k => a.name.toLowerCase().includes(k)));
  if (newBeachActivity) {
    return `🏖️ Looks like you added ${newBeachActivity.name} on Day ${newBeachActivity.day}! Should we update your packing list?`;
  }

  // Generic change
  if (newActivities.length > 0 || newTransport.length > 0) {
    return `📅 Plans changed — let's make sure you're packing the right stuff!`;
  }

  return null;
}

export function PackingList({
  tripId,
  destination,
  startDate,
  endDate,
  days,
  transport,
  accommodations,
}: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.name))
  );
  const [newItemName, setNewItemName] = useState('');
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeNotification, setChangeNotification] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevItineraryHash = useRef<string | null>(null);
  const prevDaysRef = useRef<ItineraryDay[] | undefined>(undefined);
  const prevTransportRef = useRef<TransportRow[] | undefined>(undefined);
  const prevAccommodationsRef = useRef<Accommodation[] | undefined>(undefined);

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

  // Detect itinerary changes
  useEffect(() => {
    const currentHash = hashItinerary(days, transport, accommodations);
    if (prevItineraryHash.current !== null && prevItineraryHash.current !== currentHash && items.length > 0) {
      const notification = detectItineraryChanges(
        days, transport, accommodations,
        prevDaysRef.current, prevTransportRef.current, prevAccommodationsRef.current
      );
      if (notification) {
        setChangeNotification(notification);
      }
    }
    prevItineraryHash.current = currentHash;
    prevDaysRef.current = days;
    prevTransportRef.current = transport;
    prevAccommodationsRef.current = accommodations;
  }, [days, transport, accommodations, items.length]);

  // Extract real activities from itinerary
  const itineraryActivities = useMemo(() => {
    if (!days || days.length === 0) return [];
    return days.flatMap(d => {
      const acts = d.activities as Array<{ name: string }> || [];
      return acts.map(a => a.name);
    });
  }, [days]);

  const itineraryContext = useMemo(() => {
    if (!days || days.length === 0) return undefined;
    return {
      days: days.map(d => ({
        day_number: d.day_number,
        date: d.date,
        location: d.location,
        activities: (d.activities as Array<{ name: string; time?: string }>) || [],
      })),
      transport: (transport || []).map(t => ({
        type: t.type,
        provider: t.provider || '',
        details: t.vehicle || '',
        pickup_location: t.pickup_location || undefined,
        dropoff_location: t.dropoff_location || undefined,
      })),
      accommodations: (accommodations || []).map(a => ({
        name: a.name,
        type: a.type || '',
        location: a.location || '',
        check_in: a.check_in || '',
        check_out: a.check_out || '',
      })),
    };
  }, [days, transport, accommodations]);

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
    const percentage = total > 0 ? Math.round((packed / total) * 100) : 0;
    return { total, packed, percentage };
  }, [items]);

  // Celebration when all packed
  useEffect(() => {
    if (stats.total > 0 && stats.packed === stats.total) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [stats.total, stats.packed]);

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
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i))
    );

    try {
      const res = await fetch(`/api/packing?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packed: !item.packed }),
      });

      if (!res.ok) {
        // Revert on failure
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, packed: item.packed } : i))
        );
      }
    } catch (err) {
      console.error('Failed to update item:', err);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, packed: item.packed } : i))
      );
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
    setChangeNotification(null);

    const activitiesList = itineraryActivities.length > 0
      ? itineraryActivities
      : ['sightseeing'];

    try {
      const res = await fetch('/api/ai/generate-packing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          travellerCount: 4,
          activities: activitiesList,
          itinerary: itineraryContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.items && Array.isArray(data.items)) {
          // When items exist, do smart merge — don't blow away manually added items
          const existingNames = new Set(items.map(i => i.name.toLowerCase()));
          const newItems = data.items.filter(
            (item: { name: string }) => !existingNames.has(item.name.toLowerCase())
          );

          if (newItems.length > 0) {
            // Bulk insert new items
            const itemsToInsert = newItems.map((item: { category?: string; name: string; quantity?: number }, index: number) => ({
              trip_id: tripId,
              category: item.category || 'Misc',
              name: item.name,
              quantity: item.quantity || 1,
              sort_order: items.length + index,
            }));

            const insertRes = await fetch('/api/packing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(itemsToInsert),
            });

            if (insertRes.ok) {
              await loadItems();
            }
          } else if (items.length === 0) {
            // First time — save all items
            const itemsToInsert = data.items.map((item: { category?: string; name: string; quantity?: number }, index: number) => ({
              trip_id: tripId,
              category: item.category || 'Misc',
              name: item.name,
              quantity: item.quantity || 1,
              sort_order: index,
            }));

            const insertRes = await fetch('/api/packing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(itemsToInsert),
            });

            if (insertRes.ok) {
              await loadItems();
            }
          }
        }
      } else {
        setError('Failed to generate packing list');
      }
    } catch {
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
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 text-center animate-pulse">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <PartyPopper className="w-6 h-6" />
            <span className="text-lg font-bold">All packed and ready to go!</span>
            <PartyPopper className="w-6 h-6" />
          </div>
          <p className="text-sm text-green-600 mt-1">Nothing left behind — time for adventure! ✈️</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Packing Progress</span>
          </div>
          <span className="text-sm text-gray-600">
            {stats.packed} / {stats.total} items
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              stats.percentage === 100
                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                : stats.percentage >= 75
                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                : stats.percentage >= 50
                ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                : 'bg-gradient-to-r from-blue-300 to-blue-400'
            }`}
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{getProgressMessage(stats.percentage)}</p>
      </div>

      {/* Itinerary Change Notification */}
      {changeNotification && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{changeNotification}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleGenerateList}
                  disabled={generating}
                  className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                  Update Packing List
                </button>
                <button
                  onClick={() => setChangeNotification(null)}
                  className="text-xs text-amber-700 px-3 py-1.5 rounded-md hover:bg-amber-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate / Update Button — always visible */}
      <button
        onClick={handleGenerateList}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Sparkles className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
        {generating
          ? 'Generating...'
          : items.length === 0
          ? 'Generate Packing List with AI ✨'
          : 'Update Packing List with AI 🔄'}
      </button>

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
          const allPacked = categoryItems.length > 0 && packedCount === categoryItems.length;

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
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      allPacked
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {packedCount}/{categoryItems.length}
                    </span>
                  )}
                  {allPacked && <span className="text-xs">✅</span>}
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
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              item.packed
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-green-500'
                            }`}
                          >
                            {item.packed && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`text-sm ${
                                item.packed ? 'text-gray-400 line-through' : 'text-gray-700'
                              }`}
                            >
                              {item.name}
                              {item.quantity > 1 && (
                                <span className="ml-1 text-gray-400">×{item.quantity}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
