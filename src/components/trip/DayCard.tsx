'use client'

import { MapPin, Clock, Bed, DollarSign } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']
type Accommodation = Database['public']['Tables']['accommodations']['Row']

interface DayCardProps {
  day: ItineraryDay
  accommodation?: Accommodation
  currencySymbol?: string
  showActivities?: boolean
}

export function DayCard({
  day,
  accommodation,
  currencySymbol = '$',
  showActivities = false,
}: DayCardProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const activities = Array.isArray(day.activities)
    ? (day.activities as string[])
    : []

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${day.color}20` }}
          >
            {day.icon || '📍'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">
                Day {day.day_number}
              </span>
              {day.date && (
                <span className="text-xs text-gray-400">
                  {formatDate(day.date)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-900">
              <MapPin className="w-4 h-4" style={{ color: day.color }} />
              <span className="font-medium">{day.location}</span>
            </div>
          </div>
        </div>
        {day.drive_time && (
          <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            <Clock className="w-3 h-3" />
            {day.drive_time}
          </div>
        )}
      </div>

      {/* Activities */}
      {showActivities && activities.length > 0 && (
        <div className="space-y-1 pl-2">
          {activities.map((activity, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>{activity}</span>
            </div>
          ))}
        </div>
      )}

      {/* Accommodation */}
      {accommodation && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
          <Bed className="w-4 h-4 text-gray-400" />
          <span className="flex-1">{accommodation.name}</span>
          {accommodation.cost && (
            <span className="text-gray-500">
              {currencySymbol}
              {accommodation.cost.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {day.notes && (
        <p className="text-sm text-gray-500 italic">{day.notes}</p>
      )}
    </div>
  )
}
