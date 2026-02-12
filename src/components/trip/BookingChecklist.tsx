'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
  DollarSign,
  FileText,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ChecklistItem = Database['public']['Tables']['checklist_items']['Row']
type Accommodation = Database['public']['Tables']['accommodations']['Row']
type Transport = Database['public']['Tables']['transport']['Row']
type Cost = Database['public']['Tables']['costs']['Row']
type BookingStatus = ChecklistItem['booking_status']
type PaymentType = ChecklistItem['payment_type']
type Category = ChecklistItem['category']

interface BookingChecklistProps {
  planVersionId: string
  planName: string
  currencySymbol: string
  accommodations: Accommodation[]
  transport: Transport[]
  costs: Cost[]
}

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'accommodation', label: 'Accommodation', color: '#3b82f6' },
  { value: 'transport', label: 'Transport', color: '#8b5cf6' },
  { value: 'activity', label: 'Activities', color: '#10b981' },
  { value: 'tickets', label: 'Tickets', color: '#f59e0b' },
  { value: 'other', label: 'Other', color: '#6b7280' },
]

const STATUS_CYCLE: BookingStatus[] = ['not_booked', 'booked', 'confirmed']
const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  not_booked: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Booked' },
  booked: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Booked' },
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' },
}

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'full', label: 'Full Payment' },
  { value: 'deposit', label: 'Deposit Required' },
  { value: 'on_arrival', label: 'Pay on Arrival' },
  { value: 'free', label: 'Free' },
]

interface FormData {
  category: Category
  name: string
  description: string
  booking_reference: string
  booking_url: string
  total_cost: string
  deposit_amount: string
  amount_paid: string
  payment_type: PaymentType
  payment_due_date: string
  notes: string
}

const emptyForm: FormData = {
  category: 'other',
  name: '',
  description: '',
  booking_reference: '',
  booking_url: '',
  total_cost: '',
  deposit_amount: '',
  amount_paid: '',
  payment_type: 'full',
  payment_due_date: '',
  notes: '',
}

