'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Map,
  ListChecks,
  Search,
  FileText,
  Package,
  Sparkles,
  LayoutGrid,
  Plane,
} from 'lucide-react';
import TripHeader from '@/components/trip/TripHeader';
import TripDashboardHeader from '@/components/trip/TripDashboardHeader';
import PlanVersionTabs from '@/components/trip/PlanVersionTabs';
import CurrencyWidget from '@/components/trip/CurrencyWidget';
import type { Database } from '@/lib/database.types';

type Trip = Database['public']['Tables']['trips']['Row'];
type PlanVersion = Database['public']['Tables']['plan_versions']['Row'];
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];
type Accommodation = Database['public']['Tables']['accommodations']['Row'];
type Cost = Database['public']['Tables']['costs']['Row'];
type Decision = Database['public']['Tables']['decisions']['Row'];

type TabId = 'overview' | 'research' | 'checklist' | 'travel-docs' | 'documents' | 'packing' | 'ai-insights';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Map;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'checklist', label: 'Checklist', icon: ListChecks },
  { id: 'travel-docs', label: 'Travel Docs', icon: Plane },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'packing', label: 'Packing', icon: Package },
  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles },
];

export default function TripPage() {
  const params = useParams();
  const tripId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [plans, setPlans] = useState<PlanVersion[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const activePlan = plans.find((p) => p.id === activePlanId) || null;

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error('Failed to fetch trip');
      const data = await res.json();
      setTrip(data);
    } catch (err) {
      console.error('Failed to fetch trip:', err);
      setError('Failed to load trip');
    }
  }, [tripId]);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans?tripId=${tripId}`);
      if (!res.ok) throw new Error('Failed to fetch plans');
      const data = await res.json();
      setPlans(data);

      // Set active plan to the default or first plan
      if (data.length > 0) {
        const defaultPlan = data.find((p: PlanVersion) => p.is_active) || data[0];
        setActivePlanId(defaultPlan.id);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  }, [tripId]);

  // Fetch plan-specific data
  const fetchPlanData = useCallback(async () => {
    if (!activePlanId) return;

    try {
      const [daysRes, accRes, costsRes] = await Promise.all([
        fetch(`/api/itinerary-days?planVersionId=${activePlanId}`),
        fetch(`/api/accommodations?planVersionId=${activePlanId}`),
        fetch(`/api/costs?planVersionId=${activePlanId}`),
      ]);

      if (daysRes.ok) {
        const daysData = await daysRes.json();
        setDays(daysData);
      }

      if (accRes.ok) {
        const accData = await accRes.json();
        setAccommodations(accData);
      }

      if (costsRes.ok) {
        const costsData = await costsRes.json();
        setCosts(costsData);
      }
    } catch (err) {
      console.error('Failed to fetch plan data:', err);
    }
  }, [activePlanId]);

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch(`/api/decisions?tripId=${tripId}`);
      if (!res.ok) throw new Error('Failed to fetch decisions');
      const data = await res.json();
      setDecisions(data);
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
    }
  }, [tripId]);

  // Initial data fetch
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchTrip(), fetchPlans(), fetchDecisions()]);
      setLoading(false);
    }
    loadData();
  }, [fetchTrip, fetchPlans, fetchDecisions]);

  // Fetch plan data when active plan changes
  useEffect(() => {
    if (activePlanId) {
      fetchPlanData();
    }
  }, [activePlanId, fetchPlanData]);

  const handlePlansChanged = () => {
    fetchPlans();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Trip not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Trip Header */}
      <TripHeader trip={trip} plan={activePlan || undefined} />

      {/* Dashboard Header with metrics */}
      <TripDashboardHeader
        trip={trip}
        plan={activePlan}
        days={days}
        accommodations={accommodations}
        costs={costs}
        decisions={decisions}
      />

      {/* Plan Version Tabs */}
      {plans.length > 0 && (
        <PlanVersionTabs
          plans={plans}
          activePlanId={activePlanId}
          tripId={tripId}
          onSelectPlan={setActivePlanId}
          onPlansChanged={handlePlansChanged}
        />
      )}

      {/* Content Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 py-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Overview placeholder - will show JourneyOverview, DayCardGrid, TripMap, etc. */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Trip Overview</h2>
              {days.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {days.map((day) => (
                    <div
                      key={day.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-8 h-8 flex items-center justify-center rounded-full text-white text-sm font-medium"
                          style={{ backgroundColor: day.color }}
                        >
                          {day.day_number}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">{day.location}</div>
                          {day.date && (
                            <div className="text-xs text-gray-500">
                              {new Date(day.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      {day.drive_time && (
                        <div className="text-xs text-gray-500 mt-2">
                          Drive: {day.drive_time}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No itinerary days added yet.</p>
              )}
            </div>

            {/* Accommodations summary */}
            {accommodations.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Accommodations</h2>
                <div className="space-y-3">
                  {accommodations.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{acc.name}</div>
                        <div className="text-sm text-gray-500">
                          {acc.check_in} to {acc.check_out} ({acc.nights} nights)
                        </div>
                      </div>
                      {acc.cost && (
                        <div className="text-sm font-medium text-gray-900">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: acc.currency,
                          }).format(acc.cost)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'research' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Research</h2>
            <p className="text-gray-500">Research chat will be available in a future update.</p>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Checklist</h2>
            <p className="text-gray-500">Booking checklist will be available in a future update.</p>
          </div>
        )}

        {activeTab === 'travel-docs' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Travel Documents</h2>
            <p className="text-gray-500">Travel docs hub will be available in a future update.</p>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            <p className="text-gray-500">Document uploads will be available in a future update.</p>
          </div>
        )}

        {activeTab === 'packing' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Packing List</h2>
            <p className="text-gray-500">Packing list will be available in a future update.</p>
          </div>
        )}

        {activeTab === 'ai-insights' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h2>
            <p className="text-gray-500">AI insights will be available in a future update.</p>
          </div>
        )}
      </div>

      {/* Currency Widget */}
      <CurrencyWidget
        homeCurrency={activePlan?.currency || 'GBP'}
        tripCurrency="USD"
      />
    </div>
  );
}
