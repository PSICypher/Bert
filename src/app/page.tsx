'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Plus, Plane, Calendar, MapPin } from 'lucide-react';
import PushNotificationToggle from '@/components/PushNotificationToggle';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  is_archived: boolean;
}

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadData() {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Fetch trips
      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
      } else {
        setTrips(trips || []);
      }

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start) return 'Dates not set';
    const startDate = new Date(start).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    if (!end) return startDate;
    const endDate = new Date(end).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    return `${startDate} - ${endDate}`;
  };

  const createNewTrip = async () => {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        name: 'New Trip',
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trip:', error);
      return;
    }

    router.push(`/trips/${data.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Plane className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-900">Holiday Planner</h1>
            </div>
            <div className="flex items-center gap-4">
              <PushNotificationToggle />
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold text-gray-800">Your Trips</h2>
          <button
            onClick={createNewTrip}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Trip
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-purple-100">
            <Plane className="h-16 w-16 text-purple-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
            <p className="text-gray-500 mb-6">Start planning your next adventure!</p>
            <button
              onClick={createNewTrip}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Your First Trip
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Cover Image */}
                <div className="h-40 bg-gradient-to-br from-purple-400 to-indigo-500 relative">
                  {trip.cover_image_url && (
                    <img
                      src={trip.cover_image_url}
                      alt={trip.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                    {trip.name}
                  </h3>

                  {trip.destination && (
                    <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                      <MapPin className="h-4 w-4" />
                      {trip.destination}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Calendar className="h-4 w-4" />
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </div>

                  {trip.description && (
                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                      {trip.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
