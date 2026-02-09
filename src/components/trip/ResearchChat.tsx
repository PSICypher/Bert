'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Loader2,
  Plus,
  Check,
  Bot,
  User,
  Hotel,
  Plane,
  Utensils,
  MapPin,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from 'lucide-react'

type ResearchType = 'general' | 'hotel' | 'activity' | 'restaurant' | 'transport'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  queryType?: ResearchType
  suggestions?: Suggestion[]
  cached?: boolean
  timestamp: Date
}

interface Suggestion {
  id: string
  name: string
  description?: string
  pros?: string[]
  cons?: string[]
  cost?: string
  location?: string
  rating?: string
  type: 'accommodation' | 'activity' | 'restaurant' | 'transport'
}

interface ResearchChatProps {
  tripId: string
  planVersionId: string | null
  destination?: string | null
}

const QUERY_TYPES: { value: ResearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'general', label: 'General', icon: <HelpCircle className="w-4 h-4" /> },
  { value: 'hotel', label: 'Hotels', icon: <Hotel className="w-4 h-4" /> },
  { value: 'activity', label: 'Activities', icon: <MapPin className="w-4 h-4" /> },
  { value: 'restaurant', label: 'Restaurants', icon: <Utensils className="w-4 h-4" /> },
  { value: 'transport', label: 'Transport', icon: <Plane className="w-4 h-4" /> },
]

const QUICK_PROMPTS: Record<ResearchType, string[]> = {
  general: [
    'What\'s the best time to visit?',
    'What should I know before going?',
    'What\'s the local currency?',
    'Any safety tips?',
  ],
  hotel: [
    'Best family-friendly hotels',
    'Beachfront accommodation options',
    'Budget hotels with good reviews',
    'Luxury resort recommendations',
  ],
  activity: [
    'Must-see attractions',
    'Best day trips',
    'Activities for kids',
    'Hidden gems to explore',
  ],
  restaurant: [
    'Best local cuisine spots',
    'Family-friendly restaurants',
    'Fine dining options',
    'Best breakfast places',
  ],
  transport: [
    'Getting from the airport',
    'Best way to get around',
    'Car rental tips',
    'Public transport options',
  ],
}

export function ResearchChat({
  tripId,
  planVersionId,
  destination,
}: ResearchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [queryType, setQueryType] = useState<ResearchType>('general')
  const [loading, setLoading] = useState(false)
  const [addingToPlan, setAddingToPlan] = useState<string | null>(null)
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      queryType,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          query: content.trim(),
          query_type: queryType,
          destination,
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      const data = await res.json()

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        suggestions: data.suggestions,
        cached: data.cached,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Research error:', err)
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const addToPlan = async (suggestion: Suggestion) => {
    if (!planVersionId) {
      alert('No plan selected. Please select a plan first.')
      return
    }

    setAddingToPlan(suggestion.id)

    try {
      // Determine which API to call based on suggestion type
      let endpoint = ''
      let payload: Record<string, unknown> = {}

      switch (suggestion.type) {
        case 'accommodation':
          endpoint = '/api/accommodations'
          payload = {
            plan_version_id: planVersionId,
            name: suggestion.name,
            type: 'hotel',
            location: suggestion.location || destination,
            notes: suggestion.description,
            check_in: new Date().toISOString().split('T')[0],
            check_out: new Date().toISOString().split('T')[0],
          }
          break
        case 'activity':
          endpoint = '/api/costs'
          payload = {
            plan_version_id: planVersionId,
            category: 'activities',
            item: suggestion.name,
            amount: 0,
            notes: suggestion.description,
          }
          break
        case 'restaurant':
          endpoint = '/api/costs'
          payload = {
            plan_version_id: planVersionId,
            category: 'food',
            item: suggestion.name,
            amount: 0,
            notes: suggestion.description,
          }
          break
        case 'transport':
          endpoint = '/api/transport'
          payload = {
            plan_version_id: planVersionId,
            type: 'other',
            provider: suggestion.name,
            notes: suggestion.description,
          }
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to add to plan')

      setAddedItems((prev) => new Set(Array.from(prev).concat(suggestion.id)))
    } catch (err) {
      console.error('Error adding to plan:', err)
      alert('Failed to add to plan. Please try again.')
    } finally {
      setAddingToPlan(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-medium text-gray-900">Research Assistant</h3>
          </div>
          {destination && (
            <span className="text-sm text-gray-500">
              Researching: {destination}
            </span>
          )}
        </div>

        {/* Query Type Selector */}
        <div className="flex flex-wrap gap-2">
          {QUERY_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setQueryType(type.value)}
              className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 transition-colors ${
                queryType === type.value
                  ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {type.icon}
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              Ask me anything about {destination || 'your trip'}!
            </p>
            {/* Quick Prompts */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Quick prompts
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS[queryType].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
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

                  {/* Cached indicator */}
                  {message.cached && (
                    <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                      Cached result
                    </span>
                  )}

                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-white rounded-lg p-3 border shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {suggestion.name}
                              </h4>
                              {suggestion.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {suggestion.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                {suggestion.rating && (
                                  <span>Rating: {suggestion.rating}</span>
                                )}
                                {suggestion.cost && (
                                  <span>Cost: {suggestion.cost}</span>
                                )}
                                {suggestion.location && (
                                  <span>{suggestion.location}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => addToPlan(suggestion)}
                              disabled={
                                addingToPlan === suggestion.id ||
                                addedItems.has(suggestion.id) ||
                                !planVersionId
                              }
                              className={`ml-3 px-3 py-1.5 text-sm rounded flex items-center gap-1 flex-shrink-0 ${
                                addedItems.has(suggestion.id)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              } disabled:opacity-50`}
                            >
                              {addingToPlan === suggestion.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : addedItems.has(suggestion.id) ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Add
                                </>
                              )}
                            </button>
                          </div>

                          {/* Pros/Cons */}
                          {(suggestion.pros?.length || suggestion.cons?.length) && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              {suggestion.pros && suggestion.pros.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 flex items-center gap-1 mb-1">
                                    <ThumbsUp className="w-3 h-3" /> Pros
                                  </p>
                                  <ul className="text-xs text-gray-600 space-y-0.5">
                                    {suggestion.pros.map((pro, i) => (
                                      <li key={i}>• {pro}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {suggestion.cons && suggestion.cons.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1">
                                    <ThumbsDown className="w-3 h-3" /> Cons
                                  </p>
                                  <ul className="text-xs text-gray-600 space-y-0.5">
                                    {suggestion.cons.map((con, i) => (
                                      <li key={i}>• {con}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
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
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Researching...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask about ${QUERY_TYPES.find((t) => t.value === queryType)?.label.toLowerCase()}...`}
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
