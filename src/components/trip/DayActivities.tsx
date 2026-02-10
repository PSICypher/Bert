'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  DollarSign,
  GripVertical,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Activity = Database['public']['Tables']['activities']['Row']
type BookingStatus = Activity['booking_status']

interface DayActivitiesProps {
  planVersionId: string
  dayId: string
  dayLocation: string
  currencySymbol: string
  onActivitiesChanged?: () => void
}

const STATUS_CYCLE: BookingStatus[] = ['not_booked', 'booked', 'confirmed']
const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  not_booked: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Booked' },
  booked: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Booked' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
}

interface ActivityFormData {
  name: string
  description: string
  time_start: string
  time_end: string
  location: string
  cost: string
  notes: string
}

const emptyForm: ActivityFormData = {
  name: '',
  description: '',
  time_start: '',
  time_end: '',
  location: '',
  cost: '',
  notes: '',
}

export function DayActivities({
  planVersionId,
  dayId,
  dayLocation,
  currencySymbol,
  onActivitiesChanged,
}: DayActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ActivityFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/activities?plan_version_id=${planVersionId}&itinerary_day_id=${dayId}`
      )
      if (!res.ok) throw new Error('Failed to load activities')
      const data = await res.json()
      setActivities(data)
    } catch (err) {
      console.error('Error loading activities:', err)
    } finally {
      setLoading(false)
    }
  }, [planVersionId, dayId])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const cycleStatus = async (activity: Activity) => {
    const currentIndex = STATUS_CYCLE.indexOf(activity.booking_status as BookingStatus)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')

      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id ? { ...a, booking_status: nextStatus } : a
        )
      )
      onActivitiesChanged?.()
    } catch (err) {
      console.error('Error cycling status:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return

    setSaving(true)
    try {
      const payload = {
        plan_version_id: planVersionId,
        itinerary_day_id: dayId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        time_start: form.time_start || null,
        time_end: form.time_end || null,
        location: form.location.trim() || dayLocation,
        cost: form.cost ? parseFloat(form.cost) : null,
        notes: form.notes.trim() || null,
      }

      if (editingId) {
        const res = await fetch(`/api/activities/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update activity')
        const updated = await res.json()
        setActivities((prev) =>
          prev.map((a) => (a.id === editingId ? updated : a))
        )
      } else {
        const res = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create activity')
        const created = await res.json()
        setActivities((prev) => [...prev, created])
      }

      setForm(emptyForm)
      setShowAdd(false)
      setEditingId(null)
      onActivitiesChanged?.()
    } catch (err) {
      console.error('Error saving activity:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id)
    setForm({
      name: activity.name,
      description: activity.description || '',
      time_start: activity.time_start || '',
      time_end: activity.time_end || '',
      location: activity.location || '',
      cost: activity.cost?.toString() || '',
      notes: activity.notes || '',
    })
    setShowAdd(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete activity')
      setActivities((prev) => prev.filter((a) => a.id !== id))
      setDeleteConfirmId(null)
      onActivitiesChanged?.()
    } catch (err) {
      console.error('Error deleting activity:', err)
    }
  }

  const cancelForm = () => {
    setForm(emptyForm)
    setShowAdd(false)
    setEditingId(null)
  }

  const totalCost = activities.reduce((sum, a) => sum + (a.cost || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Activity List */}
      {activities.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No activities planned for this day
        </p>
      ) : (
        <div className="space-y-2">
          {activities
            .sort((a, b) => {
              if (!a.time_start && !b.time_start) return a.sort_order - b.sort_order
              if (!a.time_start) return 1
              if (!b.time_start) return -1
              return a.time_start.localeCompare(b.time_start)
            })
            .map((activity) => (
              <div
                key={activity.id}
                className="group bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {activity.name}
                          </span>
                          <button
                            onClick={() => cycleStatus(activity)}
                            className={`text-xs px-2 py-0.5 rounded ${
                              STATUS_STYLES[activity.booking_status].bg
                            } ${STATUS_STYLES[activity.booking_status].text}`}
                          >
                            {STATUS_STYLES[activity.booking_status].label}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          {(activity.time_start || activity.time_end) && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {activity.time_start}
                              {activity.time_end && ` - ${activity.time_end}`}
                            </span>
                          )}
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {activity.location}
                            </span>
                          )}
                          {activity.cost !== null && activity.cost > 0 && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {currencySymbol}
                              {activity.cost.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(activity)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === activity.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(activity.id)}
                              className="p-1 text-red-600 hover:text-red-700"
                              title="Confirm delete"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(activity.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAdd ? (
        <form onSubmit={handleSubmit} className="bg-blue-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Activity Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Visit Everglades National Park"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={form.time_start}
                onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={form.time_end}
                onChange={(e) => setForm({ ...form, time_end: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={dayLocation}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost ({currencySymbol})
              </label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? 'Update' : 'Add'} Activity
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      )}

      {/* Total Cost */}
      {totalCost > 0 && (
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-gray-500">Activities Total</span>
          <span className="font-medium">
            {currencySymbol}
            {totalCost.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