export function BookingChecklist({
  planVersionId,
  planName,
  currencySymbol,
  accommodations,
  transport,
  costs,
}: BookingChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(
    new Set(CATEGORIES.map((c) => c.value))
  )
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/checklist?planVersionId=${planVersionId}`)
      if (!res.ok) throw new Error('Failed to load checklist')
      const data = await res.json()
      setItems(data)
    } catch (err) {
      console.error('Error loading checklist:', err)
    } finally {
      setLoading(false)
    }
  }, [planVersionId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const itemsByCategory = useMemo(() => {
    const grouped: Record<Category, ChecklistItem[]> = {
      accommodation: [],
      transport: [],
      activity: [],
      tickets: [],
      other: [],
    }
    for (const item of items) {
      grouped[item.category].push(item)
    }
    return grouped
  }, [items])

  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + i.total_cost, 0)
    const paid = items.reduce((sum, i) => sum + i.amount_paid, 0)
    const remaining = total - paid
    const bookedCount = items.filter((i) => i.booking_status !== 'not_booked').length
    return { total, paid, remaining, bookedCount, totalCount: items.length }
  }, [items])

  const toggleCategory = (category: Category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const toggleNotes = (itemId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const cycleStatus = async (item: ChecklistItem) => {
    const currentIndex = STATUS_CYCLE.indexOf(item.booking_status)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]

    try {
      const res = await fetch(`/api/checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, booking_status: nextStatus } : i
        )
      )
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
        category: form.category,
        name: form.name.trim(),
        description: form.description.trim() || null,
        booking_reference: form.booking_reference.trim() || null,
        booking_url: form.booking_url.trim() || null,
        total_cost: form.total_cost ? parseFloat(form.total_cost) : 0,
        deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : 0,
        amount_paid: form.amount_paid ? parseFloat(form.amount_paid) : 0,
        payment_type: form.payment_type,
        payment_due_date: form.payment_due_date || null,
        notes: form.notes.trim() || null,
      }

      if (editingId) {
        const res = await fetch(`/api/checklist/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update item')
        const updated = await res.json()
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)))
      } else {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create item')
        const created = await res.json()
        setItems((prev) => [...prev, created])
      }

      setForm(emptyForm)
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      console.error('Error saving item:', err)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id)
    setForm({
      category: item.category,
      name: item.name,
      description: item.description || '',
      booking_reference: item.booking_reference || '',
      booking_url: item.booking_url || '',
      total_cost: item.total_cost.toString(),
      deposit_amount: item.deposit_amount.toString(),
      amount_paid: item.amount_paid.toString(),
      payment_type: item.payment_type,
      payment_due_date: item.payment_due_date || '',
      notes: item.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    // Find the item to check if it's a manual entry
    const item = items.find((i) => i.id === id)
    if (!item) return

    try {
      const res = await fetch(`/api/checklist/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete item')
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Error deleting item:', err)
    }
  }

  const cancelForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
  }

  /**
   * CRITICAL: Seed from Plan - ADDITIVE ONLY
   * This function adds items from accommodations, transport, and costs to the checklist.
   * It NEVER deletes existing items - only adds new ones that don't already exist.
   */
  const seedFromPlan = async () => {
    setSeeding(true)
    let addedCount = 0

    try {
      // Get existing source_ids to avoid duplicates
      const existingSourceIds = new Set(
        items.filter((i) => i.source_id).map((i) => `${i.source_type}-${i.source_id}`)
      )

      const itemsToAdd: Partial<ChecklistItem>[] = []

      // Add accommodations that aren't already linked
      for (const acc of accommodations) {
        const key = `accommodation-${acc.id}`
        if (!existingSourceIds.has(key)) {
          itemsToAdd.push({
            plan_version_id: planVersionId,
            category: 'accommodation',
            name: acc.name,
            description: `${acc.type} - ${acc.nights} nights`,
            source_type: 'accommodation',
            source_id: acc.id,
            total_cost: acc.cost || 0,
            booking_status: acc.is_confirmed ? 'confirmed' : 'not_booked',
            booking_reference: acc.booking_reference,
            booking_url: acc.booking_url,
          })
        }
      }

      // Add transport that isn't already linked
      for (const t of transport) {
        const key = `transport-${t.id}`
        if (!existingSourceIds.has(key)) {
          itemsToAdd.push({
            plan_version_id: planVersionId,
            category: 'transport',
            name: `${t.type}${t.provider ? ` - ${t.provider}` : ''}`,
            description: t.vehicle || null,
            source_type: 'transport',
            source_id: t.id,
            total_cost: t.cost || 0,
            booking_status: t.is_confirmed ? 'confirmed' : 'not_booked',
            booking_reference: t.reference_number,
            booking_url: t.booking_url,
          })
        }
      }

      // Add costs that aren't already linked (activities/tickets)
      for (const cost of costs) {
        const key = `cost-${cost.id}`
        if (!existingSourceIds.has(key)) {
          const category: Category =
            cost.category === 'activities' ? 'activity' :
            cost.category === 'tickets' ? 'tickets' : 'other'

          itemsToAdd.push({
            plan_version_id: planVersionId,
            category,
            name: cost.item,
            source_type: 'cost',
            source_id: cost.id,
            total_cost: cost.amount,
            booking_status: cost.is_paid ? 'confirmed' : 'not_booked',
          })
        }
      }

      // Add items one by one (or could batch via API)
      for (const item of itemsToAdd) {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        if (res.ok) {
          const created = await res.json()
          setItems((prev) => [...prev, created])
          addedCount++
        }
      }

      if (addedCount > 0) {
        alert(`Added ${addedCount} item${addedCount === 1 ? '' : 's'} from plan`)
      } else {
        alert('No new items to add - checklist is up to date')
      }
    } catch (err) {
      console.error('Error seeding from plan:', err)
      alert('Error adding items from plan')
    } finally {
      setSeeding(false)
    }
  }

  /**
   * Sync from Plan - UPDATE existing linked items
   * This function updates existing checklist items that are linked to plan items.
   * It NEVER deletes items - only updates fields from the source.
   * It preserves user-entered data like amount_paid, notes, payment_due_date.
   */
  const syncFromPlan = async () => {
    setSyncing(true)
    let updatedCount = 0
    let addedCount = 0

    try {
      // Get existing source_ids to find items to update
      const existingSourceIds = new Set(
        items.filter((i) => i.source_id).map((i) => `${i.source_type}-${i.source_id}`)
      )

      // Build lookup map for existing items
      const itemsBySource = new Map<string, ChecklistItem>()
      for (const item of items) {
        if (item.source_id) {
          itemsBySource.set(`${item.source_type}-${item.source_id}`, item)
        }
      }

      const itemsToAdd: Partial<ChecklistItem>[] = []
      const itemsToUpdate: { id: string; updates: Partial<ChecklistItem> }[] = []

      // Process accommodations
      for (const acc of accommodations) {
        const key = `accommodation-${acc.id}`
        const existing = itemsBySource.get(key)

        if (existing) {
          // Check if update needed
          const newName = acc.name
          const newDesc = `${acc.type} - ${acc.nights} nights`
          const newCost = acc.cost || 0
          const newRef = acc.booking_reference
          const newUrl = acc.booking_url
          const newStatus = acc.is_confirmed ? 'confirmed' : existing.booking_status

          if (
            existing.name !== newName ||
            existing.description !== newDesc ||
            existing.total_cost !== newCost ||
            existing.booking_reference !== newRef ||
            existing.booking_url !== newUrl ||
            (acc.is_confirmed && existing.booking_status !== 'confirmed')
          ) {
            itemsToUpdate.push({
              id: existing.id,
              updates: {
                name: newName,
                description: newDesc,
                total_cost: newCost,
                booking_reference: newRef,
                booking_url: newUrl,
                booking_status: newStatus as BookingStatus,
              },
            })
          }
        } else {
          // New item to add
          itemsToAdd.push({
            plan_version_id: planVersionId,
            category: 'accommodation',
            name: acc.name,
            description: `${acc.type} - ${acc.nights} nights`,
            source_type: 'accommodation',
            source_id: acc.id,
            total_cost: acc.cost || 0,
            booking_status: acc.is_confirmed ? 'confirmed' : 'not_booked',
            booking_reference: acc.booking_reference,
            booking_url: acc.booking_url,
          })
        }
      }

      // Process transport
      for (const t of transport) {
        const key = `transport-${t.id}`
        const existing = itemsBySource.get(key)

        if (existing) {
          const newName = `${t.type}${t.provider ? ` - ${t.provider}` : ''}`
          const newDesc = t.vehicle || null
          const newCost = t.cost || 0
          const newRef = t.reference_number
          const newUrl = t.booking_url
          const newStatus = t.is_confirmed ? 'confirmed' : existing.booking_status

          if (
            existing.name !== newName ||
            existing.description !== newDesc ||
            existing.total_cost !== newCost ||
            existing.booking_reference !== newRef ||
            existing.booking_url !== newUrl ||
            (t.is_confirmed && existing.booking_status !== 'confirmed')
          ) {
            itemsToUpdate.push({
              id: existing.id,
              updates: {
                name: newName,
                description: newDesc,
                total_cost: newCost,
                booking_reference: newRef,
                booking_url: newUrl,
                booking_status: newStatus as BookingStatus,
              },
            })
          }
        } else {
          itemsToAdd.push({
            plan_version_id: planVersionId,
            category: 'transport',
            name: `${t.type}${t.provider ? ` - ${t.provider}` : ''}`,
            description: t.vehicle || null,
            source_type: 'transport',
            source_id: t.id,
            total_cost: t.cost || 0,
            booking_status: t.is_confirmed ? 'confirmed' : 'not_booked',
            booking_reference: t.reference_number,
            booking_url: t.booking_url,
          })
        }
      }

      // Process costs
      for (const cost of costs) {
        const key = `cost-${cost.id}`
        const existing = itemsBySource.get(key)

        if (existing) {
          const newName = cost.item
          const newCost = cost.amount
          const newStatus = cost.is_paid ? 'confirmed' : existing.booking_status

          if (
            existing.name !== newName ||
            existing.total_cost !== newCost ||
            (cost.is_paid && existing.booking_status !== 'confirmed')
          ) {
            itemsToUpdate.push({
              id: existing.id,
              updates: {
                name: newName,
                total_cost: newCost,
                booking_status: newStatus as BookingStatus,
              },
            })
          }
        } else {
          const category: Category =
            cost.category === 'activities' ? 'activity' :
            cost.category === 'tickets' ? 'tickets' : 'other'

          itemsToAdd.push({
            plan_version_id: planVersionId,
            category,
            name: cost.item,
            source_type: 'cost',
            source_id: cost.id,
            total_cost: cost.amount,
            booking_status: cost.is_paid ? 'confirmed' : 'not_booked',
          })
        }
      }

      // Apply updates
      for (const { id, updates } of itemsToUpdate) {
        const res = await fetch(`/api/checklist/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          const updated = await res.json()
          setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
          updatedCount++
        }
      }

      // Add new items
      for (const item of itemsToAdd) {
        const res = await fetch('/api/checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        if (res.ok) {
          const created = await res.json()
          setItems((prev) => [...prev, created])
          addedCount++
        }
      }

      if (updatedCount > 0 || addedCount > 0) {
        const parts = []
        if (updatedCount > 0) parts.push(`${updatedCount} updated`)
        if (addedCount > 0) parts.push(`${addedCount} added`)
        alert(`Sync complete: ${parts.join(', ')}`)
      } else {
        alert('Checklist is already in sync with plan')
      }
    } catch (err) {
      console.error('Error syncing from plan:', err)
      alert('Error syncing from plan')
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-gray-900">Booking Checklist</h3>
            <p className="text-sm text-gray-500">{planName}</p>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && items.some((i) => i.source_id) && (
              <button
                onClick={syncFromPlan}
                disabled={syncing}
                className="px-3 py-2 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
                title="Update existing items from plan changes"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync
              </button>
            )}
            <button
              onClick={seedFromPlan}
              disabled={seeding}
              className="px-3 py-2 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Seed from Plan
            </button>
            <button
              onClick={() => {
                setForm(emptyForm)
                setEditingId(null)
                setShowForm(true)
              }}
              className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Progress Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Items</p>
            <p className="text-2xl font-semibold text-gray-900">{totals.totalCount}</p>
            <p className="text-xs text-gray-500">
              {totals.bookedCount} booked/confirmed
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</p>
            <p className="text-2xl font-semibold text-gray-900">
              {currencySymbol}
              {totals.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 uppercase tracking-wide">Paid</p>
            <p className="text-2xl font-semibold text-green-700">
              {currencySymbol}
              {totals.paid.toLocaleString()}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-600 uppercase tracking-wide">Remaining</p>
            <p className="text-2xl font-semibold text-yellow-700">
              {currencySymbol}
              {totals.remaining.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium text-gray-900 mb-4">
            {editingId ? 'Edit Item' : 'Add New Item'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Hotel Booking"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Additional details..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking Reference
                </label>
                <input
                  type="text"
                  value={form.booking_reference}
                  onChange={(e) => setForm({ ...form, booking_reference: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ABC123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking URL
                </label>
                <input
                  type="url"
                  value={form.booking_url}
                  onChange={(e) => setForm({ ...form, booking_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={form.total_cost}
                  onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={form.deposit_amount}
                  onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Paid ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={form.amount_paid}
                  onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Type
                </label>
                <select
                  value={form.payment_type}
                  onChange={(e) => setForm({ ...form, payment_type: e.target.value as PaymentType })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={form.payment_due_date}
                  onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Any notes..."
                />
              </div>
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
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update' : 'Add'} Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items by Category */}
      {CATEGORIES.map((category) => {
        const categoryItems = itemsByCategory[category.value]
        if (categoryItems.length === 0) return null

        const isExpanded = expandedCategories.has(category.value)
        const categoryTotal = categoryItems.reduce((sum, i) => sum + i.total_cost, 0)
        const categoryPaid = categoryItems.reduce((sum, i) => sum + i.amount_paid, 0)

        return (
          <div key={category.value} className="bg-white rounded-lg border overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.value)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="font-medium text-gray-900">{category.label}</span>
                <span className="text-sm text-gray-500">({categoryItems.length})</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500">
                  {currencySymbol}
                  {categoryTotal.toLocaleString()}
                </span>
                {categoryPaid > 0 && (
                  <span className="text-green-600">
                    {currencySymbol}
                    {categoryPaid.toLocaleString()} paid
                  </span>
                )}
              </div>
            </button>

            {/* Category Items */}
            {isExpanded && (
              <div className="border-t divide-y">
                {categoryItems
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => {
                    const isManual = !item.source_id
                    const hasNotes = item.notes && item.notes.length > 0
                    const showingNotes = expandedNotes.has(item.id)

                    return (
                      <div key={item.id} className="p-4 hover:bg-gray-50 group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              <button
                                onClick={() => cycleStatus(item)}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  STATUS_STYLES[item.booking_status].bg
                                } ${STATUS_STYLES[item.booking_status].text}`}
                              >
                                {STATUS_STYLES[item.booking_status].label}
                              </button>
                              {isManual && (
                                <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                  Manual
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                              {item.booking_reference && (
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {item.booking_reference}
                                </span>
                              )}
                              {item.booking_url && (
                                <a
                                  href={item.booking_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Booking Link
                                </a>
                              )}
                              {item.payment_due_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Due: {formatDate(item.payment_due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Cost Display */}
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                {currencySymbol}
                                {item.total_cost.toLocaleString()}
                              </p>
                              {item.amount_paid > 0 && (
                                <p className="text-xs text-green-600">
                                  {currencySymbol}
                                  {item.amount_paid.toLocaleString()} paid
                                </p>
                              )}
                              {item.deposit_amount > 0 && item.amount_paid < item.deposit_amount && (
                                <p className="text-xs text-yellow-600">
                                  {currencySymbol}
                                  {item.deposit_amount.toLocaleString()} deposit
                                </p>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {hasNotes && (
                                <button
                                  onClick={() => toggleNotes(item.id)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Toggle notes"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {deleteConfirmId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(item.id)}
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
                                  onClick={() => setDeleteConfirmId(item.id)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Expanded Notes */}
                        {showingNotes && item.notes && (
                          <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
                            {item.notes}
                          </div>
                        )}
                        {/* Warning for manual items about to be deleted */}
                        {deleteConfirmId === item.id && isManual && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-red-700">
                                This is a manual entry with potentially irreplaceable data
                              </p>
                              <p className="text-red-600 mt-1">
                                Payment details, notes, and booking references will be permanently deleted.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )
      })}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-500 mb-4">
            Add items manually or use &quot;Seed from Plan&quot; to import from your itinerary
          </p>
          <button
            onClick={seedFromPlan}
            disabled={seeding}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Seed from Plan
          </button>
        </div>
      )}
    </div>
  )
}
