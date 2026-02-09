import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trips/[id]/export
 * Export trip as HTML document (printable/PDF ready)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get trip with related data
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Get active plan version
  const { data: planVersion } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .single();

  let itineraryDays: Array<{
    id: string;
    day_number: number;
    date: string | null;
    location: string;
    notes: string | null;
  }> = [];
  let accommodations: Array<{
    name: string;
    type: string;
    location: string | null;
    check_in: string;
    check_out: string;
    nights: number;
    cost: number | null;
    currency: string;
    booking_reference: string | null;
    is_confirmed: boolean;
    notes: string | null;
  }> = [];
  let transport: Array<{
    type: string;
    provider: string | null;
    vehicle: string | null;
    pickup_location: string | null;
    pickup_date: string | null;
    pickup_time: string | null;
    dropoff_location: string | null;
    dropoff_date: string | null;
    dropoff_time: string | null;
    cost: number | null;
    currency: string;
    reference_number: string | null;
    is_confirmed: boolean;
    notes: string | null;
  }> = [];
  let activities: Array<{
    itinerary_day_id: string;
    name: string;
    time_start: string | null;
    time_end: string | null;
    location: string | null;
    cost: number | null;
    booking_status: string;
  }> = [];

  if (planVersion) {
    // Get itinerary days
    const { data: days } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('plan_version_id', planVersion.id)
      .order('day_number');
    itineraryDays = days || [];

    // Get accommodations
    const { data: accom } = await supabase
      .from('accommodations')
      .select('*')
      .eq('plan_version_id', planVersion.id)
      .order('check_in');
    accommodations = accom || [];

    // Get transport
    const { data: trans } = await supabase
      .from('transport')
      .select('*')
      .eq('plan_version_id', planVersion.id)
      .order('pickup_date');
    transport = trans || [];

    // Get activities
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('plan_version_id', planVersion.id)
      .order('sort_order');
    activities = acts || [];
  }

  // Get travellers
  const { data: travellers } = await supabase
    .from('travellers')
    .select('*')
    .eq('trip_id', tripId);

  // Generate HTML
  const html = generateExportHtml({
    trip,
    planVersion,
    itineraryDays,
    accommodations,
    transport,
    activities,
    travellers: travellers || [],
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.html"`,
    },
  });
}

interface ExportData {
  trip: {
    name: string;
    destination: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  };
  planVersion: {
    name: string;
    total_cost: number;
    currency: string;
  } | null;
  itineraryDays: Array<{
    day_number: number;
    date: string | null;
    location: string;
    notes: string | null;
  }>;
  accommodations: Array<{
    name: string;
    type: string;
    location: string | null;
    check_in: string;
    check_out: string;
    nights: number;
    cost: number | null;
    currency: string;
    booking_reference: string | null;
    is_confirmed: boolean;
    notes: string | null;
  }>;
  transport: Array<{
    type: string;
    provider: string | null;
    vehicle: string | null;
    pickup_location: string | null;
    pickup_date: string | null;
    pickup_time: string | null;
    dropoff_location: string | null;
    dropoff_date: string | null;
    dropoff_time: string | null;
    cost: number | null;
    currency: string;
    reference_number: string | null;
    is_confirmed: boolean;
    notes: string | null;
  }>;
  activities: Array<{
    itinerary_day_id: string;
    name: string;
    time_start: string | null;
    time_end: string | null;
    location: string | null;
    cost: number | null;
    booking_status: string;
  }>;
  travellers: Array<{
    name: string;
    passport_number: string | null;
    passport_expiry: string | null;
    nationality: string | null;
    esta_status: string;
    dietary: string | null;
    is_child: boolean;
  }>;
}

