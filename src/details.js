import {UNASSIGNED} from './fleet.js';
import {safeRideUrl} from './imports.js';
import markup from './details.html';

export function getBikeColor(name) {
  if (!name || name === UNASSIGNED) return '#64748b';
  let hash = 0;
  for (const char of name) hash = (Math.imul(31, hash) + char.codePointAt(0)) | 0;
  return `hsl(${Math.abs(hash % 360)}, 70%, 55%)`;
}

export function mountDetails(container, data) {
  const {echarts} = window;
  container.innerHTML = markup;
  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function safeUrl(url) {
    return esc(safeRideUrl(url));
  }

  // State
  let selectedYear = Object.keys(data.yearly).sort().at(-1) ?? '';
  let selectedBike = data.fleet.length > 0 ? data.fleet[0].name : '';
  let bikeChartMode = 'monthly';
  let bikeTimeScope = 'active';
  let overviewMetric = 'km'; // 'km' or 'hours'
  let yearMetric = 'km';     // 'km' or 'hours'
  let bikeMetric = 'km';     // 'km' or 'hours'
  const charts = {};

  function init() {
    // Update Top KPIs
    document.getElementById('kpi-dist').innerText = Number(data.total_dist).toLocaleString('pl-PL') + ' km';
    document.getElementById('kpi-hours').innerText = Number(data.total_hours).toLocaleString('pl-PL') + ' h';
    document.getElementById('kpi-rides').innerText = Number(data.total_rides).toLocaleString('pl-PL');

    if (data.fleet.length > 0) {
      document.getElementById('kpi-topbike').innerText = data.fleet[0].name;
      document.getElementById('kpi-topbike-sub').innerText = Number(data.fleet[0].dist).toLocaleString('pl-PL') + ' km (' + data.fleet[0].rides + ' jazd)';
    }

    // Default to latest year
    const availableYears = Object.keys(data.yearly).sort().reverse();
    if (availableYears.length > 0) {
      selectedYear = availableYears[0];
    }

    renderFleetTable();
    renderYearSelector();
    renderYearlyTab(selectedYear);
    renderBikeSelector();
    renderBikeTab(selectedBike);
    initRidesFilters();
    filterRidesTable();

    renderOverviewCharts();
  }

  function switchTab(tabId) {
    document.querySelectorAll('#details .tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('#details .tab-btn').forEach(el => {
      el.classList.remove('active');
      el.classList.add('text-slate-400');
    });

    document.getElementById(tabId).classList.remove('hidden');
    const btn = document.getElementById('btn-' + tabId);
    btn.classList.add('active');
    btn.classList.remove('text-slate-400');

    if (tabId === 'tab-years') renderYearlyMonthlyChart(selectedYear);
    if (tabId === 'tab-bikes') renderBikeChart();
    if (tabId === 'tab-dynamics') renderDynamics();

    // Resize charts
    setTimeout(() => {
      resize();
    }, 50);
  }

  function renderFleetTable() {
    const tbody = document.getElementById('fleet-table-body');
    tbody.innerHTML = '';
    data.fleet.forEach((b, idx) => {
      const tr = document.createElement('tr');
      tr.className = idx % 2 === 0 ? 'hover:bg-slate-800/40 transition-colors' : 'bg-slate-900/20 hover:bg-slate-800/40 transition-colors';
      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-white flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${getBikeColor(b.name)}"></span>
          ${esc(b.name)}
        </td>
        <td class="py-3 px-4 text-right font-medium text-emerald-400">${Number(b.dist).toLocaleString('pl-PL')}</td>
        <td class="py-3 px-4 text-right text-slate-300">${Number(b.hours).toLocaleString('pl-PL')}</td>
        <td class="py-3 px-4 text-right text-slate-400">${b.rides}</td>
        <td class="py-3 px-4 text-right font-medium text-cyan-400">${b.avg_speed} km/h</td>
        <td class="py-3 px-4 text-right text-amber-400">${b.avg_watts ? b.avg_watts + ' W' : '-'}</td>
        <td class="py-3 px-4 text-right text-rose-400">${b.avg_hr ? b.avg_hr + ' bpm' : '-'}</td>
        <td class="py-3 px-4 text-right text-slate-400">${Number(b.elev).toLocaleString('pl-PL')} m</td>
        <td class="py-3 px-4 text-center text-xs text-slate-400">${esc(b.years)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderYearSelector() {
    const container = document.getElementById('year-selector-pills');
    container.innerHTML = '<span class="text-xs uppercase tracking-wider text-slate-400 font-bold mr-2">Wybierz rok:</span>';

    const years = Object.keys(data.yearly).sort().reverse();
    years.forEach(yr => {
      const pill = document.createElement('button');
      pill.innerText = yr;
      pill.className = `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        yr === selectedYear ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`;
      pill.onclick = () => {
        selectedYear = yr;
        renderYearSelector();
        renderYearlyTab(yr);
      };
      container.appendChild(pill);
    });
  }

  function renderYearlyTab(yr) {
    const bList = data.yearly[yr] || [];
    const totalYrDist = bList.reduce((acc, x) => acc + x.dist, 0);
    const totalYrHours = bList.reduce((acc, x) => acc + x.hours, 0);
    const totalYrRides = bList.reduce((acc, x) => acc + x.rides, 0);
    const avgYrSpeed = totalYrHours > 0 ? (totalYrDist / totalYrHours).toFixed(1) : 0;

    document.getElementById('yr-kpi-title').innerText = `Rok ${yr}`;
    document.getElementById('yr-kpi-dist').innerText = Number(totalYrDist.toFixed(1)).toLocaleString('pl-PL') + ' km';
    document.getElementById('yr-kpi-sub').innerText = `${Number(totalYrHours.toFixed(1))} h w siodle | ${totalYrRides} jazd`;
    document.getElementById('yr-kpi-speed').innerText = `${avgYrSpeed} km/h`;

    if (bList.length > 0) {
      document.getElementById('yr-kpi-topbike').innerText = bList[0].name;
      document.getElementById('yr-kpi-topbike-dist').innerText = `${bList[0].dist.toLocaleString('pl-PL')} km (${((bList[0].dist / totalYrDist)*100).toFixed(0)}% roku)`;
    } else {
      document.getElementById('yr-kpi-topbike').innerText = '-';
      document.getElementById('yr-kpi-topbike-dist').innerText = '-';
    }

    // Table for selected year
    const tbody = document.getElementById('year-table-body');
    tbody.innerHTML = '';
    bList.forEach((b, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition-colors';
      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-white flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${getBikeColor(b.name)}"></span>
          ${esc(b.name)}
        </td>
        <td class="py-3 px-4 text-right font-medium text-emerald-400">${Number(b.dist).toLocaleString('pl-PL')}</td>
        <td class="py-3 px-4 text-right text-slate-300">${Number(b.hours).toLocaleString('pl-PL')}</td>
        <td class="py-3 px-4 text-right text-slate-400">${b.rides}</td>
        <td class="py-3 px-4 text-right font-medium text-cyan-400">${b.avg_speed} km/h</td>
        <td class="py-3 px-4 text-right text-amber-400">${b.avg_watts ? b.avg_watts + ' W' : '-'}</td>
        <td class="py-3 px-4 text-right text-rose-400">${b.avg_hr ? b.avg_hr + ' bpm' : '-'}</td>
        <td class="py-3 px-4 text-right text-slate-400">${Number(b.elev).toLocaleString('pl-PL')} m</td>
      `;
      tbody.appendChild(tr);
    });

    if (charts.yearlyMonthly) renderYearlyMonthlyChart(yr);
  }

  function renderBikeSelector() {
    const container = document.getElementById('bike-selector-pills');
    container.innerHTML = '<span class="text-xs uppercase tracking-wider text-slate-400 font-bold mr-2">Wybierz rower:</span>';

    data.fleet.forEach(b => {
      const pill = document.createElement('button');
      pill.innerHTML = `<span class="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0" style="background-color: ${getBikeColor(b.name)}"></span>${esc(b.name)} <span class="opacity-60 text-[11px] ml-1">(${Math.round(b.dist).toLocaleString('pl-PL')} km)</span>`;
      pill.className = `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-all cursor-pointer ${
        b.name === selectedBike ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`;
      pill.onclick = () => {
        selectedBike = b.name;
        renderBikeSelector();
        renderBikeTab(b.name);
      };
      container.appendChild(pill);
    });
  }

  function renderBikeTab(bname) {
    const bSummary = data.fleet.find(x => x.name === bname) || {};
    const bDet = (data.bike_details && data.bike_details[bname]) ? data.bike_details[bname] : { years: [], monthly_timeline: [], seasonality: [], top_rides: [] };

    // Update KPI Cards
    document.getElementById('bk-kpi-dist').innerText = Number(bSummary.dist || 0).toLocaleString('pl-PL') + ' km';
    document.getElementById('bk-kpi-sub').innerText = `${Number(bSummary.hours || 0).toLocaleString('pl-PL')} h w siodle | ${bSummary.rides || 0} jazd`;

    const speedVal = bSummary.avg_speed ? `${bSummary.avg_speed} km/h` : '-';
    document.getElementById('bk-kpi-speed').innerText = speedVal;
    let powerHrText = [];
    if (bSummary.avg_watts) powerHrText.push(`Śr. moc: ${bSummary.avg_watts} W`);
    if (bSummary.avg_hr) powerHrText.push(`HR: ${bSummary.avg_hr} bpm`);
    document.getElementById('bk-kpi-power').innerText = powerHrText.length > 0 ? powerHrText.join(' | ') : 'Brak danych z czujników';

    document.getElementById('bk-kpi-elev').innerText = Number(bSummary.elev || 0).toLocaleString('pl-PL') + ' m';
    document.getElementById('bk-kpi-elev-sub').innerText = `${bSummary.elev_per_100k || 0} m wzniosu / 100km`;

    document.getElementById('bk-kpi-years').innerText = bSummary.years || '-';
    document.getElementById('bk-kpi-record').innerText = `Najdłuższa trasa: ${bSummary.max_dist || 0} km`;

    // Titles
    document.getElementById('bk-chart-title').innerHTML = `Przebieg w Czasie: <span style="color: ${getBikeColor(bname)}">${esc(bname)}</span>`;
    document.getElementById('bk-table-title').innerText = `Historia Rok po Roku: ${bname}`;

    // Render Yearly Table
    renderBikeYearlyTable();

    // Render Top Rides Table
    renderBikeRecordTable();
  }

  function setBikeTimeScope(scope) {
    bikeTimeScope = scope;
    const btnActive = document.getElementById('btn-bk-scope-active');
    const btnFull = document.getElementById('btn-bk-scope-full');
    const actClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white transition-all shadow-sm cursor-pointer';
    const inactClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer';

    if (btnActive) btnActive.className = (scope === 'active') ? actClass : inactClass;
    if (btnFull) btnFull.className = (scope === 'full') ? actClass : inactClass;

    renderBikeYearlyTable();
    renderBikeChart();
  }

  function renderBikeYearlyTable() {
    const bDet = (data.bike_details && data.bike_details[selectedBike]) ? data.bike_details[selectedBike] : { years: [] };
    const yTbody = document.getElementById('bk-yearly-table-body');
    if (!yTbody) return;
    yTbody.innerHTML = '';

    const yearsToShow = (bikeTimeScope === 'active' && bDet.first_active_year)
      ? bDet.years.filter(y => y.year >= bDet.first_active_year)
      : bDet.years;

    if (!yearsToShow || yearsToShow.length === 0) {
      yTbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-500">Brak danych rocznych</td></tr>';
      return;
    }

    // Display descending (newest year at top)
    const rows = [...yearsToShow].reverse();
    rows.forEach(yr => {
      const tr = document.createElement('tr');
      if (!yr.has_rides || yr.dist === 0) {
        tr.className = 'opacity-40 hover:opacity-80 hover:bg-slate-800/40 transition-all text-slate-400';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-semibold text-slate-400">${esc(yr.year)}</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">0 km</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">0 h</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">0</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">-</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">-</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">-</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">0 m</td>
          <td class="py-2.5 px-4 text-right font-mono text-slate-500">0.0%</td>
        `;
      } else {
        tr.className = 'hover:bg-slate-800/40 transition-colors';
        tr.innerHTML = `
          <td class="py-2.5 px-4 font-bold text-white">${esc(yr.year)}</td>
          <td class="py-2.5 px-4 text-right font-medium text-emerald-400">${Number(yr.dist).toLocaleString('pl-PL')} km</td>
          <td class="py-2.5 px-4 text-right text-slate-300">${Number(yr.hours).toLocaleString('pl-PL')} h</td>
          <td class="py-2.5 px-4 text-right text-slate-400">${yr.rides}</td>
          <td class="py-2.5 px-4 text-right font-medium text-cyan-400">${yr.speed} km/h</td>
          <td class="py-2.5 px-4 text-right text-amber-400">${yr.watts ? yr.watts + ' W' : '-'}</td>
          <td class="py-2.5 px-4 text-right text-rose-400">${yr.hr ? yr.hr + ' bpm' : '-'}</td>
          <td class="py-2.5 px-4 text-right text-slate-400">${Number(yr.elev).toLocaleString('pl-PL')} m</td>
          <td class="py-2.5 px-4 text-right font-semibold text-slate-300">${yr.share}%</td>
        `;
      }
      yTbody.appendChild(tr);
    });
  }

  let bikeRecordMode = 'dist';

  function setBikeRecordMode(mode) {
    bikeRecordMode = mode;

    const btnDist = document.getElementById('bk-btn-dist');
    const btnSpeed = document.getElementById('bk-btn-speed');
    const btnPower = document.getElementById('bk-btn-power');
    const subLabel = document.getElementById('bk-rec-sub');

    const actClass = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all bg-emerald-500 text-white shadow-sm cursor-pointer';
    const inactClass = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-white cursor-pointer';

    if (btnDist) btnDist.className = mode === 'dist' ? actClass : inactClass;
    if (btnSpeed) btnSpeed.className = mode === 'speed' ? actClass : inactClass;
    if (btnPower) btnPower.className = mode === 'power' ? actClass : inactClass;

    if (subLabel) {
      if (mode === 'dist') subLabel.innerText = 'Top 5 najdłuższych dystansów maszyny';
      else if (mode === 'speed') subLabel.innerText = 'Top 5 najszybszych jazd (trasy min. 5 km)';
      else if (mode === 'power') subLabel.innerText = 'Top 5 najwyższych mocy znormalizowanych (NP)';
    }

    renderBikeRecordTable();
  }

  function renderBikeRecordTable() {
    const bDet = (data.bike_details && data.bike_details[selectedBike]) ? data.bike_details[selectedBike] : {};
    const thead = document.getElementById('bk-top-rides-thead');
    const tbody = document.getElementById('bk-top-rides-body');
    if (!thead || !tbody) return;

    let ridesList = [];
    let colHeaders = '';

    if (bikeRecordMode === 'dist') {
      ridesList = bDet.top_dist || bDet.top_rides || [];
      colHeaders = `
        <th class="py-2.5 px-3">Data</th>
        <th class="py-2.5 px-3">Nazwa trasy</th>
        <th class="py-2.5 px-3 text-right">Dystans</th>
        <th class="py-2.5 px-3 text-right">Śr. km/h</th>
        <th class="py-2.5 px-2 text-center w-8">Link</th>
      `;
    } else if (bikeRecordMode === 'speed') {
      ridesList = bDet.top_speed || [];
      colHeaders = `
        <th class="py-2.5 px-3">Data</th>
        <th class="py-2.5 px-3">Nazwa trasy</th>
        <th class="py-2.5 px-3 text-right">Śr. km/h</th>
        <th class="py-2.5 px-3 text-right">Dystans</th>
        <th class="py-2.5 px-2 text-center w-8">Link</th>
      `;
    } else if (bikeRecordMode === 'power') {
      ridesList = bDet.top_power || [];
      colHeaders = `
        <th class="py-2.5 px-3">Data</th>
        <th class="py-2.5 px-3">Nazwa trasy</th>
        <th class="py-2.5 px-3 text-right">Moc NP</th>
        <th class="py-2.5 px-3 text-right">Śr. Moc</th>
        <th class="py-2.5 px-3 text-right">Dystans</th>
        <th class="py-2.5 px-2 text-center w-8">Link</th>
      `;
    }

    thead.innerHTML = colHeaders;
    tbody.innerHTML = '';

    if (!ridesList || ridesList.length === 0) {
      const msg = bikeRecordMode === 'power' ? 'Brak zarejestrowanych pomiarów mocy dla tego roweru' : 'Brak zarejestrowanych tras';
      const cols = bikeRecordMode === 'power' ? 6 : 5;
      tbody.innerHTML = `<tr><td colspan="${cols}" class="py-8 text-center text-slate-500 font-medium">${msg}</td></tr>`;
      return;
    }

    ridesList.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition-colors';

      const validUrl = safeUrl(r.url);
      const stravaBtn = validUrl ? `
        <a href="${validUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center p-1 rounded hover:bg-slate-700/60 text-[#FC4C02] hover:text-[#ff6b2b] transition-all" title="Otwórz na Strava">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.04 13.828h4.169"/></svg>
        </a>
      ` : '';

      const nameLink = validUrl ? `
        <a href="${validUrl}" target="_blank" rel="noopener noreferrer" class="font-medium text-white hover:text-emerald-400 transition-colors truncate max-w-[150px] inline-block" title="${esc(r.name)}">
          ${esc(r.name)}
        </a>
      ` : `<span class="font-medium text-white truncate max-w-[150px] inline-block" title="${esc(r.name)}">${esc(r.name)}</span>`;

      if (bikeRecordMode === 'dist') {
        tr.innerHTML = `
          <td class="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">${esc(r.date)}</td>
          <td class="py-2.5 px-3">${nameLink}</td>
          <td class="py-2.5 px-3 text-right font-bold text-emerald-400">${r.dist} km</td>
          <td class="py-2.5 px-3 text-right text-cyan-400">${r.speed} km/h</td>
          <td class="py-2.5 px-2 text-center">${stravaBtn}</td>
        `;
      } else if (bikeRecordMode === 'speed') {
        tr.innerHTML = `
          <td class="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">${esc(r.date)}</td>
          <td class="py-2.5 px-3">${nameLink}</td>
          <td class="py-2.5 px-3 text-right font-bold text-cyan-400">${r.speed} km/h</td>
          <td class="py-2.5 px-3 text-right text-slate-300">${r.dist} km</td>
          <td class="py-2.5 px-2 text-center">${stravaBtn}</td>
        `;
      } else if (bikeRecordMode === 'power') {
        tr.innerHTML = `
          <td class="py-2.5 px-3 text-slate-400 font-mono whitespace-nowrap">${esc(r.date)}</td>
          <td class="py-2.5 px-3">${nameLink}</td>
          <td class="py-2.5 px-3 text-right font-bold text-amber-400">${r.np} W</td>
          <td class="py-2.5 px-3 text-right text-slate-300">${r.watts ? r.watts + ' W' : '-'}</td>
          <td class="py-2.5 px-3 text-right text-slate-400">${r.dist} km</td>
          <td class="py-2.5 px-2 text-center">${stravaBtn}</td>
        `;
      }

      tbody.appendChild(tr);
    });

    if (charts.bikeDynamic) renderBikeChart();
  }

  function setBikeChartMode(mode) {
    bikeChartMode = mode;
    ['yearly', 'monthly', 'seasonality'].forEach(m => {
      const btn = document.getElementById('btn-bk-mode-' + m);
      if (btn) {
        if (m === mode) {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white transition-all shadow-md shadow-emerald-500/30 cursor-pointer';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer';
        }
      }
    });

    const scopeContainer = document.getElementById('bk-scope-container');
    if (scopeContainer) {
      scopeContainer.style.display = (mode === 'seasonality') ? 'none' : 'flex';
    }

    renderBikeChart();
  }

  function setBikeMetric(metric) {
    bikeMetric = metric;
    const btnKm = document.getElementById('btn-bk-metric-km');
    const btnHours = document.getElementById('btn-bk-metric-hours');
    const actClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white transition-all shadow-sm cursor-pointer';
    const inactClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer';
    if (btnKm) btnKm.className = (metric === 'km') ? actClass : inactClass;
    if (btnHours) btnHours.className = (metric === 'hours') ? actClass : inactClass;
    renderBikeChart();
  }

  function renderBikeChart() {
    if (!charts.bikeDynamic) {
      charts.bikeDynamic = echarts.init(document.getElementById('chart-bike-dynamic'), 'dark');
    }

    const bDet = (data.bike_details && data.bike_details[selectedBike]) ? data.bike_details[selectedBike] : { years: [], monthly_timeline: [], seasonality: [] };
    const bikeColor = getBikeColor(selectedBike);
    const isHours = (bikeMetric === 'hours');
    const unit = isHours ? 'h' : 'km';

    const sub = document.getElementById('bk-chart-subtitle');
    if (sub) {
      if (bikeChartMode === 'yearly') {
        sub.innerText = isHours
          ? 'Roczny czas spędzony w siodle (trendy rok po roku z widocznymi latami 0 h)'
          : 'Przebieg roczny (trendy rok po roku z widocznymi latami 0 km)';
      } else if (bikeChartMode === 'monthly') {
        sub.innerText = isHours
          ? 'Ciągła oś czasu miesiąc po miesiącu w godzinach (z uwzględnieniem przerw zimowych i miesięcy 0 h)'
          : 'Ciągła oś czasu miesiąc po miesiącu w kilometrach (z uwzględnieniem przerw zimowych i miesięcy 0 km)';
      } else if (bikeChartMode === 'seasonality') {
        sub.innerText = isHours
          ? 'Sumaryczny rozkład godzin według miesięcy (Styczeń – Grudzień) we wszystkich latach'
          : 'Sumaryczny rozkład kilometrów według miesięcy (Styczeń – Grudzień) we wszystkich latach';
      }
    }

    let xData = [];
    let yData = [];
    let tooltipFormatter;
    let zoomConfig = [];
    let gridBottom = '10%';

    if (bikeChartMode === 'yearly') {
      const yearsToShow = (bikeTimeScope === 'active' && bDet.first_active_year)
        ? bDet.years.filter(y => y.year >= bDet.first_active_year)
        : bDet.years;

      xData = yearsToShow.map(y => y.year);
      yData = yearsToShow.map(y => isHours ? y.hours : y.dist);
      tooltipFormatter = (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const yrMatch = bDet.years.find(y => y.year === p.name);
        if (!yrMatch || (yrMatch.dist === 0 && yrMatch.hours === 0) || !yrMatch.has_rides) {
          return `<div class="font-bold text-white mb-1">Rok ${p.name}</div>` +
                 `${isHours ? 'Czas: <b class="text-slate-400">0 h</b>' : 'Dystans: <b class="text-slate-400">0 km</b>'} <span class="text-slate-500 text-xs">(brak zarejestrowanych jazd)</span><br/>` +
                 `Udział we flocie: <b>0.0%</b>`;
        }
        const primaryMetricHtml = isHours
          ? `Czas w siodle: <b class="text-emerald-400">${yrMatch.hours.toLocaleString('pl-PL')} h</b><br/>` +
            `Dystans: <b>${yrMatch.dist.toLocaleString('pl-PL')} km</b><br/>`
          : `Dystans: <b class="text-emerald-400">${yrMatch.dist.toLocaleString('pl-PL')} km</b><br/>` +
            `Czas w siodle: <b>${yrMatch.hours} h</b> (${yrMatch.rides} jazd)<br/>`;

        return `<div class="font-bold text-white mb-1">Rok ${yrMatch.year}</div>` +
               primaryMetricHtml +
               `Śr. prędkość: <b>${yrMatch.speed} km/h</b><br/>` +
               (yrMatch.watts ? `Śr. moc: <b>${yrMatch.watts} W</b><br/>` : '') +
               (yrMatch.hr ? `Śr. HR: <b>${yrMatch.hr} bpm</b><br/>` : '') +
               `Udział we flocie: <b>${yrMatch.share}%</b>`;
      };
    } else if (bikeChartMode === 'monthly') {
      const monthsToShow = (bikeTimeScope === 'active' && bDet.first_active_ym)
        ? bDet.monthly_timeline.filter(m => m.ym >= bDet.first_active_ym)
        : bDet.monthly_timeline;

      xData = monthsToShow.map(m => m.ym);
      yData = monthsToShow.map(m => isHours ? m.hours : m.dist);
      tooltipFormatter = (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const val = Number(p.value) || 0;
        if (val === 0) {
          return `<div class="font-bold text-white mb-1">${p.name}</div>` +
                 `${isHours ? 'Czas: <b class="text-slate-400">0 h</b>' : 'Dystans: <b class="text-slate-400">0 km</b>'} <span class="text-slate-500 text-xs">(brak zarejestrowanych jazd)</span>`;
        }
        const mMatch = monthsToShow.find(m => m.ym === p.name);
        return `<div class="font-bold text-white mb-1">${p.name}</div>` +
               (isHours
                 ? `Czas: <b class="text-emerald-400">${val.toLocaleString('pl-PL')} h</b>` + (mMatch ? `<br/>Dystans: <b>${mMatch.dist.toLocaleString('pl-PL')} km</b>` : '')
                 : `Dystans: <b class="text-emerald-400">${val.toLocaleString('pl-PL')} km</b>` + (mMatch ? `<br/>Czas: <b>${mMatch.hours.toLocaleString('pl-PL')} h</b>` : ''));
      };

      if (xData.length > 20) {
        gridBottom = 50;
        zoomConfig = [
          {
            type: 'slider',
            show: true,
            height: 20,
            bottom: 4,
            borderColor: '#334155',
            backgroundColor: '#0f172a',
            fillerColor: 'rgba(16, 185, 129, 0.15)',
            handleStyle: { color: '#10b981', borderColor: '#059669' },
            textStyle: { color: '#94a3b8', fontSize: 10 },
            startValue: Math.max(0, xData.length - 24),
            endValue: xData.length - 1
          },
          {
            type: 'inside'
          }
        ];
      }
    } else if (bikeChartMode === 'seasonality') {
      xData = bDet.seasonality.map(s => s.name);
      yData = bDet.seasonality.map(s => isHours ? s.hours : s.dist);
      tooltipFormatter = (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const val = Number(p.value) || 0;
        if (val === 0) {
          return `<div class="font-bold text-white mb-1">Miesiąc: ${p.name}</div>` +
                 `Łącznie w historii: <b class="text-slate-400">0 ${unit}</b>`;
        }
        const sMatch = bDet.seasonality.find(s => s.name === p.name);
        return `<div class="font-bold text-white mb-1">Miesiąc: ${p.name}</div>` +
               (isHours
                 ? `Łącznie czas: <b class="text-emerald-400">${val.toLocaleString('pl-PL')} h</b>` + (sMatch ? `<br/>Łącznie dystans: <b>${sMatch.dist.toLocaleString('pl-PL')} km</b>` : '')
                 : `Łącznie dystans: <b class="text-emerald-400">${val.toLocaleString('pl-PL')} km</b>` + (sMatch ? `<br/>Łącznie czas: <b>${sMatch.hours.toLocaleString('pl-PL')} h</b>` : ''));
      };
    }

    charts.bikeDynamic.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: tooltipFormatter
      },
      dataZoom: zoomConfig,
      grid: { left: '3%', right: '3%', bottom: gridBottom, top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: {
          fontSize: 11,
          color: '#94a3b8',
          rotate: (bikeChartMode === 'monthly' && xData.length > 15) ? 45 : 0
        }
      },
      yAxis: {
        type: 'value',
        name: unit,
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } }
      },
      series: [{
        name: selectedBike,
        type: 'bar',
        itemStyle: {
          color: bikeColor,
          borderRadius: [6, 6, 0, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: bikeColor
          }
        },
        data: yData
      }]
    }, true);
  }

  function goToRidesWithBike() {
    switchTab('tab-records');
    const yearSelect = document.getElementById('rides-year-select');
    if (yearSelect) yearSelect.value = 'all';
    const bikeSelect = document.getElementById('rides-bike-select');
    if (bikeSelect) bikeSelect.value = selectedBike;
    const searchInput = document.getElementById('rides-search');
    if (searchInput) searchInput.value = '';
    filterRidesTable();
  }

  function setOverviewMetric(metric) {
    overviewMetric = metric;
    const btnKm = document.getElementById('btn-ov-metric-km');
    const btnHours = document.getElementById('btn-ov-metric-hours');
    const actClass = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white transition-all shadow-sm cursor-pointer';
    const inactClass = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer';
    if (btnKm) btnKm.className = (metric === 'km') ? actClass : inactClass;
    if (btnHours) btnHours.className = (metric === 'hours') ? actClass : inactClass;

    const dTitle = document.getElementById('ov-donut-title');
    const dSub = document.getElementById('ov-donut-sub');
    const sTitle = document.getElementById('ov-stacked-title');
    const sSub = document.getElementById('ov-stacked-sub');

    if (metric === 'hours') {
      if (dTitle) dTitle.innerText = 'Udział Rowerów w Czasie';
      if (dSub) dSub.innerText = 'Procentowy podział łącznego czasu w siodle całej floty';
      if (sTitle) sTitle.innerText = 'Ewolucja floty w czasie';
      if (sSub) sSub.innerText = 'Godziny w siodle rok po roku z podziałem na poszczególne maszyny';
    } else {
      if (dTitle) dTitle.innerText = 'Udział Rowerów w Kilometrach';
      if (dSub) dSub.innerText = 'Procentowy podział łącznego dystansu całej floty';
      if (sTitle) sTitle.innerText = 'Ewolucja floty w latach';
      if (sSub) sSub.innerText = 'Kilometry wykręcone rok po roku z podziałem na poszczególne maszyny';
    }

    renderOverviewCharts();
  }

  function renderOverviewCharts() {
    const isHours = (overviewMetric === 'hours');
    const unit = isHours ? 'h' : 'km';

    // 1. Donut Chart
    if (!charts.donut) {
      charts.donut = echarts.init(document.getElementById('chart-donut'), 'dark');
    }
    const metric = isHours ? 'hours' : 'dist';
    const activeBikes = data.fleet.filter(bike => bike[metric] > 0);
    const threshold = isHours ? 5 : 100;
    const majorBikes = activeBikes.filter(bike => bike[metric] > threshold);
    const donutData = (majorBikes.length ? majorBikes : activeBikes)
      .map(x => ({
        value: isHours ? x.hours : x.dist,
        name: x.name,
        itemStyle: { color: getBikeColor(x.name) }
      }));

    charts.donut.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: point => `${esc(point.name)}: ${point.value} ${unit} (${point.percent}%)`
      },
      color: donutData.map(x => getBikeColor(x.name)),
      series: [{
        type: 'pie',
        radius: ['45%', '75%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#0f172a', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
        data: donutData
      }]
    }, true);

    // 2. Stacked Bar Chart (Evolution)
    if (!charts.stacked) {
      charts.stacked = echarts.init(document.getElementById('chart-stacked-years'), 'dark');
    }
    const allYears = Object.keys(data.yearly).sort();
    const assignedBikes = data.fleet.filter(bike => bike.name !== UNASSIGNED);
    const highMileage = assignedBikes.filter(bike => bike.dist > 400 || bike.hours > 15);
    const topBikes = (highMileage.length ? highMileage : assignedBikes).map(bike => bike.name);

    const series = topBikes.map(bname => ({
      name: bname,
      type: 'bar',
      stack: 'total',
      itemStyle: { color: getBikeColor(bname) },
      emphasis: { focus: 'series' },
      data: allYears.map(yr => {
        const match = (data.yearly[yr] || []).find(b => b.name === bname);
        if (!match) return 0;
        return isHours ? match.hours : match.dist;
      })
    }));

    charts.stacked.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (val) => (val !== undefined && val !== null ? val + ' ' + unit : '-')
      },
      legend: { top: '0', textStyle: { color: '#94a3b8', fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: allYears, axisLine: { lineStyle: { color: '#334155' } } },
      yAxis: {
        type: 'value',
        name: unit,
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } }
      },
      color: topBikes.map(b => getBikeColor(b)),
      series: series
    }, true);
  }

  function renderDynamics() {
    if (charts.scatter) return;

    // 3. Scatter Plot: Speed vs Power
    charts.scatter = echarts.init(document.getElementById('chart-scatter-power'), 'dark');
    const scatterData = data.fleet.filter(x => x.avg_watts && x.avg_speed > 0).map(x => ({
      value: [x.avg_speed, x.avg_watts, x.dist, x.name],
      itemStyle: { color: getBikeColor(x.name), borderColor: '#ffffff', borderWidth: 1 }
    }));

    charts.scatter.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        formatter: function (param) {
          const val = param.data.value || param.data;
          return `<div class="font-bold">${esc(val[3])}</div>` +
                 `Śr. Prędkość: <b>${val[0]} km/h</b><br/>` +
                 `Śr. Moc: <b>${val[1]} W</b><br/>` +
                 `Przebieg: <b>${val[2].toLocaleString('pl-PL')} km</b>`;
        }
      },
      grid: { left: '5%', right: '5%', bottom: '8%', top: '8%', containLabel: true },
      xAxis: { name: 'km/h', nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { name: 'Waty', nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: [{
        type: 'scatter',
        symbolSize: function (val) {
          const d = Array.isArray(val) ? val[2] : (val && val.value ? val.value[2] : 100);
          return Math.max(16, Math.min(60, Math.sqrt(d) / 2.5));
        },
        data: scatterData
      }]
    });

    // 4. Bar: Elevation per 100km
    charts.elev = echarts.init(document.getElementById('chart-elev-density'), 'dark');
    const withDistance = data.fleet.filter(bike => bike.dist > 0 && bike.name !== UNASSIGNED);
    const highMileage = withDistance.filter(bike => bike.dist > 500);
    const elevData = (highMileage.length ? highMileage : withDistance).map(x => ({
      name: x.name,
      value: x.elev_per_100k,
      itemStyle: { color: getBikeColor(x.name), borderRadius: [0, 6, 6, 0] }
    })).sort((a,b) => a.value - b.value);

    charts.elev.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', formatter: ([point]) => point ? `${esc(point.name)}: ${point.value} m / 100 km` : '' },
      grid: { left: '4%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: { type: 'value', name: 'm / 100km', splitLine: { lineStyle: { color: '#1e293b' } } },
      yAxis: { type: 'category', data: elevData.map(x => x.name), axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar',
        data: elevData
      }]
    });

  }

  function setYearMetric(metric) {
    yearMetric = metric;
    const btnKm = document.getElementById('btn-yr-metric-km');
    const btnHours = document.getElementById('btn-yr-metric-hours');
    const actClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white transition-all shadow-sm cursor-pointer';
    const inactClass = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer';
    if (btnKm) btnKm.className = (metric === 'km') ? actClass : inactClass;
    if (btnHours) btnHours.className = (metric === 'hours') ? actClass : inactClass;

    renderYearlyMonthlyChart(selectedYear);
  }

  function renderYearlyMonthlyChart(yr) {
    if (!charts.yearlyMonthly) {
      charts.yearlyMonthly = echarts.init(document.getElementById('chart-yearly-monthly'), 'dark');
    }

    const isHours = (yearMetric === 'hours');
    const unit = isHours ? 'h' : 'km';

    const title = document.getElementById('yr-chart-title');
    const sub = document.getElementById('yr-chart-sub');
    if (isHours) {
      if (title) title.innerText = 'Czas w Siodle Miesiąc po Miesiącu';
      if (sub) sub.innerText = 'Rozkład godzin na rowery w roku ' + yr;
    } else {
      if (title) title.innerText = 'Przebieg Miesiąc po Miesiącu';
      if (sub) sub.innerText = 'Rozkład kilometrów na rowery w roku ' + yr;
    }

    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    const yrBikes = (data.yearly[yr] || [])
      .filter(x => (isHours ? (x.hours || 0) : (x.dist || 0)) > 0)
      .map(x => x.name);

    const yrMonthData = (isHours ? (data.monthly_hours && data.monthly_hours[yr]) : (data.monthly && data.monthly[yr])) || {};

    const series = yrBikes.map(bname => ({
      name: bname,
      type: 'bar',
      stack: 'monthly',
      itemStyle: { color: getBikeColor(bname) },
      emphasis: { focus: 'series' },
      data: months.map(m => {
        const mDict = yrMonthData[m] || {};
        const val = mDict[bname] || 0;
        return isHours ? Math.round(val * 10) / 10 : Math.round(val);
      })
    }));

    charts.yearlyMonthly.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (val) => (val !== undefined && val !== null ? val + ' ' + unit : '-')
      },
      legend: { top: '0', textStyle: { color: '#94a3b8', fontSize: 11 } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '18%', containLabel: true },
      xAxis: { type: 'category', data: monthNames, axisLine: { lineStyle: { color: '#334155' } } },
      yAxis: { type: 'value', name: unit, splitLine: { lineStyle: { color: '#1e293b' } } },
      color: yrBikes.map(b => getBikeColor(b)),
      series: series
    }, true);
  }

  function initRidesFilters() {
    const yearSelect = document.getElementById('rides-year-select');
    yearSelect.innerHTML = '';

    const optAllYears = document.createElement('option');
    optAllYears.value = 'all';
    optAllYears.textContent = 'Wszystkie lata';
    yearSelect.appendChild(optAllYears);

    const availableYears = Array.from(new Set(data.all_rides.map(ride => ride.year).filter(Boolean))).sort().reverse();
    availableYears.forEach(yr => {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === selectedYear) opt.selected = true;
      yearSelect.appendChild(opt);
    });

    const bikeSelect = document.getElementById('rides-bike-select');
    bikeSelect.innerHTML = '';

    const optAllBikes = document.createElement('option');
    optAllBikes.value = '';
    optAllBikes.textContent = 'Wszystkie rowery';
    bikeSelect.appendChild(optAllBikes);

    for (const name of new Set(data.all_rides.map(ride => ride.bike))) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bikeSelect.appendChild(opt);
    }
  }

  function renderRidesTable(rides) {
    const tbody = document.getElementById('rides-table-body');
    tbody.innerHTML = '';

    if (rides.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="py-12 text-center text-slate-500 font-medium">Brak jazd spełniających wybrane kryteria</td></tr>';
      return;
    }

    rides.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition-colors text-xs';

      const validUrl = safeUrl(r.url);
      const stravaIcon = validUrl ? `
        <a href="${validUrl}" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-[#FC4C02] transition-colors p-0.5 inline-flex items-center flex-shrink-0" title="Otwórz na Strava">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.04 13.828h4.169"/></svg>
        </a>
      ` : '';

      const nameLink = validUrl ? `
        <a href="${validUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-emerald-400 transition-colors truncate block" title="${esc(r.name)}">
          ${esc(r.name)}
        </a>
      ` : `<span class="truncate block" title="${esc(r.name)}">${esc(r.name)}</span>`;

      let powerText = '-';
      if (r.np && r.watts) {
        powerText = `<span title="Moc NP: ${r.np} W | Średnia: ${r.watts} W">${r.np} W <span class="text-[10px] text-amber-500 font-normal">NP</span></span>`;
      } else if (r.np) {
        powerText = `<span title="Moc znormalizowana (NP)">${r.np} W <span class="text-[10px] text-amber-500 font-normal">NP</span></span>`;
      } else if (r.watts) {
        powerText = `${r.watts} W`;
      }

      const dualBadge = r.is_secondary ? `
        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex-shrink-0" title="Zapis pomocniczy z testu miernika mocy (${esc(r.pm_device || 'miernik pomocniczy')}) – wykluczony ze statystyk floty">Dual Test</span>
      ` : (r.dual_role === 'primary' ? `
        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0" title="Główny zapis z sesji testowej (${esc(r.pm_device || 'miernik główny')})">Dual Prim</span>
      ` : '');

      const distClass = r.is_secondary ? 'text-purple-300/80 font-mono' : 'font-semibold text-emerald-400';
      const distTitle = r.is_secondary ? ' title="Zapis pomocniczy (wykluczony ze statystyk floty)"' : '';

      tr.innerHTML = `
        <td class="py-2.5 px-4 whitespace-nowrap text-slate-400 font-mono">${esc(r.date)}</td>
        <td class="py-2.5 px-4 font-medium text-white max-w-xs">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="truncate">${nameLink}</span>
            ${dualBadge}
            ${stravaIcon}
          </div>
        </td>
        <td class="py-2.5 px-4 text-slate-300 font-semibold truncate max-w-[180px]">
          <span class="inline-block w-2 h-2 rounded-full mr-1.5 flex-shrink-0" style="background-color: ${getBikeColor(r.bike)}"></span>
          ${esc(r.bike)}
        </td>
        <td class="py-2.5 px-4 text-right ${distClass}"${distTitle}>${r.dist} km</td>
        <td class="py-2.5 px-4 text-right text-slate-400">${r.time_h} h</td>
        <td class="py-2.5 px-4 text-right text-cyan-400">${r.speed} km/h</td>
        <td class="py-2.5 px-4 text-right text-amber-400">${powerText}</td>
        <td class="py-2.5 px-4 text-right text-rose-400">${r.hr ? r.hr + ' bpm' : '-'}</td>
        <td class="py-2.5 px-4 text-right text-slate-400">${r.elev} m</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function filterRidesTable() {
    const yearVal = document.getElementById('rides-year-select').value;
    const bikeVal = document.getElementById('rides-bike-select').value;
    const q = document.getElementById('rides-search').value.toLowerCase().trim();

    const filtered = data.all_rides.filter(r => {
      if (yearVal !== 'all') {
        if (r.year !== yearVal && !r.date.startsWith(yearVal)) return false;
      }
      if (bikeVal !== '') {
        if (r.bike !== bikeVal) return false;
      }
      if (q) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchBike = r.bike.toLowerCase().includes(q);
        const matchDate = r.date.includes(q);
        if (!matchName && !matchBike && !matchDate) return false;
      }
      return true;
    });

    const badge = document.getElementById('rides-count-badge');
    if (badge) {
      let label = `${filtered.length.toLocaleString('pl-PL')} jazd`;
      if (yearVal !== 'all') label += ` w ${yearVal} r.`;
      if (bikeVal !== '') label += ` (${bikeVal})`;
      badge.innerText = label;
    }

    renderRidesTable(filtered);
  }

  function resize() {
    for (const chart of Object.values(charts)) {
      if (!chart.isDisposed() && chart.getDom().clientWidth) chart.resize();
    }
  }

  const handlers = {
    switchTab, setOverviewMetric, setYearMetric, setBikeTimeScope, setBikeChartMode,
    setBikeMetric, setBikeRecordMode, goToRidesWithBike, filterRidesTable,
  };
  for (const control of container.querySelectorAll('[data-handler]')) {
    const {event, handler, argument} = control.dataset;
    control.addEventListener(event, () => handlers[handler](argument));
  }
  init();
  window.addEventListener('resize', resize);
  return {
    resize,
    showBike(name) {
      selectedBike = name;
      renderBikeSelector();
      switchTab('tab-bikes');
      renderBikeTab(name);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      for (const chart of Object.values(charts)) chart.dispose();
      container.replaceChildren();
    },
  };
}
