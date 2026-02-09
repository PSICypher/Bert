'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, Download, Calendar } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Trip = Database['public']['Tables']['trips']['Row'];
type PlanVersion = Database['public']['Tables']['plan_versions']['Row'];

interface TripHeaderProps {
  trip: Trip;
  plan?: PlanVersion;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates not set';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };

  if (!endDate) return startDate.toLocaleDateString('en-US', options);

  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
    }
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', options)}`;
  }

  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TripHeader({ trip, plan }: TripHeaderProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Back navigation */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to trips
          </Link>
        </div>

        {/* Header content */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Title and info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
              {trip.name}
            </h1>

            {trip.description && (
              <p className="mt-1 text-gray-600 line-clamp-2">
                {trip.description}
              </p>
            )}

            <div className="mt-2 flex items-center text-sm text-gray-500">
              <Calendar className="w-4 h-4 mr-1.5" />
              {formatDateRange(trip.start_date, trip.end_date)}
            </div>
          </div>

          {/* Actions and cost pill */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Total cost pill */}
            {plan && plan.total_cost > 0 && (
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                {formatCurrency(plan.total_cost, plan.currency)}
              </div>
            )}

            {/* Share button */}
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Share2 className="w-4 h-4 mr-1.5" />
              Share
            </button>

            {/* Export button */}
            <button
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ShareModal placeholder - will be implemented in a later phase */}
      {shareOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Share Trip</h2>
            <p className="text-gray-600 text-sm mb-4">
              Share functionality will be available in a future update.
            </p>
            <button
              onClick={() => setShareOpen(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
