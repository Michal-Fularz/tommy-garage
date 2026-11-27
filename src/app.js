import {getBikeColor, mountDetails} from './details.js';
import {demoRides} from './demo.js';
import {UNASSIGNED, summarizeFleet} from './fleet.js';
import {importRides, RideImportError} from './imports.js';

const element = id => document.getElementById(id);
const fileInput = element('file-input');
const status = element('import-status');
const overview = element('overview');
const details = element('details');
const pickFile = element('pick-file');
const changeFile = element('change-file');
const simpleView = element('simple-view');
const detailedView = element('detailed-view');
const integer = new Intl.NumberFormat('pl-PL', {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat('pl-PL', {maximumFractionDigits: 1});
let data;
let mounted;

function selectView(view) {
  const detailed = view === 'details';
  overview.hidden = detailed;
  details.hidden = !detailed;
  simpleView.setAttribute('aria-pressed', String(!detailed));
  detailedView.setAttribute('aria-pressed', String(detailed));
  if (detailed) {
    mounted ??= mountDetails(details, data);
    mounted.resize();
  }
}

function renderOverview(payload, sourceName) {
  const {fleet, all_rides: history} = payload;
  element('source-name').textContent = sourceName;
  const first = history.at(-1)?.year;
  const last = history[0]?.year;
  element('date-range').textContent = first && last && first !== last ? `${first}–${last}` : (last ?? '');
  element('total-distance').textContent = `${integer.format(payload.total_dist)} km`;
  element('total-hours').textContent = `${integer.format(payload.total_hours)} h`;
  element('total-rides').textContent = integer.format(payload.total_rides);
  element('unassigned-note').hidden = !fleet.some(bike => bike.name === UNASSIGNED);
  const rows = element('bike-rows');
  rows.replaceChildren();
  for (const bike of fleet) {
    const row = rows.insertRow();
    const title = document.createElement('button');
    title.type = 'button';
    title.textContent = bike.name;
    title.addEventListener('click', () => {
      selectView('details');
      mounted.showBike(bike.name);
      element('btn-tab-bikes').focus();
    });
    const cell = row.insertCell();
    cell.append(title);
    const bar = document.createElement('span');
    bar.className = 'bike-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.setProperty('--bike-color', getBikeColor(bike.name));
    const progress = document.createElement('progress');
    progress.max = fleet[0].dist || 1;
    progress.value = bike.dist;
    bar.append(progress);
    cell.append(bar);
    row.insertCell().textContent = `${decimal.format(bike.dist)} km`;
    row.insertCell().textContent = `${decimal.format(bike.hours)} h`;
    row.insertCell().textContent = integer.format(bike.rides);
  }
}

function showRides(result, sourceName) {
  const summary = summarizeFleet(result.rides);
  if (!summary.total_rides) throw new RideImportError('W pliku nie ma jazd rowerowych z dystansem lub czasem.');
  mounted?.dispose();
  mounted = undefined;
  data = summary;
  renderOverview(summary, sourceName);
  element('import-panel').hidden = true;
  element('dashboard-actions').hidden = false;
  selectView('overview');
  const missing = result.skipped + result.rides.length - summary.all_rides.length;
  setStatus(missing ? `Pominięte rekordy jazd (${integer.format(missing)}) zawierały niepełne, powielone lub niewiarygodne dane.` : '');
  element('overview-title').focus();
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.hidden = !message;
  status.toggleAttribute('data-error', error);
}

async function loadFile(file) {
  pickFile.disabled = true;
  changeFile.disabled = true;
  element('load-demo').disabled = true;
  setStatus('Odczytuję plik…');
  try {
    showRides(await importRides(file), file.name);
  } catch (error) {
    let message = 'Nie udało się odczytać pliku. Spróbuj wybrać activities.csv bezpośrednio.';
    if (error instanceof SyntaxError) message = 'Plik JSON jest uszkodzony.';
    if (error instanceof RideImportError) message = error.message;
    setStatus(message, true);
  } finally {
    fileInput.value = '';
    pickFile.disabled = false;
    changeFile.disabled = false;
    element('load-demo').disabled = false;
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFile(fileInput.files[0]);
});
pickFile.addEventListener('click', () => fileInput.click());
changeFile.addEventListener('click', () => fileInput.click());
simpleView.addEventListener('click', () => selectView('overview'));
detailedView.addEventListener('click', () => selectView('details'));
element('load-demo').addEventListener('click', () => showRides({rides: demoRides, skipped: 0}, 'Dane demonstracyjne'));
