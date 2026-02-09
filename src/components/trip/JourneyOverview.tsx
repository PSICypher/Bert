'use client'

import { useMemo } from 'react'
import { Home, MapPin } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']

interface JourneyOverviewProps {
  days: ItineraryDay[]
}

interface LocationGroup {
  location: string
  color: string
  nights: number
  dayNumbers: number[]
}

export function JourneyOverview({ days }: JourneyOverviewProps) {
  const locationGroups = useMemo(() => {
    if (!days.length) return []

    const groups: LocationGroup[] = []
    let currentGroup: LocationGroup | null = null

    const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number)

    for (const day of sortedDays) {
      if (!currentGroup || currentGroup.location !== day.location) {
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = {
          location: day.location,
          color: day.color || '#3b82f6',
          nights: 1,
          dayNumbers: [day.day_number],
        }
      } else {
        currentGroup.nights++
        currentGroup.dayNumbers.push(day.day_number)
      }
    }

    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }, [days])

  if (!days.length) {
    return (
      <div className="bg-white rounded-lg border p-4 text-center text-gray-500">
        No itinerary days yet
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-medium text-gray-900">Journey Overview</h3>
      </div>
      <div className="p-4 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {locationGroups.map((group, index) => (
            <div key={`${group.location}-${index}`} className="flex items-center">
              {/* Location Card */}
              <div
                className="flex flex-col items-center px-4 py-3 rounded-lg min-w-[100px]"
                style={{ backgroundColor: `${group.color}15` }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: group.color }}
                >
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <span className="font-medium text-sm text-gray-900 text-center">
                  {group.location}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  {group.nights} {group.nights === 1 ? 'night' : 'nights'}
                </span>
                <span className="text-xs text-gray-400 mt-0.5">
                  Day {group.dayNumbers[0]}
                  {group.dayNumbers.length > 1 && `-${group.dayNumbers[group.dayNumbers.length - 1]}`}
                </span>
              </div>

              {/* Connecting Line */}
              {index < locationGroups.length - 1 && (
                <div className="flex items-center px-1">
                  <div className="w-8 h-0.5 bg-gray-300" />
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-300" />
                </div>
              )}
            </div>
          ))}

          {/* Home Icon at End */}
          <div className="flex items-center">
            <div className="flex items-center px-1">
              <div className="w-8 h-0.5 bg-gray-300" />
              <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-300" />
            </div>
            <div className="flex flex-col items-center px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <Home className="w-5 h-5 text-gray-600" />
              </div>
              <span className="font-medium text-sm text-gray-600 mt-2">Home</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
