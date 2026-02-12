'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
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
import { JourneyOverview } from '@/components/trip/JourneyOverview';
import { DayCardGrid } from '@/components/trip/DayCardGrid';
import { TripMap } from '@/components/trip/TripMap';
import type { TripMapLocation, TransportSegment } from '@/components/trip/TripMap';
import type { Database } from '@/lib/database.types';

// Dynamic imports for heavier components (using named exports)
const BookingChecklist = dynamic(
  () => import('@/components/trip/BookingChecklist').then((mod) => mod.BookingChecklist),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const ResearchChat = dynamic(
  () => import('@/components/trip/ResearchChat').then((mod) => mod.ResearchChat),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const TravelDocsHub = dynamic(
  () => import('@/components/trip/TravelDocsHub').then((mod) => mod.TravelDocsHub),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const DocumentsTab = dynamic(
  () => import('@/components/trip/DocumentsTab').then((mod) => mod.DocumentsTab),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const PackingList = dynamic(
  () => import('@/components/trip/PackingList').then((mod) => mod.PackingList),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const AiInsights = dynamic(
  () => import('@/components/trip/AiInsights').then((mod) => mod.AiInsights),
  { loading: () => <div className="animate-pulse bg-gray-100 rounded-lg h-64" /> }
);

const ChangeSheet = dynamic(
  () => import('@/components/trip/ChangeSheet').then((mod) => mod.ChangeSheet),
  { ssr: false }
);

type Trip = Database['public']['Tables']['trips']['Row'];
type PlanVersion = Database['public']['Tables']['plan_versions']['Row'];
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row'];
type Accommodation = Database['public']['Tables']['accommodations']['Row'];
type Transport = Database['public']['Tables']['transport']['Row'];
type Cost = Database['public']['Tables']['costs']['Row'];
type Decision = Database['public']['Tables']['decisions']['Row'];

type TabId = 'overview' | 'map' | 'research' | 'checklist' | 'travel-docs' | 'documents' | 'packing' | 'ai-insights';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Map;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'map', label: 'Route Map', icon: Map },
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
  const [transport, setTransport] = useState<Transport[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);

  const activePlan = plans.find((p) => p.id === activePlanId) || null;
  const currencySymbol = activePlan?.currency === 'GBP' ? '£' : '$';

  // Build map locations from itinerary days (only those with coordinates)
  const mapLocations: TripMapLocation[] = useMemo(() => {
    return days
      .filter((day) => day.location_coordinates)
      .map((day) => {
        const coords = day.location_coordinates as { lat: number; lng: number };
        const activities = (day.activities as Array<{ name: string }>) || [];
        const details = activities.map((a) => a.name).join(' · ');
        return {
          id: day.id,
          name: day.location,
          coordinates: coords,
          color: day.color || '#3b82f6',
          type: 'day' as const,
          dayNumber: day.day_number,
          details: details || undefined,
        };
      });
  }, [days]);

  // Known coordinates for geocoding transport pickup/dropoff locations
  const KNOWN_COORDS: Record<string, { lat: number; lng: number }> = useMemo(() => ({
    'fort lauderdale': { lat: 26.1224, lng: -80.1373 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'miami beach': { lat: 25.7907, lng: -80.1300 },
    'port of miami': { lat: 25.7743, lng: -80.1696 },
    'port everglades': { lat: 26.0849, lng: -80.1182 },
    'key west': { lat: 24.5551, lng: -81.7800 },
    'nassau': { lat: 25.0343, lng: -77.3963 },
    'nassau bahamas': { lat: 25.0343, lng: -77.3963 },
    'freeport': { lat: 26.5285, lng: -78.6967 },
    'freeport bahamas': { lat: 26.5285, lng: -78.6967 },
    'bimini': { lat: 25.7267, lng: -79.2690 },
    'paradise island': { lat: 25.0862, lng: -77.3232 },
    'grand bahama': { lat: 26.6593, lng: -78.5201 },
    'harbour island': { lat: 25.5014, lng: -76.6331 },
    'exuma': { lat: 23.6133, lng: -75.9694 },
    'marsh harbour': { lat: 26.5414, lng: -77.0636 },
    'eleuthera': { lat: 25.2949, lng: -76.2079 },
    'orlando': { lat: 28.5383, lng: -81.3792 },
    'tampa': { lat: 27.9506, lng: -82.4572 },
    'jacksonville': { lat: 30.3322, lng: -81.6557 },
  }), []);

  // Build transport segments for boat/ferry/cruise routes
  const transportSegments: TransportSegment[] = useMemo(() => {
    const boatTypes = ['boat', 'ferry', 'cruise', 'ship'];
    return transport
      .filter((t) => boatTypes.some((bt) => t.type.toLowerCase().includes(bt)))
      .map((t) => {
        const pickupKey = (t.pickup_location || '').toLowerCase().replace(/[,.\s]+/g, ' ').trim();
        const dropoffKey = (t.dropoff_location || '').toLowerCase().replace(/[,.\s]+/g, ' ').trim();

        // Try exact match, then partial match
        const findCoords = (key: string) => {
          if (KNOWN_COORDS[key]) return KNOWN_COORDS[key];
          for (const [k, v] of Object.entries(KNOWN_COORDS)) {
            if (key.includes(k) || k.includes(key)) return v;
          }
          return null;
        };

        const fromCoords = findCoords(pickupKey);
        const toCoords = findCoords(dropoffKey);

        if (!fromCoords || !toCoords) return null;

        return {
          id: t.id,
          from: fromCoords,
          to: toCoords,
          fromName: t.pickup_location || 'Departure',
          toName: t.dropoff_location || 'Arrival',
          type: t.type,
        };
      })
      .filter((s): s is TransportSegment => s !== null);
  }, [transport, KNOWN_COORDS]);

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
      const [daysRes, accRes, transportRes, costsRes] = await Promise.all([
        fetch(`/api/itinerary-days?planVersionId=${activePlanId}`),
        fetch(`/api/accommodations?planVersionId=${activePlanId}`),
        fetch(`/api/transport?plan_version_id=${activePlanId}`),
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

      if (transportRes.ok) {
        const transportData = await transportRes.json();
        setTransport(transportData);
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
      const res = await fetch(`/api/decisions?trip_id=${tripId}`);
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

  const handleChangeDay = (day: ItineraryDay) => {
    setEditingDay(day);
  };

  const handleDayEditClose = () => {
    setEditingDay(null);
  };

  const handleDayEditApplied = () => {
    setEditingDay(null);
    fetchPlanData(); // Refresh days data
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
            {/* Journey Overview */}
            {days.length > 0 && <JourneyOverview days={days} />}

            {/* Day Card Grid */}
            <DayCardGrid
              days={days}
              accommodations={accommodations}
              costs={costs}
              currencySymbol={currencySymbol}
              planVersionId={activePlanId}
              onChangeDay={handleChangeDay}
            />
          </div>
        )}

        {activeTab === 'map' && (
          <TripMap
            locations={mapLocations}
            transportSegments={transportSegments}
            showRouteOverlay
            height="calc(100vh - 280px)"
            title="Route Map"
            subtitle={`${trip.destination} · ${mapLocations.length} stops${transportSegments.length > 0 ? ` · ${transportSegments.length} boat route${transportSegments.length !== 1 ? 's' : ''}` : ''}`}
          />
        )}

        {activeTab === 'research' && (
          <ResearchChat
            tripId={tripId}
            planVersionId={activePlanId || null}
            destination={trip.destination}
          />
        )}

        {activeTab === 'checklist' && activePlan && (
          <BookingChecklist
            planVersionId={activePlan.id}
            planName={activePlan.name}
            currencySymbol={currencySymbol}
            accommodations={accommodations}
            transport={transport}
            costs={costs}
          />
        )}

        {activeTab === 'travel-docs' && (
          <TravelDocsHub
            tripId={tripId}
            tripStartDate={trip.start_date}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab tripId={tripId} />
        )}

        {activeTab === 'packing' && (
          <PackingList
            tripId={tripId}
            destination={trip.destination}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        )}

        {activeTab === 'ai-insights' && activePlan && (
          <AiInsights
            tripId={tripId}
            plans={plans}
            activePlanId={activePlanId}
            days={days}
            accommodations={accommodations}
            transport={transport}
            costs={costs}
            decisions={decisions}
          />
        )}
      </div>

      {/* Currency Widget */}
      <CurrencyWidget
        homeCurrency={activePlan?.currency || 'GBP'}
        tripCurrency="USD"
      />

      {/* Day Edit Sheet */}
      {editingDay && (
        <ChangeSheet
          isOpen={!!editingDay}
          onClose={handleDayEditClose}
          onApplied={handleDayEditApplied}
          tripId={tripId}
          planVersionId={activePlanId}
          currencySymbol={currencySymbol}
          destination={trip?.destination}
          itemType="itinerary_day"
          existingItem={editingDay}
          allDays={days}
        />
      )}
    </div>
  );
}
