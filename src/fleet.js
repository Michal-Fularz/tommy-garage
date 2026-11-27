export const UNASSIGNED = 'Bez przypisania';
const months = Array.from({length: 12}, (_, index) => String(index + 1).padStart(2, '0'));
const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

// Match the original report's nearest-even rounding on exact half steps.
function round(value, digits = 0) {
  if (Math.abs(value * 2 ** digits) % 1 === 0.5) {
    const scale = 10 ** digits;
    const lower = Math.floor(value * scale);
    return (lower + Math.abs(lower % 2)) / scale;
  }
  return Number(value.toFixed(digits));
}

// Compensate for precision lost when adding already-aggregated months.
function sum(values) {
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
}

function newTotals() {
  return {dist: 0, hours: 0, rides: 0, elev: 0, maxDist: 0, wattsSum: 0, wattsTime: 0, hrSum: 0, hrTime: 0};
}

function accumulate(totals, ride, distance, hours) {
  totals.dist += distance;
  totals.hours += hours;
  totals.rides += 1;
  totals.elev += ride.elevation_m;
  totals.maxDist = Math.max(totals.maxDist, distance);
  if (ride.watts > 0) {
    totals.wattsSum += ride.watts * ride.moving_seconds;
    totals.wattsTime += ride.moving_seconds;
  }
  if (ride.heart_rate > 0) {
    totals.hrSum += ride.heart_rate * ride.moving_seconds;
    totals.hrTime += ride.moving_seconds;
  }
}

function summarize(name, totals) {
  return {
    name,
    dist: round(totals.dist, 1),
    hours: round(totals.hours, 1),
    rides: totals.rides,
    avg_speed: totals.hours > 0 ? round(totals.dist / totals.hours, 1) : 0,
    avg_watts: totals.wattsTime > 0 ? round(totals.wattsSum / totals.wattsTime) : null,
    avg_hr: totals.hrTime > 0 ? round(totals.hrSum / totals.hrTime) : null,
    elev: round(totals.elev),
  };
}

function entry(map, key, value) {
  if (!map.has(key)) map.set(key, value());
  return map.get(key);
}

function newMonths() {
  return Object.fromEntries(months.map(month => [month, Object.create(null)]));
}

function best(rides, field) {
  return [...rides].sort((a, b) => b[field] - a[field]).slice(0, 5);
}

function bikeDetail(bike, rides, years, latestMonth, yearlyTotals, monthly, monthlyHours) {
  const activeYears = years.filter(year => (yearlyTotals.get(year).get(bike)?.dist ?? 0) > 0);
  const firstYear = activeYears[0] ?? years[0] ?? '';
  const lastYear = activeYears.at(-1) ?? years.at(-1) ?? '';
  const activeMonths = [];
  const timeline = [];
  for (const year of years) {
    for (const month of months) {
      const ym = `${year}-${month}`;
      if (ym > latestMonth) break;
      const dist = monthly[year][month][bike] ?? 0;
      const hours = monthlyHours[year][month][bike] ?? 0;
      if (dist > 0) activeMonths.push(ym);
      timeline.push({ym, dist: round(dist, 1), hours: round(hours, 1), has_rides: dist > 0 || hours > 0});
    }
  }

  const annual = years.map(year => {
    const totals = yearlyTotals.get(year).get(bike);
    if (!totals || totals.dist <= 0) {
      return {year, dist: 0, hours: 0, rides: 0, speed: 0, watts: null, hr: null, elev: 0, share: 0, has_rides: false};
    }
    const {dist, hours, rides, avg_speed, avg_watts, avg_hr, elev} = summarize(bike, totals);
    const fleetDistance = sum(Array.from(yearlyTotals.get(year).values(), bike => bike.dist));
    return {
      year, dist, hours, rides, speed: avg_speed, watts: avg_watts, hr: avg_hr, elev,
      share: fleetDistance > 0 ? round(totals.dist / fleetDistance * 100, 1) : 0,
      has_rides: true,
    };
  });

  const seasonality = months.map((month, index) => ({
    month,
    name: monthNames[index],
    dist: round(sum(years.map(year => monthly[year][month][bike] ?? 0)), 1),
    hours: round(sum(years.map(year => monthlyHours[year][month][bike] ?? 0)), 1),
  }));

  const topDistance = best(rides, 'dist');
  const fastRides = rides.filter(ride => ride.dist >= 5 && ride.speed < 65);
  if (fastRides.length < 5) {
    const ids = new Set(fastRides.map(ride => ride.id));
    fastRides.push(...rides.filter(ride => ride.speed < 65 && ride.dist > 0 && !ids.has(ride.id)));
  }
  return {
    first_active_year: firstYear,
    last_active_year: lastYear,
    first_active_ym: activeMonths[0] ?? `${firstYear}-01`,
    last_active_ym: activeMonths.at(-1) ?? `${lastYear}-12`,
    years: annual,
    monthly_timeline: timeline,
    seasonality,
    top_dist: topDistance,
    top_speed: best(fastRides, 'speed'),
    top_power: best(rides.filter(ride => ride.np > 0), 'np'),
    top_rides: topDistance,
  };
}

