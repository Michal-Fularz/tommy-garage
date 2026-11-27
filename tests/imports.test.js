import assert from 'node:assert/strict';
import test from 'node:test';
import {BlobWriter, TextReader, ZipWriter} from '@zip.js/zip.js';
import {importRides, parseRideFile, parseStravaCsv, safeRideUrl} from '../src/imports.js';

const activityCsv = [
  'Activity ID,Activity Date,Activity Name,Activity Type,Distance,Activity Gear,Moving Time,Distance,Bike,Average Watts',
  '1,"Jan 4, 2025, 9:21:00 AM","Coffee, Cake",Ride,28.01,"Blue Bike",3600,28015,123,254',
  '2,"Feb 13, 2025, 6:00:00 PM",Trainer,Virtual Ride,0,,1800,0,b003,0',
  '3,2025-05-02,Ride,E-Bike Ride,20.50,,1800,,,',
  '4,2025-05-03,Jog,Run,5.00,,800,5000,,',
  '3,2025-05-02,Duplicate,E-Bike Ride,20.50,,1800,,,',
  '5,2025-02-30,Invalid,Ride,15,,1800,15000,,',
].join('\r\n');
const bikesCsv = 'Bike ID,Bike Name\n003,"Trainer 3"\n';

test('Strava imports the precise distance, labels bikes and counts invalid cycling rows', () => {
  const {rides, skipped} = parseStravaCsv(activityCsv, bikesCsv);
  assert.equal(skipped, 2);
  assert.equal(rides.length, 3);
  assert.deepEqual(rides.map(ride => ride.date), ['2025-01-04', '2025-02-13', '2025-05-02']);
  assert.deepEqual(rides.map(ride => ride.distance_m), [28015, 0, 20500]);
  assert.deepEqual(rides.map(ride => ride.bike), ['Blue Bike', 'Trainer 3', null]);
  assert.deepEqual(rides.map(ride => ride.watts), [254, null, null]);
  assert.equal(rides[0].name, 'Coffee, Cake');
  assert.equal(rides[0].url, 'https://www.strava.com/activities/1');
});

test('imports Polish dates and localized decimals', () => {
  const csv = 'Identyfikator aktywności;Data aktywności;Rodzaj aktywności;Dystans;Czas ruchu\n'
    + '7;2 paź 2025, 8:21:00;Jazda na rowerze elektrycznym;40,25;01:52:00';
  const {rides: [ride]} = parseStravaCsv(csv);
  assert.equal(ride.date, '2025-10-02');
  assert.equal(ride.distance_m, 40250);
  assert.equal(ride.moving_seconds, 6720);
});

test('reads a ZIP64 archive with nested CSVs and ignores unrelated records', async () => {
  const archive = new ZipWriter(new BlobWriter(), {useWebWorkers: false, zip64: true});
  await archive.add('export/activities.csv', new TextReader(activityCsv));
  await archive.add('export/bikes.csv', new TextReader(bikesCsv));
  await archive.add('export/activities/example.fit', new TextReader('ignored'));
  const file = new File([await archive.close()], 'strava.zip');
  const {rides} = await importRides(file);
  assert.equal(rides.length, 3);
  assert.equal(rides[1].bike, 'Trainer 3');
});

test('validates the ride format and uses only known activity URLs', () => {
  assert.throws(() => parseRideFile('{"rides":[]}'), /wersji 1/);
  assert.equal(safeRideUrl('https://intervals.icu/activities/i991'), 'https://intervals.icu/activities/i991');
  assert.equal(safeRideUrl('javascript:alert(1)'), '');
  assert.equal(safeRideUrl('https://www.strava.com.attacker.test/activities/1'), '');
  assert.equal(safeRideUrl('https://www.strava.com/activities/1?param=a'), '');
  const payload = {format: 'tommy-garage-rides', version: 1, rides: [{
    id: 'test', date: '2025-10-04T16:35:00', bike: '__proto__', name: 'Gravel ',
    distance_m: 1000, moving_seconds: 200, url: 'javascript:alert(1)', secondary: true,
  }]};
  const {rides: [ride]} = parseRideFile(JSON.stringify(payload));
  assert.equal(ride.date, '2025-10-04');
  assert.equal(ride.bike, '__proto__');
  assert.equal(ride.name, 'Gravel ');
  assert.equal(ride.url, '');
  assert.equal(ride.secondary, true);
});
