'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Package,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Trip = Database['public']['Tables']['trips']['Row'];
type PlanVersion = Database['public']['Tables']['plan_versions']['Row'];
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];
type Accommodation = Database['public']['Tables']['accommodations']['Row'];
type Cost = Database['public']['Tables']['costs']['Row'];
type Decision = Database['public']['Tables']['decisions']['Row'];
type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];

interface WeatherDay {
  date: string;
  temp: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';
}

interface TripDashboardHeaderProps {
  trip: Trip;
  plan: PlanVersion | null;
  days: ItineraryDay[];
  accommodations: Accommodation[];
  costs: Cost[];
  decisions: Decision[];
}

function getWeatherIcon(condition: WeatherDay['condition']) {
  switch (condition) {
    case 'sunny':
      return <Sun className="w-4 h-4 text-yellow-500" />;
    case 'cloudy':
      return <Cloud className="w-4 h-4 text-gray-500" />;
    case 'rainy':
      return <CloudRain className="w-4 h-4 text-blue-500" />;
    case 'snowy':
      return <CloudSnow className="w-4 h-4 text-blue-300" />;
    case 'windy':
      return <Wind className="w-4 h-4 text-gray-600" />;
    default:
      return <Cloud className="w-4 h-4 text-gray-400" />;
  }
}

function calculateDaysUntil(date: string | null): number | null {
  if (!date) return null;
  const tripDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  tripDate.setHours(0, 0, 0, 0);
  const diff = tripDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function TripDashboardHeader({
  trip,
  plan,
  days,
  accommodations,
  costs,
  decisions,
}: TripDashboardHeaderProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [packingCount, setPackingCount] = useState({ total: 0, packed: 0 });

  // Fetch checklist items
  const fetchChecklist = useCallback(async () => {
    if (!plan) return;
    try {
      const res = await fetch(`/api/checklist?planVersionId=${plan.id}`);
      if (res.ok) {
        const data = await res.json();
        setChecklist(data);
      }
    } catch (err) {
      console.error('Failed to fetch checklist:', err);
    }
  }, [plan]);

  // Fetch packing count
  const fetchPackingCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/packing?trip_id=${trip.id}&countOnly=true`);
      if (res.ok) {
        const data = await res.json();
        setPackingCount({ total: data.total || 0, packed: data.packed || 0 });
      }
    } catch (err) {
      console.error('Failed to fetch packing count:', err);
    }
  }, [trip.id]);

  // Fetch weather (mock for now - would use real weather API)
  const fetchWeather = useCallback(async () => {
    if (!trip.start_date) return;
    // Mock weather data - in production, this would call a weather API
    const mockWeather: WeatherDay[] = [];
    const startDate = new Date(trip.start_date);
    const conditions: WeatherDay['condition'][] = ['sunny', 'cloudy', 'sunny', 'rainy', 'sunny'];

    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      mockWeather.push({
        date: date.toISOString().split('T')[0],
        temp: 72 + Math.floor(Math.random() * 15),
        condition: conditions[i % conditions.length],
      });
    }
    setWeather(mockWeather);
  }, [trip.start_date]);

  useEffect(() => {
    fetchChecklist();
    fetchPackingCount();
    fetchWeather();
  }, [fetchChecklist, fetchPackingCount, fetchWeather]);

  // Calculate metrics
  const daysUntil = calculateDaysUntil(trip.start_date);

  // Booking progress
  const bookableItems = checklist.filter((item) => item.category !== 'other');
  const bookedItems = bookableItems.filter(
    (item) => item.booking_status === 'booked' || item.booking_status === 'confirmed'
  );
  const bookingProgress =
    bookableItems.length > 0
      ? Math.round((bookedItems.length / bookableItems.length) * 100)
      : 0;

  // Payment progress
  const totalPayable = checklist.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  const totalPaid = checklist.reduce((sum, item) => sum + (item.amount_paid || 0), 0);
  const paymentProgress = totalPayable > 0 ? Math.round((totalPaid / totalPayable) * 100) : 0;

  // Pending decisions
  const pendingDecisions = decisions.filter((d) => d.status === 'pending');

  // Packing progress
  const packingProgress =
    packingCount.total > 0
      ? Math.round((packingCount.packed / packingCount.total) * 100)
      : 0;

  return (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Countdown */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Countdown
              </span>
            </div>
            <div className="text-2xl font-bold">
              {daysUntil !== null ? (
                daysUntil > 0 ? (
                  <>
                    {daysUntil}
                    <span className="text-sm font-normal ml-1">days</span>
                  </>
                ) : daysUntil === 0 ? (
                  'Today!'
                ) : (
                  'Past'
                )
              ) : (
                '--'
              )}
            </div>
          </div>

          {/* Booking progress */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Booked
              </span>
            </div>
            <div className="text-2xl font-bold">
              {bookedItems.length}
              <span className="text-sm font-normal text-blue-200 ml-1">
                /{bookableItems.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${bookingProgress}%` }}
              />
            </div>
          </div>

          {/* Payment progress */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Paid
              </span>
            </div>
            <div className="text-2xl font-bold">
              {paymentProgress}
              <span className="text-sm font-normal ml-0.5">%</span>
            </div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
          </div>

          {/* Pending decisions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Decisions
              </span>
            </div>
            <div className="text-2xl font-bold">
              {pendingDecisions.length}
              <span className="text-sm font-normal text-blue-200 ml-1">
                pending
              </span>
            </div>
          </div>

          {/* Packing progress */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Packed
              </span>
            </div>
            <div className="text-2xl font-bold">
              {packingCount.packed}
              <span className="text-sm font-normal text-blue-200 ml-1">
                /{packingCount.total}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${packingProgress}%` }}
              />
            </div>
          </div>

          {/* Weather forecast */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sun className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium uppercase">
                Weather
              </span>
            </div>
            {weather.length > 0 ? (
              <div className="flex items-center gap-2">
                {weather.slice(0, 5).map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    {getWeatherIcon(day.condition)}
                    <span className="text-xs mt-1">{day.temp}°</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-blue-200">No forecast</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
