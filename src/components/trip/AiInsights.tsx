'use client'

import { useState } from 'react'
import {
  Loader2,
  Sparkles,
  Scale,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lightbulb,
  AlertCircle,
} from 'lucide-react'
import type { Database } from '@/lib/database.types'

type PlanVersion = Database['public']['Tables']['plan_versions']['Row']
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']
type Accommodation = Database['public']['Tables']['accommodations']['Row']
type Transport = Database['public']['Tables']['transport']['Row']
type Cost = Database['public']['Tables']['costs']['Row']
type Decision = Database['public']['Tables']['decisions']['Row']

interface AiInsightsProps {
  tripId: string
  plans: PlanVersion[]
  activePlanId: string
  days: ItineraryDay[]
  accommodations: Accommodation[]
  transport: Transport[]
  costs: Cost[]
  decisions: Decision[]
}

type Tab = 'suggestions' | 'compare' | 'optimise'

interface InsightResult {
  content: string
  cached?: boolean
  error?: string
}

const SUGGESTION_PROMPTS = [
  'What activities am I missing based on popular recommendations?',
  'Are there any scheduling conflicts in my itinerary?',
  'What are the best dining options near my accommodations?',
  'Suggest improvements to my route to minimize travel time',
  'What weather considerations should I plan for?',
]

