import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {BlobWriter, TextReader, Uint8ArrayReader, ZipReader, ZipWriter} from '@zip.js/zip.js';
import {chromium} from 'playwright';

async function unpackDashboard() {
  const {version} = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const archivePath = new URL(`../artifacts/Tommy-Garage-v${version}.zip`, import.meta.url);
  const zip = new ZipReader(new Uint8ArrayReader(await readFile(archivePath)), {useWebWorkers: false});
  try {
    const entries = await zip.getEntries();
    assert.deepEqual(entries.map(entry => entry.filename), ['Tommy-Garage.html']);
    const html = await entries[0].getData(new BlobWriter(), {checkSignature: true});
    const bytes = Buffer.from(await html.arrayBuffer());
    assert(bytes.equals(await readFile(new URL('../dist/index.html', import.meta.url))));
    return bytes;
  } finally {
    await zip.close();
  }
}

async function fakeStravaArchive() {
  const zip = new ZipWriter(new BlobWriter(), {useWebWorkers: false, zip64: true});
  const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Distance,Moving Time,Bike\n'
    + '1,2025-07-10,Morning ride,Ride,24,3600,42\n'
    + '2,2025-07-11,Lunch jog,Run,5,1800,\n';
  await zip.add('export/activities.csv', new TextReader(csv));
  await zip.add('export/bikes.csv', new TextReader('Bike ID,Bike Name\n42,Demo gravel bike\n'));
  const archive = await zip.close();
  return {name: 'strava.zip', mimeType: 'application/zip', buffer: Buffer.from(await archive.arrayBuffer())};
}

test('the single-file package imports rides and renders charts offline', {timeout: 45000}, async t => {
  const html = await unpackDashboard();
  const directory = await mkdtemp(join(tmpdir(), 'tommy-garage-offline-'));
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  });

  const path = join(directory, 'Tommy-Garage.html');
  await writeFile(path, html);
  browser = await chromium.launch();
  const page = await browser.newPage({offline: true});
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  const networkRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (/^https?:/.test(request.url())) networkRequests.push(request.url());
  });

  await page.goto(pathToFileURL(path).href);
  await page.getByRole('button', {name: 'Wypróbuj demo'}).click();
  assert.equal(await page.locator('#total-rides').textContent(), '60');

  await page.locator('#file-input').setInputFiles(await fakeStravaArchive());
  await page.waitForFunction(() => document.querySelector('#total-rides').textContent === '1');
  assert.equal(await page.locator('#total-distance').textContent(), '24 km');
  assert.equal(await page.locator('#bike-rows button').textContent(), 'Demo gravel bike');

  await page.getByRole('button', {name: 'Szczegóły'}).click();
  await page.locator('#chart-stacked-years canvas').waitFor();
  await page.locator('#btn-tab-records').click();
  assert.match(await page.locator('#rides-table-body').innerText(), /Morning ride/);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(networkRequests, []);
});
