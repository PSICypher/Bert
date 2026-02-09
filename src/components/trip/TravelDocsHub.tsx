'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Users,
  FileText,
  Phone,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Baby,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Traveller = Database['public']['Tables']['travellers']['Row'];
type TravelInsurance = Database['public']['Tables']['travel_insurance']['Row'];

interface TravelDocsHubProps {
  tripId: string;
  tripStartDate?: string | null;
}

const ESTA_OPTIONS = [
  { value: 'not_required', label: 'Not Required', color: 'gray' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'expired', label: 'Expired', color: 'red' },
] as const;

export function TravelDocsHub({ tripId, tripStartDate }: TravelDocsHubProps) {
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [insurance, setInsurance] = useState<TravelInsurance[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTravellerForm, setShowTravellerForm] = useState(false);
  const [editingTraveller, setEditingTraveller] = useState<Traveller | null>(null);
  const [travellerForm, setTravellerForm] = useState({
    name: '',
    passport_number: '',
    passport_expiry: '',
    nationality: '',
    esta_status: 'not_required' as Traveller['esta_status'],
    dietary: '',
    medical_notes: '',
    is_child: false,
  });

  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<TravelInsurance | null>(null);
  const [insuranceForm, setInsuranceForm] = useState({
    provider: '',
    policy_number: '',
    emergency_phone: '',
    coverage_start: '',
    coverage_end: '',
    notes: '',
  });

  const [expandedSection, setExpandedSection] = useState<'travellers' | 'insurance' | null>(
    'travellers'
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [travellersRes, insuranceRes] = await Promise.all([
        fetch(`/api/travellers?trip_id=${tripId}`),
        fetch(`/api/travel-insurance?trip_id=${tripId}`),
      ]);

      if (travellersRes.ok) {
        setTravellers(await travellersRes.json());
      }
      if (insuranceRes.ok) {
        setInsurance(await insuranceRes.json());
      }
    } catch (err) {
      console.error('Failed to load travel docs:', err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkPassportExpiry = (expiryDate: string | null): 'ok' | 'warning' | 'expired' => {
    if (!expiryDate) return 'ok';
    const expiry = new Date(expiryDate);
    const tripDate = tripStartDate ? new Date(tripStartDate) : new Date();
    const sixMonthsBefore = new Date(tripDate);
    sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() + 6);

    if (expiry < new Date()) return 'expired';
    if (expiry < sixMonthsBefore) return 'warning';
    return 'ok';
  };

  const resetTravellerForm = () => {
    setTravellerForm({
      name: '',
      passport_number: '',
      passport_expiry: '',
      nationality: '',
      esta_status: 'not_required',
      dietary: '',
      medical_notes: '',
      is_child: false,
    });
    setEditingTraveller(null);
    setShowTravellerForm(false);
  };

  const handleTravellerSubmit = async () => {
    if (!travellerForm.name.trim()) return;

    try {
      if (editingTraveller) {
        const res = await fetch(`/api/travellers?id=${editingTraveller.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(travellerForm),
        });
        if (res.ok) {
          await loadData();
          resetTravellerForm();
        }
      } else {
        const res = await fetch('/api/travellers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: tripId, ...travellerForm }),
        });
        if (res.ok) {
          await loadData();
          resetTravellerForm();
        }
      }
    } catch (err) {
      console.error('Failed to save traveller:', err);
    }
  };

  const handleDeleteTraveller = async (id: string) => {
    try {
      const res = await fetch(`/api/travellers?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTravellers((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete traveller:', err);
    }
  };

  const resetInsuranceForm = () => {
    setInsuranceForm({
      provider: '',
      policy_number: '',
      emergency_phone: '',
      coverage_start: '',
      coverage_end: '',
      notes: '',
    });
    setEditingInsurance(null);
    setShowInsuranceForm(false);
  };

  const handleInsuranceSubmit = async () => {
    if (!insuranceForm.provider.trim()) return;

    try {
      if (editingInsurance) {
        const res = await fetch(`/api/travel-insurance?id=${editingInsurance.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(insuranceForm),
        });
        if (res.ok) {
          await loadData();
          resetInsuranceForm();
        }
      } else {
        const res = await fetch('/api/travel-insurance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: tripId, ...insuranceForm }),
        });
        if (res.ok) {
          await loadData();
          resetInsuranceForm();
        }
      }
    } catch (err) {
      console.error('Failed to save insurance:', err);
    }
  };

  const handleDeleteInsurance = async (id: string) => {
    try {
      const res = await fetch(`/api/travel-insurance?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInsurance((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete insurance:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Travellers Section */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'travellers' ? null : 'travellers')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Travellers</span>
            <span className="text-sm text-gray-500">({travellers.length})</span>
          </div>
          {expandedSection === 'travellers' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'travellers' && (
          <div className="border-t p-4">
            {travellers.length > 0 && (
              <div className="space-y-3 mb-4">
                {travellers.map((traveller) => {
                  const passportStatus = checkPassportExpiry(traveller.passport_expiry);
                  const estaOption = ESTA_OPTIONS.find((o) => o.value === traveller.esta_status);

                  return (
                    <div
                      key={traveller.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {traveller.is_child ? (
                            <Baby className="w-4 h-4 text-pink-500" />
                          ) : (
                            <User className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{traveller.name}</span>
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          {traveller.nationality && (
                            <p>Nationality: {traveller.nationality}</p>
                          )}
                          {traveller.passport_expiry && (
                            <p className="flex items-center gap-1">
                              Passport expires:{' '}
                              {new Date(traveller.passport_expiry).toLocaleDateString('en-GB')}
                              {passportStatus === 'warning' && (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              )}
                              {passportStatus === 'expired' && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                              )}
                            </p>
                          )}
                          {estaOption && traveller.esta_status !== 'not_required' && (
                            <p>
                              ESTA:{' '}
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  estaOption.color === 'green'
                                    ? 'bg-green-100 text-green-700'
                                    : estaOption.color === 'yellow'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : estaOption.color === 'red'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {estaOption.label}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setTravellerForm({
                              name: traveller.name,
                              passport_number: traveller.passport_number || '',
                              passport_expiry: traveller.passport_expiry || '',
                              nationality: traveller.nationality || '',
                              esta_status: traveller.esta_status,
                              dietary: traveller.dietary || '',
                              medical_notes: traveller.medical_notes || '',
                              is_child: traveller.is_child,
                            });
                            setEditingTraveller(traveller);
                            setShowTravellerForm(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTraveller(traveller.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showTravellerForm ? (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={travellerForm.name}
                      onChange={(e) =>
                        setTravellerForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Full name as on passport"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality
                    </label>
                    <input
                      type="text"
                      value={travellerForm.nationality}
                      onChange={(e) =>
                        setTravellerForm((f) => ({ ...f, nationality: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="British"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Expiry
                    </label>
                    <input
                      type="date"
                      value={travellerForm.passport_expiry}
                      onChange={(e) =>
                        setTravellerForm((f) => ({ ...f, passport_expiry: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ESTA Status
                    </label>
                    <select
                      value={travellerForm.esta_status}
                      onChange={(e) =>
                        setTravellerForm((f) => ({
                          ...f,
                          esta_status: e.target.value as Traveller['esta_status'],
                        }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ESTA_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={travellerForm.is_child}
                        onChange={(e) =>
                          setTravellerForm((f) => ({ ...f, is_child: e.target.checked }))
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Child (under 18)</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetTravellerForm}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTravellerSubmit}
                    disabled={!travellerForm.name.trim()}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {editingTraveller ? 'Save' : 'Add Traveller'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTravellerForm(true)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Traveller
              </button>
            )}
          </div>
        )}
      </div>

      {/* Insurance Section */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'insurance' ? null : 'insurance')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Travel Insurance</span>
            <span className="text-sm text-gray-500">({insurance.length})</span>
          </div>
          {expandedSection === 'insurance' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'insurance' && (
          <div className="border-t p-4">
            {insurance.length > 0 && (
              <div className="space-y-3 mb-4">
                {insurance.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{policy.provider}</p>
                      <div className="mt-1 space-y-1 text-sm text-gray-600">
                        {policy.policy_number && <p>Policy: {policy.policy_number}</p>}
                        {policy.emergency_phone && (
                          <p className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {policy.emergency_phone}
                          </p>
                        )}
                        {policy.coverage_start && policy.coverage_end && (
                          <p>
                            Coverage:{' '}
                            {new Date(policy.coverage_start).toLocaleDateString('en-GB')} -{' '}
                            {new Date(policy.coverage_end).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setInsuranceForm({
                            provider: policy.provider,
                            policy_number: policy.policy_number || '',
                            emergency_phone: policy.emergency_phone || '',
                            coverage_start: policy.coverage_start || '',
                            coverage_end: policy.coverage_end || '',
                            notes: policy.notes || '',
                          });
                          setEditingInsurance(policy);
                          setShowInsuranceForm(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInsurance(policy.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showInsuranceForm ? (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider *
                    </label>
                    <input
                      type="text"
                      value={insuranceForm.provider}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, provider: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Insurance company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={insuranceForm.policy_number}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, policy_number: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={insuranceForm.emergency_phone}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, emergency_phone: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+44 800 123 456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coverage Start
                    </label>
                    <input
                      type="date"
                      value={insuranceForm.coverage_start}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, coverage_start: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coverage End
                    </label>
                    <input
                      type="date"
                      value={insuranceForm.coverage_end}
                      onChange={(e) =>
                        setInsuranceForm((f) => ({ ...f, coverage_end: e.target.value }))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetInsuranceForm}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInsuranceSubmit}
                    disabled={!insuranceForm.provider.trim()}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {editingInsurance ? 'Save' : 'Add Insurance'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowInsuranceForm(true)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Insurance Policy
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