export function AiInsights({
  tripId,
  plans,
  activePlanId,
  days,
  accommodations,
  transport,
  costs,
  decisions,
}: AiInsightsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('suggestions')
  const [expanded, setExpanded] = useState(true)

  // Suggestions state
  const [suggestionPrompt, setSuggestionPrompt] = useState('')
  const [suggestionResult, setSuggestionResult] = useState<InsightResult | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)

  // Compare state
  const [compareResult, setCompareResult] = useState<InsightResult | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // Optimise state
  const [optimiseResult, setOptimiseResult] = useState<InsightResult | null>(null)
  const [optimiseLoading, setOptimiseLoading] = useState(false)

  const activePlan = plans.find((p) => p.id === activePlanId)

  const fetchSuggestion = async (prompt: string) => {
    if (!prompt.trim()) return

    setSuggestionLoading(true)
    setSuggestionResult(null)

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          plan_version_id: activePlanId,
          prompt,
          context: {
            days: days.map((d) => ({ day_number: d.day_number, location: d.location, activities: d.activities })),
            accommodations: accommodations.map((a) => ({ name: a.name, location: a.location, check_in: a.check_in })),
            transport: transport.map((t) => ({ type: t.type, provider: t.provider })),
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to get suggestions')

      const data = await res.json()
      setSuggestionResult({
        content: data.response,
        cached: data.cached,
      })
    } catch (err) {
      console.error('Suggestion error:', err)
      setSuggestionResult({
        content: '',
        error: 'Failed to get suggestions. Please try again.',
      })
    } finally {
      setSuggestionLoading(false)
    }
  }

  const fetchComparison = async () => {
    if (plans.length < 2) {
      setCompareResult({
        content: '',
        error: 'You need at least 2 plan versions to compare.',
      })
      return
    }

    setCompareLoading(true)
    setCompareResult(null)

    try {
      const res = await fetch('/api/ai/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
        }),
      })

      if (!res.ok) throw new Error('Failed to compare plans')

      const data = await res.json()
      setCompareResult({
        content: data.response,
        cached: data.cached,
      })
    } catch (err) {
      console.error('Compare error:', err)
      setCompareResult({
        content: '',
        error: 'Failed to compare plans. Please try again.',
      })
    } finally {
      setCompareLoading(false)
    }
  }

  const fetchOptimisation = async () => {
    setOptimiseLoading(true)
    setOptimiseResult(null)

    try {
      const res = await fetch('/api/ai/optimise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          plan_version_id: activePlanId,
          costs: costs.map((c) => ({ category: c.category, item: c.item, amount: c.amount })),
          accommodations: accommodations.map((a) => ({ name: a.name, cost: a.cost, nights: a.nights })),
          transport: transport.map((t) => ({ type: t.type, cost: t.cost })),
        }),
      })

      if (!res.ok) throw new Error('Failed to get optimization tips')

      const data = await res.json()
      setOptimiseResult({
        content: data.response,
        cached: data.cached,
      })
    } catch (err) {
      console.error('Optimise error:', err)
      setOptimiseResult({
        content: '',
        error: 'Failed to get optimization tips. Please try again.',
      })
    } finally {
      setOptimiseLoading(false)
    }
  }

  const totalCost = activePlan?.total_cost || costs.reduce((sum, c) => sum + c.amount, 0)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare Plans', icon: <Scale className="w-4 h-4" /> },
    { id: 'optimise', label: 'Optimise Costs', icon: <TrendingDown className="w-4 h-4" /> },
  ]

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-gray-900">AI Insights</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t">
          {/* Tabs */}
          <div className="flex border-b">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Get AI-powered suggestions to improve your trip
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SUGGESTION_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setSuggestionPrompt(prompt)
                          fetchSuggestion(prompt)
                        }}
                        disabled={suggestionLoading}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={suggestionPrompt}
                      onChange={(e) => setSuggestionPrompt(e.target.value)}
                      placeholder="Ask a custom question..."
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && suggestionPrompt.trim()) {
                          fetchSuggestion(suggestionPrompt)
                        }
                      }}
                    />
                    <button
                      onClick={() => fetchSuggestion(suggestionPrompt)}
                      disabled={suggestionLoading || !suggestionPrompt.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {suggestionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Ask
                    </button>
                  </div>
                </div>

                {suggestionResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      suggestionResult.error ? 'bg-red-50' : 'bg-purple-50'
                    }`}
                  >
                    {suggestionResult.error ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        {suggestionResult.error}
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-800 whitespace-pre-wrap">
                          {suggestionResult.content}
                        </p>
                        {suggestionResult.cached && (
                          <span className="inline-block mt-2 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            Cached result
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Compare Tab */}
            {activeTab === 'compare' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Compare your plan versions to find the best option
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {plans.length} plan{plans.length !== 1 ? 's' : ''} available
                    </p>
                  </div>
                  <button
                    onClick={fetchComparison}
                    disabled={compareLoading || plans.length < 2}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {compareLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : compareResult ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <Scale className="w-4 h-4" />
                    )}
                    {compareResult ? 'Refresh' : 'Analyse Plans'}
                  </button>
                </div>

                {/* Plan List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`p-3 rounded-lg border ${
                        plan.id === activePlanId
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: plan.color }}
                        />
                        <span className="font-medium text-gray-900">{plan.name}</span>
                        {plan.id === activePlanId && (
                          <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        ${plan.total_cost.toLocaleString()} {plan.currency}
                      </p>
                    </div>
                  ))}
                </div>

                {compareResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      compareResult.error ? 'bg-red-50' : 'bg-purple-50'
                    }`}
                  >
                    {compareResult.error ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        {compareResult.error}
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-800 whitespace-pre-wrap">
                          {compareResult.content}
                        </p>
                        {compareResult.cached && (
                          <span className="inline-block mt-2 text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                            Cached result
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optimise Tab */}
            {activeTab === 'optimise' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Get tips to reduce costs without compromising your trip
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Current total: ${totalCost.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={fetchOptimisation}
                    disabled={optimiseLoading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {optimiseLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : optimiseResult ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {optimiseResult ? 'Refresh' : 'Get Tips'}
                  </button>
                </div>

                {/* Cost Breakdown Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Accommodation</p>
                    <p className="text-lg font-semibold">
                      ${accommodations.reduce((sum, a) => sum + (a.cost || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Transport</p>
                    <p className="text-lg font-semibold">
                      ${transport.reduce((sum, t) => sum + (t.cost || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Activities</p>
                    <p className="text-lg font-semibold">
                      ${costs.filter((c) => c.category === 'activities').reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Other</p>
                    <p className="text-lg font-semibold">
                      ${costs.filter((c) => c.category !== 'activities').reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {optimiseResult && (
                  <div
                    className={`p-4 rounded-lg ${
                      optimiseResult.error ? 'bg-red-50' : 'bg-green-50'
                    }`}
                  >
                    {optimiseResult.error ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        {optimiseResult.error}
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-800 whitespace-pre-wrap">
                          {optimiseResult.content}
                        </p>
                        {optimiseResult.cached && (
                          <span className="inline-block mt-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            Cached result
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Pending Decisions */}
                {decisions.filter((d) => d.status === 'pending').length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      Pending Decisions ({decisions.filter((d) => d.status === 'pending').length})
                    </h4>
                    <p className="text-sm text-yellow-700">
                      Resolve pending decisions to get more accurate cost optimization tips.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
