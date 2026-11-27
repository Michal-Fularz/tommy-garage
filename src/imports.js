import {BlobReader, TextWriter, ZipReader} from '@zip.js/zip.js';
import Papa from 'papaparse';

export class RideImportError extends Error {}

const MAX_DATA_BYTES = 32 * 1024 * 1024;
const PL_MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const cyclingTypes = new Set([
  'ride', 'bikeride', 'cycling', 'gravelride', 'mountainbikeride', 'ebikeride', 'emountainbikeride',
  'virtualride', 'handcycle', 'velomobile', 'jazda', 'jazdanarowerze', 'jazdawirtualna',
  'jazdanarowerzeelektrycznym', 'jazdagravelowa', 'jazdanarowerzegórskim',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let cleaned = text(value).replace(/\s/g, '');
  if (!cleaned) return null;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replaceAll('.', '').replace(',', '.') : cleaned.replaceAll(',', '');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  if (!/^[+-]?\d*(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value) {
  const result = number(value);
  return result > 0 ? result : null;
}

function parseDuration(value) {
  const parts = text(value).split(':');
  if (parts.length < 2) return positive(value);
  if (parts.length > 3 || parts.some(part => !/^\d+(?:[.,]\d+)?$/.test(part))) return null;
  return parts.reduce((seconds, part) => seconds * 60 + number(part), 0);
}

export function safeRideUrl(value) {
  const url = text(value);
  return /^https:\/\/(?:www\.strava\.com|intervals\.icu)\/activities\/[a-z0-9_-]+\/?$/i.test(url) ? url : '';
}

function rideDate(value) {
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  const en = raw.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:$|[, ])/i);
  const pl = raw.match(/^(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})(?:$|[, ])/iu);
  let year;
  let month;
  let day;
  if (iso) {
    [, year, month, day] = iso;
  } else if (en) {
    year = en[3];
    month = EN_MONTHS.indexOf(en[1].slice(0, 3).toLowerCase()) + 1;
    day = en[2];
  } else if (pl) {
    year = pl[3];
    month = PL_MONTHS.indexOf(pl[2].slice(0, 3).toLowerCase()) + 1;
    day = pl[1];
  } else {
    return '';
  }
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== date ? '' : date;
}

function csvRows(csv) {
  const {data, errors} = Papa.parse(csv, {skipEmptyLines: 'greedy'});
  if (errors.some(error => error.type !== 'Delimiter')) throw new RideImportError('Ten plik CSV jest uszkodzony.');
  const [headers = [], ...rows] = data;
  return {headers: headers.map(value => text(value).toLowerCase()), rows};
}

function indexes(headers, ...names) {
  return headers.flatMap((name, index) => names.includes(name) ? [index] : []);
}

function label(value) {
  return value && !/^(?:none|\(none\)|null|-|—|n\/a)$/i.test(value) ? value : null;
}

function bikeMappings(csv) {
  const {headers, rows} = csvRows(csv);
  const id = indexes(headers, 'id', 'bike id', 'gear id', 'identyfikator roweru')[0];
  const name = indexes(headers, 'bike name', 'name', 'nazwa roweru')[0];
  if (id === undefined || name === undefined) return new Map();
  return new Map(rows.map(row => [text(row[id]).replace(/^b(?=\d)/i, ''), text(row[name])]));
}

