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

export interface TransportSegment {
  id: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  fromName: string
  toName: string
  type: string // 'boat', 'ferry', 'cruise', etc.
}

interface TripMapInnerProps {
  locations: TripMapLocation[]
  transportSegments?: TransportSegment[]
  onLocationSelect?: (location: TripMapLocation | null) => void
  className?: string
  showRouteOverlay?: boolean
}

// Create an SVG arrow marker for route direction
function createArrowIcon(angle: number) {
  return L.divIcon({
    className: 'route-arrow',
    html: `<div style="
      transform: rotate(${angle}deg);
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L10 6M10 6L7 3M10 6L7 9" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })
}

// Calculate bearing between two points
function bearing(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLon = toRad(to[1] - from[1])
  const lat1 = toRad(from[0])
  const lat2 = toRad(to[0])
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function TripMapInner({
  locations,
  transportSegments = [],
  onLocationSelect,
  className = '',
  showRouteOverlay = false,
}: TripMapInnerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylinesRef = useRef<L.Polyline[]>([])
  const arrowsRef = useRef<L.Marker[]>([])
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

    // Use a cleaner tile layer for route overlay mode
    if (showRouteOverlay) {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map)
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [showRouteOverlay])

  // Update markers and polylines when locations change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear existing markers, polylines, and arrows
    markersRef.current.forEach((m) => m.remove())
    polylinesRef.current.forEach((p) => p.remove())
    arrowsRef.current.forEach((a) => a.remove())
    markersRef.current = []
    polylinesRef.current = []
    arrowsRef.current = []

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

    // Route overlay mode: prominent colored route with direction arrows
    if (showRouteOverlay && dayLocations.length > 1) {
      const latLngs = dayLocations.map(
        (l) => [l.coordinates.lat, l.coordinates.lng] as [number, number]
      )

      // Shadow line for depth
      const shadow = L.polyline(latLngs, {
        color: '#312e81',
        weight: 7,
        opacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      polylinesRef.current.push(shadow)

      // Main route line
      const route = L.polyline(latLngs, {
        color: '#4f46e5',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      polylinesRef.current.push(route)

      // Add direction arrows at segment midpoints
      for (let i = 0; i < latLngs.length - 1; i++) {
        const from = latLngs[i]
        const to = latLngs[i + 1]
        const midLat = (from[0] + to[0]) / 2
        const midLng = (from[1] + to[1]) / 2
        const angle = bearing(from, to)
        const arrow = L.marker([midLat, midLng], {
          icon: createArrowIcon(angle),
          interactive: false,
        }).addTo(map)
        arrowsRef.current.push(arrow)
      }
    } else if (dayLocations.length > 1) {
      // Default mode: simple dashed line
      const latLngs = dayLocations.map(
        (l) => [l.coordinates.lat, l.coordinates.lng] as [number, number]
      )
      const polyline = L.polyline(latLngs, {
        color: '#6b7280',
        weight: 2,
        opacity: 0.6,
        dashArray: '5, 10',
      }).addTo(map)
      polylinesRef.current.push(polyline)
    }

    // Draw transport segments (boat/ferry/cruise as dashed blue lines)
    for (const seg of transportSegments) {
      const segLatLngs: [number, number][] = [
        [seg.from.lat, seg.from.lng],
        [seg.to.lat, seg.to.lng],
      ]
      bounds.extend(segLatLngs[0])
      bounds.extend(segLatLngs[1])

      const transportLine = L.polyline(segLatLngs, {
        color: '#2563eb',
        weight: 3,
        opacity: 0.8,
        dashArray: '8, 8',
      }).addTo(map)
      transportLine.bindPopup(
        `<strong>${seg.type.charAt(0).toUpperCase() + seg.type.slice(1)}</strong><br/>${seg.fromName} → ${seg.toName}`
      )
      polylinesRef.current.push(transportLine)

      // Arrow at midpoint
      const mid: [number, number] = [
        (segLatLngs[0][0] + segLatLngs[1][0]) / 2,
        (segLatLngs[0][1] + segLatLngs[1][1]) / 2,
      ]
      const angle = bearing(segLatLngs[0], segLatLngs[1])
      const arrow = L.marker(mid, {
        icon: createArrowIcon(angle),
        interactive: false,
      }).addTo(map)
      arrowsRef.current.push(arrow)
    }

    // Fit bounds with padding
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, transportSegments, onLocationSelect, showRouteOverlay])

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
          {transportSegments.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-6 border-t-2 border-dashed border-blue-600" />
              <span className="text-xs text-gray-600">Boat / Ferry</span>
            </div>
          )}
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
