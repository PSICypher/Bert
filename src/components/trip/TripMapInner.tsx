'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, X } from 'lucide-react'

export interface TripMapLocation {
  id: string
  name: string
  coordinates: { lat: number; lng: number }
  color: string
  type: 'day' | 'accommodation' | 'activity'
  dayNumber?: number
  details?: string
}

interface TripMapInnerProps {
  locations: TripMapLocation[]
  onLocationSelect?: (location: TripMapLocation | null) => void
  className?: string
}

export function TripMapInner({
  locations,
  onLocationSelect,
  className = '',
}: TripMapInnerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylinesRef = useRef<L.Polyline[]>([])
  const [selectedLocation, setSelectedLocation] = useState<TripMapLocation | null>(null)

  // Group locations by type for legend
  const locationsByType = useMemo(() => {
    const grouped: Record<string, TripMapLocation[]> = {}
    for (const loc of locations) {
      if (!grouped[loc.type]) {
        grouped[loc.type] = []
      }
      grouped[loc.type].push(loc)
    }
    return grouped
  }, [locations])

  // Create custom icon
  const createIcon = (color: string, label?: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 12px;
            font-weight: bold;
          ">${label || ''}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    })

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update markers and polylines when locations change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers and polylines
    markersRef.current.forEach((m) => m.remove())
    polylinesRef.current.forEach((p) => p.remove())
    markersRef.current = []
    polylinesRef.current = []

    if (locations.length === 0) {
      map.setView([40, -95], 4) // Default view (US center)
      return
    }

    // Add markers
    const bounds = L.latLngBounds([])

    // Sort day locations by day number for polyline
    const dayLocations = locations
      .filter((l) => l.type === 'day')
      .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))

    locations.forEach((location) => {
      const { lat, lng } = location.coordinates
      bounds.extend([lat, lng])

      const label = location.type === 'day' ? String(location.dayNumber || '') : ''
      const marker = L.marker([lat, lng], {
        icon: createIcon(location.color, label),
      })
        .addTo(map)
        .on('click', () => {
          setSelectedLocation(location)
          onLocationSelect?.(location)
        })

      // Add popup
      marker.bindPopup(`
        <div style="min-width: 120px;">
          <strong>${location.name}</strong>
          ${location.details ? `<br/><span style="font-size: 12px; color: #666;">${location.details}</span>` : ''}
        </div>
      `)

      markersRef.current.push(marker)
    })

    // Add polyline connecting day locations
    if (dayLocations.length > 1) {
      const latLngs = dayLocations.map((l) => [l.coordinates.lat, l.coordinates.lng] as [number, number])
      const polyline = L.polyline(latLngs, {
        color: '#6b7280',
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10',
      }).addTo(map)
      polylinesRef.current.push(polyline)
    }

    // Fit bounds with padding
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, onLocationSelect])

  const handleCloseDetail = () => {
    setSelectedLocation(null)
    onLocationSelect?.(null)
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: '400px' }} />

      {/* Legend */}
      <div className="absolute top-3 right-3 bg-white rounded-lg shadow-md p-3 z-[1000]">
        <p className="text-xs font-medium text-gray-700 mb-2">Legend</p>
        <div className="space-y-1">
          {Object.entries(locationsByType).map(([type, locs]) => {
            const colors = Array.from(new Set(locs.map((l) => l.color)))
            return (
              <div key={type} className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {colors.slice(0, 3).map((color, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full border border-white"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-600 capitalize">
                  {type === 'day' ? 'Itinerary Days' : type}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selection Detail Panel */}
      {selectedLocation && (
        <div className="absolute bottom-3 left-3 right-3 bg-white rounded-lg shadow-lg p-4 z-[1000]">
          <button
            onClick={handleCloseDetail}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${selectedLocation.color}20` }}
            >
              {selectedLocation.type === 'day' ? (
                <span className="font-bold" style={{ color: selectedLocation.color }}>
                  {selectedLocation.dayNumber}
                </span>
              ) : (
                <MapPin className="w-5 h-5" style={{ color: selectedLocation.color }} />
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{selectedLocation.name}</h4>
              {selectedLocation.details && (
                <p className="text-sm text-gray-500 mt-0.5">{selectedLocation.details}</p>
              )}
              <p className="text-xs text-gray-400 mt-1 capitalize">
                {selectedLocation.type === 'day' ? 'Day Stop' : selectedLocation.type}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
