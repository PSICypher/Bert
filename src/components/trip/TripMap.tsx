'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { TripMapLocation } from './TripMapInner'

// Dynamically import TripMapInner with SSR disabled
// Leaflet requires browser APIs and can't run on the server
const TripMapInner = dynamic(
  () => import('./TripMapInner').then((mod) => mod.TripMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    ),
  }
)

interface TripMapProps {
  locations: TripMapLocation[]
  onLocationSelect?: (location: TripMapLocation | null) => void
  className?: string
}

export function TripMap({ locations, onLocationSelect, className }: TripMapProps) {
  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className || ''}`}>
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Trip Map</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {locations.length} location{locations.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="h-[400px]">
        <TripMapInner
          locations={locations}
          onLocationSelect={onLocationSelect}
          className="h-full"
        />
      </div>
    </div>
  )
}

// Re-export the location type for convenience
export type { TripMapLocation }
