'use client'

import { useState, useRef, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Edit2,
  Link2,
  Loader2,
  Send,
  Check,
  Trash2,
  AlertTriangle,
  Bot,
  User,
  ExternalLink,
  MapPin,
  Calendar,
  DollarSign,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']
type Accommodation = Database['public']['Tables']['accommodations']['Row']
type Transport = Database['public']['Tables']['transport']['Row']
type Cost = Database['public']['Tables']['costs']['Row']

type ItemType = 'accommodation' | 'transport' | 'cost' | 'itinerary_day'
type Mode = 'actions' | 'chat' | 'edit' | 'link'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  options?: SuggestionOption[]
}

interface SuggestionOption {
  id: string
  name: string
  description?: string
  cost?: number
  data: Record<string, unknown>
}

interface ChangeSheetProps {
  isOpen: boolean
  onClose: () => void
  onApplied: () => void
  tripId: string
  planVersionId: string
  currencySymbol: string
  destination?: string | null
  itemType: ItemType
  existingItem?: Accommodation | Transport | Cost | ItineraryDay | null
  allDays?: ItineraryDay[]
}

export function ChangeSheet({
  isOpen,
  onClose,
  onApplied,
  tripId,
  planVersionId,
  currencySymbol,
  destination,
  itemType,
  existingItem,
  allDays,
}: ChangeSheetProps) {
  const [mode, setMode] = useState<Mode>('actions')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [linkUrl, setLinkUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null)
  const [applying, setApplying] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize form when item changes
  useEffect(() => {
    if (existingItem) {
      setEditForm({ ...existingItem })
    } else {
      setEditForm(getDefaultFormData())
    }
  }, [existingItem, itemType])

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('actions')
      setMessages([])
      setChatInput('')
      setLinkUrl('')
      setExtractedData(null)
      setConfirmRemove(false)
      setError(null)
    }
  }, [isOpen])

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getDefaultFormData = (): Record<string, unknown> => {
    const today = new Date().toISOString().split('T')[0]

    switch (itemType) {
      case 'accommodation':
        return {
          plan_version_id: planVersionId,
          name: '',
          type: 'hotel',
          location: destination || '',
          address: '',
          check_in: today,
          check_out: today,
          cost: 0,
          currency: currencySymbol === '$' ? 'USD' : 'GBP',
          booking_reference: '',
          booking_url: '',
          notes: '',
          is_confirmed: false,
        }
      case 'transport':
        return {
          plan_version_id: planVersionId,
          type: 'car_rental',
          provider: '',
          vehicle: '',
          pickup_location: '',
          pickup_date: today,
          dropoff_location: '',
          dropoff_date: today,
          cost: 0,
          currency: currencySymbol === '$' ? 'USD' : 'GBP',
          booking_url: '',
          notes: '',
          is_confirmed: false,
        }
      case 'cost':
        return {
          plan_version_id: planVersionId,
          category: 'other',
          item: '',
          amount: 0,
          currency: currencySymbol === '$' ? 'USD' : 'GBP',
          is_paid: false,
          is_estimated: true,
          notes: '',
        }
      case 'itinerary_day':
        return {
          plan_version_id: planVersionId,
          day_number: (allDays?.length || 0) + 1,
          date: today,
          location: destination || '',
          icon: '📍',
          color: '#3b82f6',
          activities: [],
          notes: '',
        }
      default:
        return {}
    }
  }

  const getItemTypeName = () => {
    switch (itemType) {
      case 'accommodation':
        return 'Accommodation'
      case 'transport':
        return 'Transport'
      case 'cost':
        return 'Cost'
      case 'itinerary_day':
        return 'Day'
      default:
        return 'Item'
    }
  }

  const getApiEndpoint = () => {
    switch (itemType) {
      case 'accommodation':
        return '/api/accommodations'
      case 'transport':
        return '/api/transport'
      case 'cost':
        return '/api/costs'
      case 'itinerary_day':
        return '/api/itinerary-days'
      default:
        return ''
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: chatInput.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai/change-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          plan_version_id: planVersionId,
          item_type: itemType,
          existing_item: existingItem,
          destination,
          user_message: userMessage.content,
        }),
      })

      if (!res.ok) throw new Error('Failed to get suggestions')

      const data = await res.json()

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        options: data.options,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const applyOption = async (option: SuggestionOption) => {
    setApplying(true)
    setError(null)

    try {
      const endpoint = getApiEndpoint()
      const payload = {
        ...option.data,
        plan_version_id: planVersionId,
      }

      if (existingItem && 'id' in existingItem) {
        // Update existing
        const res = await fetch(`${endpoint}/${existingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        // Create new
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }

      onApplied()
      onClose()
    } catch (err) {
      console.error('Apply error:', err)
      setError('Failed to apply changes. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const extractFromLink = async () => {
    if (!linkUrl.trim()) return

    setExtracting(true)
    setExtractedData(null)
    setError(null)

    try {
      const res = await fetch('/api/ai/extract-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: linkUrl.trim(),
          item_type: itemType,
        }),
      })

      if (!res.ok) throw new Error('Failed to extract data')

      const data = await res.json()
      setExtractedData(data.extracted)
      setEditForm((prev) => ({ ...prev, ...data.extracted }))
    } catch (err) {
      console.error('Extract error:', err)
      setError('Failed to extract data from link. Please enter details manually.')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    setApplying(true)
    setError(null)

    try {
      const endpoint = getApiEndpoint()

      if (existingItem && 'id' in existingItem) {
        // Update existing
        const res = await fetch(`${endpoint}/${existingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        // Create new
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        })
        if (!res.ok) throw new Error('Failed to create')
      }

      onApplied()
      onClose()
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save changes. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const handleRemove = async () => {
    if (!existingItem || !('id' in existingItem)) return

    setApplying(true)
    setError(null)

    try {
      const endpoint = getApiEndpoint()
      const res = await fetch(`${endpoint}/${existingItem.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')

      onApplied()
      onClose()
    } catch (err) {
      console.error('Delete error:', err)
      setError('Failed to remove item. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium text-gray-900">
            {existingItem ? `Edit ${getItemTypeName()}` : `Add ${getItemTypeName()}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setMode('actions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'actions'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Actions
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              mode === 'chat'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              mode === 'edit'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            Manual
          </button>
          <button
            onClick={() => setMode('link')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              mode === 'link'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Link2 className="w-4 h-4" />
            From Link
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Actions Mode */}
          {mode === 'actions' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                {existingItem
                  ? `Modify or update this ${getItemTypeName().toLowerCase()}`
                  : `Add a new ${getItemTypeName().toLowerCase()} to your trip`}
              </p>

              <button
                onClick={() => setMode('chat')}
                className="w-full p-4 text-left bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Get AI Suggestions</p>
                    <p className="text-sm text-gray-500">
                      Chat with AI to find and compare options
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('edit')}
                className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Edit2 className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Edit Manually</p>
                    <p className="text-sm text-gray-500">
                      Fill in the details yourself
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('link')}
                className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Import from Link</p>
                    <p className="text-sm text-gray-500">
                      Paste a booking URL to auto-fill details
                    </p>
                  </div>
                </div>
              </button>

              {existingItem && (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="w-full p-4 text-left bg-red-50 hover:bg-red-100 rounded-lg transition-colors mt-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-red-700">Remove {getItemTypeName()}</p>
                      <p className="text-sm text-red-500">
                        Delete this item from your trip
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Chat Mode */}
          {mode === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 space-y-4 min-h-[300px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-2">
                      Ask me to suggest {getItemTypeName().toLowerCase()}s for your trip
                    </p>
                    <p className="text-sm text-gray-400">
                      e.g., &quot;Suggest a hotel near the beach&quot; or &quot;Find activities for kids&quot;
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>

                          {/* Suggestion Options */}
                          {message.options && message.options.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {message.options.map((option) => (
                                <div
                                  key={option.id}
                                  className="bg-white rounded-lg p-3 border shadow-sm"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">
                                        {option.name}
                                      </h4>
                                      {option.description && (
                                        <p className="text-sm text-gray-600 mt-1">
                                          {option.description}
                                        </p>
                                      )}
                                      {option.cost !== undefined && (
                                        <p className="text-sm text-gray-500 mt-1">
                                          {currencySymbol}{option.cost.toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => applyOption(option)}
                                      disabled={applying}
                                      className="ml-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {applying ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Check className="w-4 h-4" />
                                      )}
                                      Apply
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask for suggestions..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      sendChatMessage()
                    }
                  }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {mode === 'edit' && (
            <div className="space-y-4">
              {/* Accommodation Form */}
              {itemType === 'accommodation' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={(editForm.name as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Marriott Hotel"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={(editForm.type as string) || 'hotel'}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="hotel">Hotel</option>
                        <option value="resort">Resort</option>
                        <option value="airbnb">Airbnb</option>
                        <option value="hostel">Hostel</option>
                        <option value="motel">Motel</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cost ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={(editForm.cost as number) || ''}
                        onChange={(e) => setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={(editForm.location as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="City or area"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={(editForm.address as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="Full address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-in
                      </label>
                      <input
                        type="date"
                        value={(editForm.check_in as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, check_in: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-out
                      </label>
                      <input
                        type="date"
                        value={(editForm.check_out as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, check_out: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Booking Reference
                      </label>
                      <input
                        type="text"
                        value={(editForm.booking_reference as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, booking_reference: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., ABC123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Booking URL
                      </label>
                      <input
                        type="url"
                        value={(editForm.booking_url as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, booking_url: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={(editForm.notes as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_confirmed"
                      checked={(editForm.is_confirmed as boolean) || false}
                      onChange={(e) => setEditForm({ ...editForm, is_confirmed: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_confirmed" className="text-sm text-gray-700">
                      Confirmed booking
                    </label>
                  </div>
                </>
              )}

              {/* Transport Form */}
              {itemType === 'transport' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type *
                      </label>
                      <select
                        value={(editForm.type as string) || 'car_rental'}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="car_rental">Car Rental</option>
                        <option value="flight">Flight</option>
                        <option value="train">Train</option>
                        <option value="bus">Bus</option>
                        <option value="ferry">Ferry</option>
                        <option value="taxi">Taxi/Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Provider
                      </label>
                      <input
                        type="text"
                        value={(editForm.provider as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Hertz, United Airlines"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vehicle/Details
                    </label>
                    <input
                      type="text"
                      value={(editForm.vehicle as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, vehicle: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., SUV, Economy Class"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup Location
                      </label>
                      <input
                        type="text"
                        value={(editForm.pickup_location as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, pickup_location: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup Date
                      </label>
                      <input
                        type="date"
                        value={(editForm.pickup_date as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, pickup_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dropoff Location
                      </label>
                      <input
                        type="text"
                        value={(editForm.dropoff_location as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, dropoff_location: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dropoff Date
                      </label>
                      <input
                        type="date"
                        value={(editForm.dropoff_date as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, dropoff_date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cost ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={(editForm.cost as number) || ''}
                        onChange={(e) => setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        value={(editForm.reference_number as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={(editForm.notes as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}

              {/* Cost Form */}
              {itemType === 'cost' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={(editForm.item as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, item: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Theme Park Tickets"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={(editForm.category as string) || 'other'}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="accommodation">Accommodation</option>
                        <option value="transport">Transport</option>
                        <option value="food">Food & Dining</option>
                        <option value="activities">Activities</option>
                        <option value="tickets">Tickets & Attractions</option>
                        <option value="shopping">Shopping</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        value={(editForm.amount as number) || ''}
                        onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_paid"
                        checked={(editForm.is_paid as boolean) || false}
                        onChange={(e) => setEditForm({ ...editForm, is_paid: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="is_paid" className="text-sm text-gray-700">
                        Already paid
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_estimated"
                        checked={(editForm.is_estimated as boolean) || false}
                        onChange={(e) => setEditForm({ ...editForm, is_estimated: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="is_estimated" className="text-sm text-gray-700">
                        Estimated
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={(editForm.notes as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}

              {/* Itinerary Day Form */}
              {itemType === 'itinerary_day' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Day Number
                      </label>
                      <input
                        type="number"
                        value={(editForm.day_number as number) || 1}
                        onChange={(e) => setEditForm({ ...editForm, day_number: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={(editForm.date as string) || ''}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      value={(editForm.location as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="City or area"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Icon
                      </label>
                      <input
                        type="text"
                        value={(editForm.icon as string) || '📍'}
                        onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                        placeholder="Emoji icon"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        value={(editForm.color as string) || '#3b82f6'}
                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                        className="w-full h-10 px-1 py-1 border rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Drive Time
                    </label>
                    <input
                      type="text"
                      value={(editForm.drive_time as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, drive_time: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 2h 30m"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={(editForm.notes as string) || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Link Mode */}
          {mode === 'link' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Paste a booking link and we&apos;ll extract the details automatically
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://booking.com/..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={extractFromLink}
                  disabled={extracting || !linkUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {extracting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Extract
                </button>
              </div>

              {extractedData && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium mb-2">
                    Data extracted! Review and edit in the Manual tab.
                  </p>
                  <button
                    onClick={() => setMode('edit')}
                    className="text-sm text-green-600 hover:text-green-700 underline"
                  >
                    Go to Manual tab to review
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Confirm Remove Dialog */}
          {confirmRemove && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700 font-medium mb-3">
                Are you sure you want to remove this {getItemTypeName().toLowerCase()}?
              </p>
              <p className="text-xs text-red-600 mb-4">
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRemove}
                  disabled={applying}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {applying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Yes, Remove
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'edit' && !confirmRemove && (
          <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={applying}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {existingItem ? 'Update' : 'Create'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
