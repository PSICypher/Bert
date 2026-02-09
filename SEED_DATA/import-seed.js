/**
 * Import Florida Trip Seed Data
 *
 * This script imports the Florida trip data into a fresh Supabase database.
 * It creates new UUIDs to avoid conflicts and maintains all relationships.
 *
 * Usage:
 *   export SUPABASE_URL=https://your-project.supabase.co
 *   export SUPABASE_SERVICE_KEY=your-service-role-key
 *   node import-seed.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

// Read configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  console.error('');
  console.error('Usage:');
  console.error('  export SUPABASE_URL=https://your-project.supabase.co');
  console.error('  export SUPABASE_SERVICE_KEY=your-service-role-key');
  console.error('  node import-seed.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Generate new UUID
function newUUID() {
  return crypto.randomUUID();
}

async function importSeedData() {
  console.log('=== Florida Trip Seed Data Import ===\n');

  // Load seed data
  const seedData = JSON.parse(fs.readFileSync('./florida-trip-data.json', 'utf8'));
  console.log('Loaded seed data from:', seedData.exportedAt);

  // Get current user (first user in auth.users or create one)
  const { data: authData } = await supabase.auth.admin.listUsers();
  if (!authData?.users?.length) {
    console.error('Error: No users found. Please create a user first via the app login.');
    process.exit(1);
  }
  const userId = authData.users[0].id;
  console.log('Using user ID:', userId);

  // Create ID mappings (old ID -> new ID)
  const idMap = {
    trip: {},
    planVersion: {},
    itineraryDay: {},
    accommodation: {},
    transport: {},
    cost: {}
  };

  // 1. Insert Trip
  console.log('\n1. Creating trip...');
  const newTripId = newUUID();
  idMap.trip[seedData.trip.id] = newTripId;

  const { error: tripError } = await supabase.from('trips').insert({
    id: newTripId,
    user_id: userId,
    name: seedData.trip.name,
    description: seedData.trip.description,
    destination: seedData.trip.destination,
    start_date: seedData.trip.start_date,
    end_date: seedData.trip.end_date,
    cover_image_url: seedData.trip.cover_image_url,
    is_archived: seedData.trip.is_archived
  });

  if (tripError) {
    console.error('Error creating trip:', tripError.message);
    process.exit(1);
  }
  console.log('   Created:', seedData.trip.name);

  // 2. Insert Plan Versions
  console.log('\n2. Creating plan versions...');
  for (const pv of seedData.planVersions) {
    const newPvId = newUUID();
    idMap.planVersion[pv.id] = newPvId;

    const { error } = await supabase.from('plan_versions').insert({
      id: newPvId,
      trip_id: newTripId,
      name: pv.name,
      description: pv.description,
      is_active: pv.is_active,
      total_cost: pv.total_cost,
      currency: pv.currency,
      color: pv.color
    });

    if (error) {
      console.error('Error creating plan version:', error.message);
    } else {
      console.log('   Created:', pv.name, '(£' + pv.total_cost + ')');
    }
  }

  // 3. Insert Itinerary Days
  console.log('\n3. Creating itinerary days...');
  for (const day of seedData.itineraryDays) {
    const newDayId = newUUID();
    idMap.itineraryDay[day.id] = newDayId;

    const { error } = await supabase.from('itinerary_days').insert({
      id: newDayId,
      plan_version_id: idMap.planVersion[day.plan_version_id],
      day_number: day.day_number,
      date: day.date,
      location: day.location,
      location_coordinates: day.location_coordinates,
      icon: day.icon,
      color: day.color,
      activities: day.activities,
      notes: day.notes,
      drive_time: day.drive_time,
      drive_distance: day.drive_distance
    });

    if (error) {
      console.error('Error creating day', day.day_number + ':', error.message);
    }
  }
  console.log('   Created', seedData.itineraryDays.length, 'days');

  // 4. Insert Accommodations
  console.log('\n4. Creating accommodations...');
  for (const acc of seedData.accommodations) {
    const newAccId = newUUID();
    idMap.accommodation[acc.id] = newAccId;

    const { error } = await supabase.from('accommodations').insert({
      id: newAccId,
      plan_version_id: idMap.planVersion[acc.plan_version_id],
      name: acc.name,
      type: acc.type,
      location: acc.location,
      address: acc.address,
      coordinates: acc.coordinates,
      check_in: acc.check_in,
      check_out: acc.check_out,
      cost: acc.cost,
      currency: acc.currency,
      booking_reference: acc.booking_reference,
      booking_url: acc.booking_url,
      cancellation_policy: acc.cancellation_policy,
      amenities: acc.amenities,
      notes: acc.notes,
      color: acc.color,
      is_confirmed: acc.is_confirmed
    });

    if (error) {
      console.error('Error creating accommodation:', error.message);
    } else {
      console.log('   Created:', acc.name, '(' + acc.location + ')');
    }
  }

  // 5. Insert Transport
  console.log('\n5. Creating transport...');
  for (const t of seedData.transport) {
    const newTransportId = newUUID();
    idMap.transport[t.id] = newTransportId;

    const { error } = await supabase.from('transport').insert({
      id: newTransportId,
      plan_version_id: idMap.planVersion[t.plan_version_id],
      type: t.type,
      provider: t.provider,
      vehicle: t.vehicle,
      reference_number: t.reference_number,
      pickup_location: t.pickup_location,
      pickup_date: t.pickup_date,
      pickup_time: t.pickup_time,
      dropoff_location: t.dropoff_location,
      dropoff_date: t.dropoff_date,
      dropoff_time: t.dropoff_time,
      cost: t.cost,
      currency: t.currency,
      includes: t.includes,
      booking_url: t.booking_url,
      notes: t.notes,
      is_confirmed: t.is_confirmed
    });

    if (error) {
      console.error('Error creating transport:', error.message);
    } else {
      console.log('   Created:', t.vehicle, '(' + t.pickup_location + ' → ' + t.dropoff_location + ')');
    }
  }

  // 6. Insert Costs
  console.log('\n6. Creating costs...');
  for (const c of seedData.costs) {
    const newCostId = newUUID();
    idMap.cost[c.id] = newCostId;

    const { error } = await supabase.from('costs').insert({
      id: newCostId,
      plan_version_id: idMap.planVersion[c.plan_version_id],
      itinerary_day_id: c.itinerary_day_id ? idMap.itineraryDay[c.itinerary_day_id] : null,
      category: c.category,
      item: c.item,
      amount: c.amount,
      currency: c.currency,
      is_paid: c.is_paid,
      is_estimated: c.is_estimated,
      notes: c.notes
    });

    if (error) {
      console.error('Error creating cost:', error.message);
    }
  }
  console.log('   Created', seedData.costs.length, 'cost items');

  // 7. Insert Checklist Items
  console.log('\n7. Creating checklist items...');
  for (const item of seedData.checklistItems) {
    // Map source_id to new ID based on source_type
    let newSourceId = null;
    if (item.source_id) {
      if (item.source_type === 'accommodation') {
        newSourceId = idMap.accommodation[item.source_id];
      } else if (item.source_type === 'transport') {
        newSourceId = idMap.transport[item.source_id];
      } else if (item.source_type === 'cost') {
        newSourceId = idMap.cost[item.source_id];
      }
    }

    const { error } = await supabase.from('checklist_items').insert({
      id: newUUID(),
      plan_version_id: idMap.planVersion[item.plan_version_id],
      category: item.category,
      name: item.name,
      description: item.description,
      source_type: item.source_type,
      source_id: newSourceId,
      booking_status: item.booking_status,
      booking_reference: item.booking_reference,
      booking_url: item.booking_url,
      total_cost: item.total_cost,
      deposit_amount: item.deposit_amount,
      amount_paid: item.amount_paid,
      is_fully_paid: item.is_fully_paid,
      payment_type: item.payment_type,
      payment_due_date: item.payment_due_date,
      payment_due_context: item.payment_due_context,
      notes: item.notes,
      sort_order: item.sort_order
    });

    if (error) {
      console.error('Error creating checklist item:', item.name, '-', error.message);
    }
  }
  console.log('   Created', seedData.checklistItems.length, 'checklist items');

  // Summary
  console.log('\n=== IMPORT COMPLETE ===\n');
  console.log('Trip ID:', newTripId);
  console.log('Plan Version ID:', Object.values(idMap.planVersion)[0]);
  console.log('\nRecords created:');
  console.log('  - 1 trip');
  console.log('  -', seedData.planVersions.length, 'plan version(s)');
  console.log('  -', seedData.itineraryDays.length, 'itinerary days');
  console.log('  -', seedData.accommodations.length, 'accommodations');
  console.log('  -', seedData.transport.length, 'transport');
  console.log('  -', seedData.costs.length, 'costs');
  console.log('  -', seedData.checklistItems.length, 'checklist items');
  console.log('\nTotal:',
    1 + seedData.planVersions.length + seedData.itineraryDays.length +
    seedData.accommodations.length + seedData.transport.length +
    seedData.costs.length + seedData.checklistItems.length, 'records');
}

importSeedData().catch(console.error);