function descending(a, b) {
  return a === b ? 0 : a < b ? 1 : -1;
}

export function summarizeFleet(rides) {
  const rideHistory = [];
  const fleetTotals = new Map();
  const yearlyTotals = new Map();
  const monthly = Object.create(null);
  const monthlyHours = Object.create(null);
  for (const ride of rides) {
    const distance = ride.distance_m / 1000;
    const hours = ride.moving_seconds / 3600;
    const speed = hours > 0 ? distance / hours : 0;
    if ((distance <= 0 && hours <= 0) || speed > 70) continue;

    const bike = ride.bike || UNASSIGNED;
    const date = ride.date.slice(0, 10);
    const year = date.slice(0, 4);
    const month = date.slice(5, 7);
    if (!ride.secondary) {
      const total = entry(fleetTotals, bike, () => ({...newTotals(), years: new Set()}));
      accumulate(total, ride, distance, hours);
      if (year) {
        total.years.add(year);
        const yearTotals = entry(yearlyTotals, year, () => new Map());
        accumulate(entry(yearTotals, bike, newTotals), ride, distance, hours);
        monthly[year] ??= newMonths();
        monthlyHours[year] ??= newMonths();
        if (Object.hasOwn(monthly[year], month)) {
          monthly[year][month][bike] = (monthly[year][month][bike] ?? 0) + distance;
          monthlyHours[year][month][bike] = (monthlyHours[year][month][bike] ?? 0) + hours;
        }
      }
    }

    rideHistory.push({
      id: ride.id, date, year, bike,
      name: ride.name || 'Bez nazwy',
      dist: round(distance, 1),
      time_h: round(hours, 2),
      speed: round(speed, 1),
      watts: ride.watts ? round(ride.watts) : null,
      np: ride.normalized_watts ? round(ride.normalized_watts) : null,
      hr: ride.heart_rate ? round(ride.heart_rate) : null,
      elev: round(ride.elevation_m),
      url: ride.url,
      is_strava: ride.url.startsWith('https://www.strava.com/'),
      is_secondary: ride.secondary,
      dual_role: ride.dual_role,
      pm_device: ride.power_meter,
    });
  }
  rideHistory.sort((a, b) => descending(a.date, b.date) || descending(a.id, b.id));

  const fleet = Array.from(fleetTotals, ([name, totals]) => {
    const years = Array.from(totals.years).sort();
    return {
      ...summarize(name, totals),
      elev_per_100k: totals.dist > 0 ? round(totals.elev / (totals.dist / 100), 1) : 0,
      years: years.length ? `${years[0]}–${years.at(-1)}` : '-',
      max_dist: round(totals.maxDist, 1),
    };
  }).sort((a, b) => b.dist - a.dist);

  const byBike = new Map();
  for (const ride of rideHistory) {
    if (!ride.is_secondary) entry(byBike, ride.bike, () => []).push(ride);
  }
  const years = Array.from(yearlyTotals.keys()).sort();
  const latestMonth = rideHistory[0]?.date.slice(0, 7) || `${years.at(-1) ?? ''}-12`;
  const yearly = Object.fromEntries(Array.from(yearlyTotals, ([year, totals]) => [
    year, Array.from(totals, ([name, values]) => summarize(name, values)).sort((a, b) => b.dist - a.dist),
  ]));
  const bikeDetails = Object.assign(Object.create(null), Object.fromEntries(Array.from(fleetTotals.keys(), bike => [
    bike, bikeDetail(bike, byBike.get(bike), years, latestMonth, yearlyTotals, monthly, monthlyHours),
  ])));

  return {
    fleet, yearly, monthly, monthly_hours: monthlyHours, bike_details: bikeDetails, all_rides: rideHistory,
    total_dist: round(sum(fleet.map(bike => bike.dist))),
    total_hours: round(sum(fleet.map(bike => bike.hours))),
    total_rides: fleet.reduce((sum, bike) => sum + bike.rides, 0),
  };
}