function generateExportHtml(data: ExportData): string {
  const { trip, planVersion, itineraryDays, accommodations, transport, travellers } = data;

  const formatDate = (date: string | null) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return 'TBD';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.name} - Trip Export</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #1a1a1a; margin-bottom: 8px; }
    h2 { color: #2563eb; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h3 { color: #374151; margin-top: 16px; margin-bottom: 8px; }
    .subtitle { color: #6b7280; margin-bottom: 24px; }
    .section { margin-bottom: 32px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .card-header { font-weight: 600; margin-bottom: 8px; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .card-label { color: #6b7280; }
    .confirmed { color: #059669; }
    .pending { color: #d97706; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    .total { font-size: 1.25rem; font-weight: 600; color: #1a1a1a; }
    @media print {
      body { max-width: 100%; padding: 0; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${trip.name}</h1>
  <p class="subtitle">${trip.destination || 'Destination TBD'} &bull; ${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}</p>

  ${trip.description ? `<p style="margin-bottom: 24px;">${trip.description}</p>` : ''}

  ${planVersion ? `
  <div class="section">
    <h2>Plan: ${planVersion.name}</h2>
    <p class="total">Total Cost: ${formatCurrency(planVersion.total_cost, planVersion.currency)}</p>
  </div>
  ` : ''}

  ${travellers.length > 0 ? `
  <div class="section">
    <h2>Travellers</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Passport</th>
          <th>Expiry</th>
          <th>ESTA</th>
          <th>Dietary</th>
        </tr>
      </thead>
      <tbody>
        ${travellers.map(t => `
        <tr>
          <td>${t.name}${t.is_child ? ' (Child)' : ''}</td>
          <td>${t.passport_number || '-'}</td>
          <td>${formatDate(t.passport_expiry)}</td>
          <td>${t.esta_status}</td>
          <td>${t.dietary || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${itineraryDays.length > 0 ? `
  <div class="section">
    <h2>Itinerary</h2>
    ${itineraryDays.map(day => `
    <div class="card">
      <div class="card-header">Day ${day.day_number}: ${day.location}</div>
      <div class="card-row">
        <span class="card-label">Date</span>
        <span>${formatDate(day.date)}</span>
      </div>
      ${day.notes ? `<p style="margin-top: 8px; color: #6b7280;">${day.notes}</p>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${accommodations.length > 0 ? `
  <div class="section">
    <h2>Accommodations</h2>
    ${accommodations.map(a => `
    <div class="card">
      <div class="card-header">${a.name} <span class="${a.is_confirmed ? 'confirmed' : 'pending'}">(${a.is_confirmed ? 'Confirmed' : 'Pending'})</span></div>
      <div class="card-row">
        <span class="card-label">Type</span>
        <span>${a.type}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Location</span>
        <span>${a.location || '-'}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Check-in</span>
        <span>${formatDate(a.check_in)}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Check-out</span>
        <span>${formatDate(a.check_out)} (${a.nights} nights)</span>
      </div>
      <div class="card-row">
        <span class="card-label">Cost</span>
        <span>${formatCurrency(a.cost, a.currency)}</span>
      </div>
      ${a.booking_reference ? `
      <div class="card-row">
        <span class="card-label">Reference</span>
        <span>${a.booking_reference}</span>
      </div>
      ` : ''}
      ${a.notes ? `<p style="margin-top: 8px; color: #6b7280;">${a.notes}</p>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  ${transport.length > 0 ? `
  <div class="section">
    <h2>Transport</h2>
    ${transport.map(t => `
    <div class="card">
      <div class="card-header">${t.type}${t.provider ? ` - ${t.provider}` : ''} <span class="${t.is_confirmed ? 'confirmed' : 'pending'}">(${t.is_confirmed ? 'Confirmed' : 'Pending'})</span></div>
      ${t.vehicle ? `
      <div class="card-row">
        <span class="card-label">Vehicle</span>
        <span>${t.vehicle}</span>
      </div>
      ` : ''}
      <div class="card-row">
        <span class="card-label">Pickup</span>
        <span>${t.pickup_location || '-'} - ${formatDate(t.pickup_date)}${t.pickup_time ? ` ${t.pickup_time}` : ''}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Dropoff</span>
        <span>${t.dropoff_location || '-'} - ${formatDate(t.dropoff_date)}${t.dropoff_time ? ` ${t.dropoff_time}` : ''}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Cost</span>
        <span>${formatCurrency(t.cost, t.currency)}</span>
      </div>
      ${t.reference_number ? `
      <div class="card-row">
        <span class="card-label">Reference</span>
        <span>${t.reference_number}</span>
      </div>
      ` : ''}
      ${t.notes ? `<p style="margin-top: 8px; color: #6b7280;">${t.notes}</p>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}

  <footer style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 0.875rem;">
    Exported from Holiday Planner on ${new Date().toLocaleDateString('en-GB')}
  </footer>
</body>
</html>`;
}
