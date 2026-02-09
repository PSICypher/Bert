'use client'

import { useState, useCallback, useMemo } from 'react'
import { MapPin, Clock, ChevronDown, ChevronUp, Edit2, Bed, DollarSign } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import { DayActivities } from './DayActivities'

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']
type Accommodation = Database['public']['Tables']['accommodations']['Row']
type Cost = Database['public']['Tables']['costs']['Row']

interface DayCardGridProps {
  days: ItineraryDay[]
  accommodations: Accommodation[]
  costs: Cost[]
  currencySymbol: string
  planVersionId: string
  onChangeDay?: (day: ItineraryDay) => void
}

export function DayCardGrid({
  days,
  accommodations,
  costs,
  currencySymbol,
  planVersionId,
  onChangeDay,
}: DayCardGridProps) {
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_number - b.day_number),
    [days]
  )

  const getAccommodationForDay = useCallback(
    (day: ItineraryDay) => {
      if (!day.date) return undefined
      const dayDate = new Date(day.date)
      return accommodations.find((acc) => {
        const checkIn = new Date(acc.check_in)
        const checkOut = new Date(acc.check_out)
        return dayDate >= checkIn && dayDate < checkOut
      })
    },
    [accommodations]
  )

  const getDayCosts = useCallback(
    (dayId: string) => costs.filter((c) => c.itinerary_day_id === dayId),
    [costs]
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const toggleExpanded = (dayId: string) => {
    setExpandedDayId((prev) => (prev === dayId ? null : dayId))
  }

  if (!days.length) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
        No itinerary days yet. Add your first day to get started.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sortedDays.map((day) => {
        const accommodation = getAccommodationForDay(day)
        const dayCosts = getDayCosts(day.id)
        const totalDayCost = dayCosts.reduce((sum, c) => sum + c.amount, 0)
        const isExpanded = expandedDayId === day.id
        const activities = Array.isArray(day.activities)
          ? (day.activities as string[])
          : []

        return (
          <div
            key={day.id}
            className={`bg-white rounded-lg border transition-all ${
              isExpanded
                ? 'col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4'
                : ''
            }`}
          >
            {/* Card Header - Always Visible */}
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleExpanded(day.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
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
                <div className="flex items-center gap-2">
                  {day.drive_time && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" />
                      {day.drive_time}
                    </div>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Compact Info */}
              {!isExpanded && (
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                  {activities.length > 0 && (
                    <span>
                      {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                    </span>
                  )}
                  {accommodation && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-3 h-3" />
                      {accommodation.name}
                    </span>
                  )}
                  {totalDayCost > 0 && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {currencySymbol}
                      {totalDayCost.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t">
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Activities */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Activities</h4>
                      {onChangeDay && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onChangeDay(day)
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit Day
                        </button>
                      )}
                    </div>
                    <DayActivities
                      planVersionId={planVersionId}
                      dayId={day.id}
                      dayLocation={day.location}
                      currencySymbol={currencySymbol}
                    />
                  </div>

                  {/* Right Column - Accommodation & Costs */}
                  <div className="space-y-4">
                    {/* Accommodation */}
                    {accommodation && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Accommodation</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {accommodation.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {accommodation.type} • {accommodation.nights}{' '}
                                {accommodation.nights === 1 ? 'night' : 'nights'}
                              </p>
                              {accommodation.address && (
                                <p className="text-sm text-gray-400 mt-1">
                                  {accommodation.address}
                                </p>
                              )}
                            </div>
                            {accommodation.cost && (
                              <span className="font-medium text-gray-900">
                                {currencySymbol}
                                {accommodation.cost.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {accommodation.is_confirmed && (
                            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Day Costs */}
                    {dayCosts.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Costs</h4>
                        <div className="space-y-2">
                          {dayCosts.map((cost) => (
                            <div
                              key={cost.id}
                              className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                            >
                              <div>
                                <span className="text-gray-900">{cost.item}</span>
                                <span className="text-gray-400 text-xs ml-2">
                                  {cost.category}
                                </span>
                              </div>
                              <span
                                className={
                                  cost.is_paid ? 'text-green-600' : 'text-gray-700'
                                }
                              >
                                {currencySymbol}
                                {cost.amount.toLocaleString()}
                                {cost.is_estimated && (
                                  <span className="text-gray-400 text-xs ml-1">
                                    (est)
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between font-medium pt-2 border-t mt-2">
                            <span>Total</span>
                            <span>
                              {currencySymbol}
                              {totalDayCost.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {day.notes && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                          {day.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
