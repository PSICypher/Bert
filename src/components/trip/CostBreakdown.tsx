'use client'

import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { PieChart as PieChartIcon, BarChart2, DollarSign } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type Cost = Database['public']['Tables']['costs']['Row']
type PlanVersion = Database['public']['Tables']['plan_versions']['Row']
type ItineraryDay = Database['public']['Tables']['itinerary_days']['Row']

interface CostBreakdownProps {
  costs: Cost[]
  plan: PlanVersion
  days: ItineraryDay[]
}

type ViewMode = 'donut' | 'bar'

const CATEGORY_COLORS: Record<string, string> = {
  accommodation: '#3b82f6',
  transport: '#8b5cf6',
  food: '#f59e0b',
  activities: '#10b981',
  tickets: '#ec4899',
  shopping: '#6366f1',
  other: '#6b7280',
}

const CATEGORY_LABELS: Record<string, string> = {
  accommodation: 'Accommodation',
  transport: 'Transport',
  food: 'Food & Dining',
  activities: 'Activities',
  tickets: 'Tickets',
  shopping: 'Shopping',
  other: 'Other',
}

export function CostBreakdown({ costs, plan, days }: CostBreakdownProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('donut')

  const currencySymbol = plan.currency === 'USD' ? '$' : plan.currency === 'GBP' ? '£' : '€'

  // Calculate totals by category
  const categoryData = useMemo(() => {
    const grouped: Record<string, { total: number; paid: number; count: number }> = {}

    for (const cost of costs) {
      const cat = cost.category
      if (!grouped[cat]) {
        grouped[cat] = { total: 0, paid: 0, count: 0 }
      }
      grouped[cat].total += cost.amount
      grouped[cat].paid += cost.is_paid ? cost.amount : 0
      grouped[cat].count++
    }

    return Object.entries(grouped)
      .map(([category, data]) => ({
        name: CATEGORY_LABELS[category] || category,
        category,
        value: data.total,
        paid: data.paid,
        unpaid: data.total - data.paid,
        count: data.count,
        color: CATEGORY_COLORS[category] || '#6b7280',
      }))
      .sort((a, b) => b.value - a.value)
  }, [costs])

  // Calculate costs per day
  const dailyData = useMemo(() => {
    const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number)

    return sortedDays.map((day) => {
      const dayCosts = costs.filter((c) => c.itinerary_day_id === day.id)
      const total = dayCosts.reduce((sum, c) => sum + c.amount, 0)
      const paid = dayCosts.filter((c) => c.is_paid).reduce((sum, c) => sum + c.amount, 0)

      return {
        name: `Day ${day.day_number}`,
        location: day.location,
        total,
        paid,
        unpaid: total - paid,
      }
    })
  }, [costs, days])

  // Overall totals
  const totals = useMemo(() => {
    const total = costs.reduce((sum, c) => sum + c.amount, 0)
    const paid = costs.filter((c) => c.is_paid).reduce((sum, c) => sum + c.amount, 0)
    const estimated = costs.filter((c) => c.is_estimated).reduce((sum, c) => sum + c.amount, 0)

    return {
      total,
      paid,
      remaining: total - paid,
      estimated,
      confirmed: total - estimated,
      paidPercent: total > 0 ? Math.round((paid / total) * 100) : 0,
    }
  }, [costs])

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof categoryData[0] }> }) => {
    if (!active || !payload || !payload.length) return null
    const data = payload[0].payload
    return (
      <div className="bg-white rounded-lg shadow-lg border p-3">
        <p className="font-medium text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {currencySymbol}
          {data.value.toLocaleString()}
        </p>
        {data.paid > 0 && (
          <p className="text-xs text-green-600">
            {currencySymbol}
            {data.paid.toLocaleString()} paid
          </p>
        )}
      </div>
    )
  }

  if (costs.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No costs yet</h3>
        <p className="text-gray-500">
          Add costs to see a breakdown of your trip expenses
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-medium text-gray-900">Cost Breakdown</h3>
            <p className="text-sm text-gray-500">{plan.name}</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('donut')}
              className={`p-2 rounded ${
                viewMode === 'donut'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Category breakdown"
            >
              <PieChartIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`p-2 rounded ${
                viewMode === 'bar'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Daily costs"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-xl font-semibold text-gray-900">
              {currencySymbol}
              {totals.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 uppercase tracking-wide">Paid</p>
            <p className="text-xl font-semibold text-green-700">
              {currencySymbol}
              {totals.paid.toLocaleString()}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-600 uppercase tracking-wide">Remaining</p>
            <p className="text-xl font-semibold text-yellow-700">
              {currencySymbol}
              {totals.remaining.toLocaleString()}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 uppercase tracking-wide">Progress</p>
            <p className="text-xl font-semibold text-blue-700">{totals.paidPercent}%</p>
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${totals.paidPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {viewMode === 'donut' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category List */}
            <div className="space-y-2">
              {categoryData.map((cat) => {
                const percent = totals.total > 0 ? Math.round((cat.value / totals.total) * 100) : 0
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                        <span className="text-sm text-gray-700">
                          {currencySymbol}
                          {cat.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{cat.count} items</span>
                        <span>{percent}%</span>
                      </div>
                      {/* Mini progress bar for paid vs unpaid */}
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${cat.value > 0 ? (cat.paid / cat.value) * 100 : 0}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  fontSize={12}
                />
                <YAxis
                  fontSize={12}
                  tickFormatter={(value) => `${currencySymbol}${value}`}
                />
                <Tooltip
                  formatter={(value) => [`${currencySymbol}${Number(value).toLocaleString()}`, '']}
                  labelFormatter={(label) => {
                    const day = dailyData.find((d) => d.name === label)
                    return day ? `${label} - ${day.location}` : label
                  }}
                />
                <Legend />
                <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid" />
                <Bar dataKey="unpaid" stackId="a" fill="#fbbf24" name="Unpaid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Payment Status Breakdown */}
      <div className="px-4 pb-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Payment Status</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Confirmed Costs</p>
              <p className="text-lg font-semibold text-gray-900">
                {currencySymbol}
                {totals.confirmed.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">
                {costs.filter((c) => !c.is_estimated).length} items
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estimated Costs</p>
              <p className="text-lg font-semibold text-gray-500">
                {currencySymbol}
                {totals.estimated.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">
                {costs.filter((c) => c.is_estimated).length} items
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
