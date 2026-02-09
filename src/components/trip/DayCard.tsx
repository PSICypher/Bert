'use client';

import { MapPin, Clock, DollarSign, Home } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];
type Accommodation = Database['public']['Tables']['accommodations']['Row'];

interface DayCardProps {
  day: ItineraryDay;
  accommodation?: Accommodation;
}

interface Activity {
  name?: string;
  cost?: number;
}

export function DayCard({ day, accommodation }: DayCardProps) {
  const activities: Activity[] = Array.isArray(day.activities)
    ? (day.activities as Activity[])
    : [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div
      className="rounded-lg border bg-white shadow-sm overflow-hidden"
      style={{ borderLeftColor: day.color, borderLeftWidth: '4px' }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{day.icon || '📍'}</span>
            <div>
              <h3 className="font-semibold text-gray-900">Day {day.day_number}</h3>
              <p className="text-sm text-gray-500">{formatDate(day.date)}</p>
            </div>
          </div>
          {day.drive_time && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" />
              {day.drive_time}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
          <MapPin className="w-4 h-4" />
          <span>{day.location}</span>
        </div>

        {activities.length > 0 && (
          <div className="space-y-1 mb-3">
            {activities.map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">• {activity.name || 'Activity'}</span>
                {activity.cost !== undefined && activity.cost > 0 && (
                  <span className="flex items-center text-gray-500">
                    <DollarSign className="w-3 h-3" />
                    {activity.cost}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {accommodation && (
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <Home className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{accommodation.name}</span>
            </div>
            {accommodation.cost && (
              <p className="text-xs text-gray-500 mt-1 ml-6">
                {accommodation.currency} {accommodation.cost.toFixed(2)} / night
              </p>
            )}
          </div>
        )}

        {day.notes && (
          <p className="text-xs text-gray-500 mt-3 italic">{day.notes}</p>
        )}
      </div>
    </div>
  );
}