export function parseStravaCsv(activityCsv, bikesCsv = '') {
  const {headers, rows} = csvRows(activityCsv);
  const columns = {
    id: indexes(headers, 'activity id', 'identyfikator aktywności'),
    date: indexes(headers, 'activity date', 'data aktywności'),
    name: indexes(headers, 'activity name', 'nazwa aktywności'),
    type: indexes(headers, 'activity type', 'rodzaj aktywności', 'typ aktywności'),
    gear: indexes(headers, 'activity gear', 'sprzęt do aktywności fizycznej'),
    bike: indexes(headers, 'bike', 'rower'),
    dist: indexes(headers, 'distance', 'dystans'),
    distM: indexes(headers, 'distance (m)', 'dystans (m)'),
    moving: indexes(headers, 'moving time', 'czas ruchu', 'czas w ruchu'),
    elapsed: indexes(headers, 'elapsed time', 'czas trwania'),
    elev: indexes(headers, 'elevation gain', 'wznios', 'przewyższenie'),
    watts: indexes(headers, 'average watts', 'średnia moc'),
    np: indexes(headers, 'weighted average power', 'średnia ważona moc', 'ważona średnia moc'),
    hr: indexes(headers, 'average heart rate', 'średnie tętno'),
  };
  if (!columns.date.length || !columns.type.length || !(columns.dist.length || columns.distM.length)) {
    throw new RideImportError('Wybierz plik activities.csv z archiwum Stravy.');
  }

  const namesById = bikesCsv ? bikeMappings(bikesCsv) : new Map();
  const rides = [];
  const seen = new Set();
  let skipped = 0;
  for (const [index, row] of rows.entries()) {
    const get = key => text(row[columns[key][0]]);
    const type = get('type').toLowerCase().replace(/[\s_-]/g, '');
    if (!cyclingTypes.has(type)) continue;
    const date = rideDate(get('date'));
    const id = get('id') || `csv-${index + 2}`;
    // Strava exports a display distance in km followed by a more precise distance in m.
    const precise = positive(get('distM')) ?? (columns.dist.length > 1 ? positive(row[columns.dist.at(-1)]) : null);
    const distance = precise ?? (positive(get('dist')) ?? 0) * 1000;
    const moving = parseDuration(get('moving')) ?? parseDuration(row[columns.elapsed.at(-1)]) ?? 0;
    if (!date || seen.has(id) || (!distance && !moving)) {
      skipped += 1;
      continue;
    }
    seen.add(id);
    const bikeValue = get('bike');
    const gear = get('gear');
    const bikeId = bikeValue.match(/^b?(\d+)$/i)?.[1];
    const bike = label(gear) || (bikeId ? namesById.get(bikeId) || `Rower #${bikeId}` : label(bikeValue));
    rides.push({
      id, date, bike, name: get('name'), distance_m: distance, moving_seconds: moving,
      elevation_m: number(get('elev')) ?? 0,
      watts: positive(get('watts')), normalized_watts: positive(get('np')), heart_rate: positive(get('hr')),
      url: /^\d+$/.test(id) ? `https://www.strava.com/activities/${id}` : '',
      secondary: false, dual_role: null, power_meter: null,
    });
  }
  rides.sort((a, b) => a.date.localeCompare(b.date));
  return {rides, skipped};
}

export function parseRideFile(source) {
  const payload = JSON.parse(source);
  if (payload?.format !== 'tommy-garage-rides' || payload.version !== 1 || !Array.isArray(payload.rides)) {
    throw new RideImportError('Wybierz eksport jazd Tommy’s Garage w wersji 1.');
  }
  const rides = payload.rides.map((ride, index) => {
    if (!ride || typeof ride !== 'object' || Array.isArray(ride)) throw new RideImportError('Plik zawiera błędny rekord jazdy.');
    return {
      id: text(ride.id) || `ride-${index + 1}`,
      date: rideDate(ride.date),
      name: typeof ride.name === 'string' ? ride.name : '',
      bike: typeof ride.bike === 'string' ? ride.bike : null,
      distance_m: positive(ride.distance_m) ?? 0,
      moving_seconds: positive(ride.moving_seconds) ?? 0,
      elevation_m: number(ride.elevation_m) ?? 0,
      watts: positive(ride.watts),
      normalized_watts: positive(ride.normalized_watts),
      heart_rate: positive(ride.heart_rate),
      url: safeRideUrl(ride.url),
      secondary: ride.secondary === true,
      dual_role: text(ride.dual_role) || null,
      power_meter: text(ride.power_meter) || null,
    };
  });
  return {rides, skipped: 0};
}

async function importArchive(file) {
  const zip = new ZipReader(new BlobReader(file), {useWebWorkers: false});
  try {
    const entries = await zip.getEntries();
    const csv = name => entries.find(entry => !entry.directory && entry.filename.split('/').at(-1).toLowerCase() === name);
    const activities = csv('activities.csv');
    if (!activities) throw new RideImportError('W archiwum brakuje pliku activities.csv.');
    const bikes = csv('bikes.csv');
    const read = async entry => {
      if (!entry) return '';
      if (entry.uncompressedSize > MAX_DATA_BYTES) throw new RideImportError('Plik CSV w archiwum jest za duży.');
      return entry.getData(new TextWriter(), {checkSignature: true});
    };
    return parseStravaCsv(await read(activities), await read(bikes));
  } finally {
    await zip.close();
  }
}

export async function importRides(file) {
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (extension === 'zip') return importArchive(file);
  if (!['csv', 'json'].includes(extension)) throw new RideImportError('Obsługiwane pliki to ZIP, CSV i JSON.');
  if (file.size > MAX_DATA_BYTES) throw new RideImportError('Plik jest za duży.');
  const source = await file.text();
  return extension === 'json' ? parseRideFile(source) : parseStravaCsv(source);
}
