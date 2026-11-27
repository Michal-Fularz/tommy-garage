import assert from 'node:assert/strict';
import test from 'node:test';
import {UNASSIGNED, summarizeFleet} from '../src/fleet.js';

function ride(overrides) {
  return {
    id: '1', date: '2024-03-02', bike: '__proto__', name: 'Synthetic trip',
    distance_m: 25000, moving_seconds: 3600, elevation_m: 120,
    watts: 150, normalized_watts: 161, heart_rate: 115,
    url: '', secondary: false, dual_role: null, power_meter: null,
    ...overrides,
  };
}

test('uses moving-time weighting and excludes the secondary and corrupt rides from totals', () => {
  const data = summarizeFleet([
    ride(),
    ride({id: '2', date: '2024-03-09', distance_m: 50000, moving_seconds: 7200, watts: 180}),
    ride({id: '3', date: '2024-03-09', secondary: true, dual_role: 'secondary', distance_m: 72000, moving_seconds: 7200}),
    ride({id: '4', bike: null, distance_m: 10000}),
    ride({id: '5', moving_seconds: 12, distance_m: 10000}),
  ]);
  assert.deepEqual([data.total_dist, data.total_hours, data.total_rides], [85, 4, 3]);
  assert.deepEqual(data.fleet.map(bike => bike.name), ['__proto__', UNASSIGNED]);
  assert.equal(data.fleet[0].avg_watts, 170);
  assert.deepEqual(data.all_rides.map(ride => ride.id), ['3', '2', '4', '1']);
  assert.equal(data.monthly['2024']['03']['__proto__'], 75);
  assert.deepEqual(data.bike_details['__proto__'].top_dist.map(ride => ride.id), ['2', '1']);
});

test('keeps zero months, limits the timeline to available data, and rounds values consistently', () => {
  const data = summarizeFleet([
    ride({distance_m: 16250, moving_seconds: 5400}),
    ride({id: '2', date: '2025-05-02', bike: 'Other bike'}),
  ]);
  assert.equal(data.total_dist, 41);
  const detail = data.bike_details['__proto__'];
  assert.equal(detail.first_active_ym, '2024-03');
  assert.equal(detail.last_active_ym, '2024-03');
  assert.deepEqual(detail.monthly_timeline[1], {ym: '2024-02', dist: 0, hours: 0, has_rides: false});
  assert.equal(detail.monthly_timeline.at(-1).ym, '2025-05');
  assert.deepEqual(detail.seasonality[2], {month: '03', name: 'Mar', dist: 16.2, hours: 1.5});
});
