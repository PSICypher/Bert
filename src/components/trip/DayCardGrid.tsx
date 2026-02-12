'use client'

import { useState, useCallback, useMemo } from 'react'
import { MapPin, ChevronDown, Edit2, Bed, DollarSign, Car } from 'lucide-react'
import type { Database } from '@/lib/database.types'

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
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-500">
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
            className={`bg-white rounded-2xl border-2 transition-all duration-300 ${
              isExpanded
                ? 'col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 border-blue-400 shadow-xl shadow-blue-100/50'
                : 'border-gray-100 hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            {/* Card Header - Always Visible */}
            <div
              className="p-4 cursor-pointer transition-colors"
              onClick={() => toggleExpanded(day.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Larger emoji with gradient background */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${day.color}30, ${day.color}10)`,
                      boxShadow: `0 2px 8px ${day.color}20`,
                    }}
                  >
                    {day.icon || '📍'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        Day {day.day_number}
                      </span>
                      {day.date && (
                        <span className="text-sm text-gray-500">
                          {formatDate(day.date)}
                        </span>
                      )}
                    </div>
                    {/* Location with gradient text */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-4 h-4" style={{ color: day.color }} />
                      <span
                        className="font-semibold"
                        style={{
                          background: `linear-gradient(90deg, ${day.color}, ${day.color}99)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {day.location}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Enhanced drive time badge */}
                  {day.drive_time && (
                    <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Car className="w-3.5 h-3.5" />
                      <span className="font-medium">{day.drive_time}</span>
                    </div>
                  )}
                  {/* Expand indicator with animation */}
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Activities List - always visible when collapsed */}
              {!isExpanded && activities.length > 0 && (
                <div className="mt-3 space-y-1">
                  {activities.map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 mt-0.5">·</span>
                      <span>{activity}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Compact Info - when collapsed */}
              {!isExpanded && (
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                  {accommodation && (
                    <span className="flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5" />
                      {accommodation.name}
                    </span>
                  )}
                  {totalDayCost > 0 && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {currencySymbol}
                      {totalDayCost.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded Content with animation */}
            {isExpanded && (
              <div className="border-t animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Activities */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Activities</h4>
                      {onChangeDay && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onChangeDay(day)
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit Day
                        </button>
                      )}
                    </div>
                    {/* Show activities from day.activities array */}
                    {activities.length > 0 ? (
                      <div className="space-y-2">
                        {activities.map((activity, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-3"
                          >
                            <span
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: day.color }}
                            />
                            <span className="text-gray-700">{activity}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        No activities planned for this day
                      </p>
                    )}
                    {/* Drive time summary */}
                    {day.drive_time && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        <Car className="w-4 h-4" />
                        <span>~{day.drive_time} total driving</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Accommodation & Costs */}
                  <div className="space-y-4">
                    {/* Accommodation with enhanced styling */}
                    {accommodation && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Accommodation</h4>
                        <div
                          className="rounded-xl p-4 border"
                          style={{
                            backgroundColor: `${accommodation.color}08`,
                            borderColor: `${accommodation.color}30`,
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">🏨</span>
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
                            </div>
                            {accommodation.cost && (
                              <span className="font-bold text-gray-900">
                                {currencySymbol}
                                {accommodation.cost.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {accommodation.is_confirmed && (
                            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Day Costs */}
                    {dayCosts.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Costs</h4>
                        <div className="space-y-2">
                          {dayCosts.map((cost) => (
                            <div
                              key={cost.id}
                              className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: day.color }}
                                />
                                <span className="text-gray-900">{cost.item}</span>
                                <span className="text-gray-400 text-xs">
                                  {cost.category}
                                </span>
                              </div>
                              <span
                                className={`font-medium ${
                                  cost.is_paid ? 'text-green-600' : 'text-gray-700'
                                }`}
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
                          <div className="flex items-center justify-between font-semibold pt-2 border-t mt-2 text-gray-900">
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
                        <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">
                          {day.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Full-width edit button at bottom */}
                {onChangeDay && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onChangeDay(day)
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
                                 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <Edit2 className="w-4 h-4" />
                      Change this day
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
