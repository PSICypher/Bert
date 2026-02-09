'use client';

import { useRef, useEffect, useMemo } from 'react';
import type { Database } from '@/lib/database.types';

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];

interface TimelineProps {
  days: ItineraryDay[];
  selectedDayId: string | null;
  onSelectDay: (dayId: string) => void;
}

export function Timeline({ days, selectedDayId, onSelectDay }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_number - b.day_number),
    [days]
  );

  const locationColors = useMemo(() => {
    const colors: Record<string, string> = {};
    sortedDays.forEach((day) => {
      if (!colors[day.location]) {
        colors[day.location] = day.color;
      }
    });
    return colors;
  }, [sortedDays]);

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedDayId]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (sortedDays.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300"
      >
        {sortedDays.map((day) => {
          const isSelected = day.id === selectedDayId;
          const isTransit = day.drive_time && day.drive_time.length > 0;

          return (
            <button
              key={day.id}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelectDay(day.id)}
              className={`relative flex-shrink-0 w-12 h-16 rounded transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-gray-300'
              }`}
              style={{
                backgroundColor: day.color,
                backgroundImage: isTransit
                  ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px)'
                  : undefined,
              }}
              title={`Day ${day.day_number}: ${day.location}${isTransit ? ' (transit)' : ''}`}
            >
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-white drop-shadow">
                {day.day_number}
              </span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white drop-shadow whitespace-nowrap">
                {formatDate(day.date)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
        {Object.entries(locationColors).map(([location, color]) => (
          <div key={location} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span>{location}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
