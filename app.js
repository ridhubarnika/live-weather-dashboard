// ═══════════════════════════════════════════════════════
//  Live Weather Dashboard  –  app.js
//  Requirements covered:
//    1. Geolocation API
//    2. Fetch from Open-Meteo
//    3. Dynamic weather icons & card background
//    4. 7-day forecast grid with CSS-transition expand
//    5. Canvas 24-hour temperature chart (NO Chart.js)
//    6. City search with Geocoding API + debounce
//    7. Responsive layout (CSS) + resize listener (clamp)
// ═══════════════════════════════════════════════════════

// ── API Base URLs ────────────────────────────────────────
const BASE       = 'https://api.open-meteo.com/v1/forecast';
const GEO_BASE   = 'https://geocoding-api.open-meteo.com/v1/search';

// ── Default fallback city (Mumbai) – Requirement 1 ──────
const DEFAULT_LAT  = 19.076;
const DEFAULT_LON  = 72.877;
const DEFAULT_CITY = 'Mumbai';

// ── WMO Weather Code Mapping – Requirement 3 ────────────
const CODES = {
  0:  { label: 'Clear sky',        icon: '☀️',  bg: 'clear'   },
  1:  { label: 'Mainly clear',     icon: '🌤️',  bg: 'clear'   },
  2:  { label: 'Partly cloudy',    icon: '⛅',  bg: 'clouds'  },
  3:  { label: 'Overcast',         icon: '☁️',  bg: 'clouds'  },
  45: { label: 'Foggy',            icon: '🌫️',  bg: 'clouds'  },
  48: { label: 'Icy fog',          icon: '🌫️',  bg: 'clouds'  },
  51: { label: 'Light drizzle',    icon: '🌦️',  bg: 'rain'    },
  53: { label: 'Drizzle',          icon: '🌧️',  bg: 'rain'    },
  55: { label: 'Heavy drizzle',    icon: '🌧️',  bg: 'rain'    },
  61: { label: 'Slight rain',      icon: '🌧️',  bg: 'rain'    },
  63: { label: 'Rain',             icon: '🌧️',  bg: 'rain'    },
  65: { label: 'Heavy rain',       icon: '🌧️',  bg: 'rain'    },
  71: { label: 'Light snow',       icon: '🌨️',  bg: 'clouds'  },
  80: { label: 'Rain showers',     icon: '🌦️',  bg: 'rain'    },
  95: { label: 'Thunderstorm',     icon: '⛈️',  bg: 'thunder' },
  99: { label: 'Heavy thunderstorm',icon: '🌩️', bg: 'thunder' },
};

function getCode(code) {
  return CODES[code] || { label: 'Unknown', icon: '🌡️', bg: 'clouds' };
}

// ── DOM References ───────────────────────────────────────
const spinner       = document.getElementById('spinner');
const dashboard     = document.getElementById('dashboard');
const errorMsg      = document.getElementById('errorMsg');
const cityNameEl    = document.getElementById('cityName');
const weatherLabelEl= document.getElementById('weatherLabel');
const weatherIconEl = document.getElementById('weatherIcon');
const tempEl        = document.getElementById('temp');
const windEl        = document.getElementById('wind');
const humidityEl    = document.getElementById('humidity');
const precipProbEl  = document.getElementById('precipProb');
const forecastGrid  = document.getElementById('forecastGrid');
const dayDetail     = document.getElementById('dayDetail');
const closeDetail   = document.getElementById('closeDetail');
const cityInput     = document.getElementById('cityInput');
const searchBtn     = document.getElementById('searchBtn');
const currentCard   = document.getElementById('currentWeather');

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 2 – Fetch weather from Open-Meteo
// ══════════════════════════════════════════════════════════
async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current:   'temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code',
    hourly:    'temperature_2m,precipitation_probability',
    daily:     'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone:  'auto',
    forecast_days: 7
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 1 – Geolocation API
// ══════════════════════════════════════════════════════════
function init() {
  showSpinner();

  if (!navigator.geolocation) {
    // Browser doesn't support geolocation → fallback
    loadWeather(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      // Success: use real coordinates
      const { latitude, longitude } = pos.coords;
      loadWeather(latitude, longitude, 'Your Location');
    },
    () => {
      // Denied or error: fallback to Mumbai
      loadWeather(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    },
    { timeout: 8000 }
  );
}

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 6 – City Search with Geocoding + Debounce
// ══════════════════════════════════════════════════════════
async function searchCity(cityName) {
  showSpinner();
  try {
    const res = await fetch(`${GEO_BASE}?name=${encodeURIComponent(cityName)}&count=1`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      throw new Error(`City "${cityName}" not found.`);
    }
    const { latitude, longitude, name, country } = data.results[0];
    await loadWeather(latitude, longitude, `${name}, ${country}`);
  } catch (err) {
    showError(err.message);
  }
}

// Debounce helper – Requirement 6 (debounce on every keystroke)
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Debounced search – fires 600ms after user stops typing
const debouncedSearch = debounce((val) => {
  if (val.trim().length > 2) searchCity(val.trim());
}, 600);

cityInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
searchBtn.addEventListener('click', () => {
  if (cityInput.value.trim()) searchCity(cityInput.value.trim());
});
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && cityInput.value.trim()) searchCity(cityInput.value.trim());
});

// ══════════════════════════════════════════════════════════
//  LOAD + RENDER
// ══════════════════════════════════════════════════════════
async function loadWeather(lat, lon, cityLabel) {
  showSpinner();
  try {
    const data = await getWeather(lat, lon);
    renderAll(data, cityLabel);
  } catch (err) {
    showError('Could not load weather data. Please try again.');
  }
}

function renderAll(data, cityLabel) {
  renderCurrent(data, cityLabel);
  renderForecast(data);

  hideSpinner();
  dashboard.classList.remove('hidden');

  setTimeout(() => {
    renderChart(data);
  }, 50);
}

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 3 – Dynamic weather icon & card background
// ══════════════════════════════════════════════════════════
function renderCurrent(data, cityLabel) {
  const c    = data.current;
  const code = c.weather_code;
  const info = getCode(code);

  // Text
  cityNameEl.textContent     = cityLabel;
  weatherLabelEl.textContent = info.label;
  weatherIconEl.textContent  = info.icon;

  // Stats
  tempEl.textContent      = Math.round(c.temperature_2m);
  windEl.textContent      = Math.round(c.wind_speed_10m);
  humidityEl.textContent  = c.relative_humidity_2m;

  // Precipitation probability for current hour
  const currentHour = new Date().getHours();
  const prob = data.hourly?.precipitation_probability?.[currentHour] ?? '--';
  precipProbEl.textContent = prob;

  // Background gradient based on weather condition (Requirement 3)
  currentCard.className = `current-card ${info.bg}`;
}

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 4 – 7-day forecast grid + CSS expand
// ══════════════════════════════════════════════════════════
function renderForecast(data) {
  const { daily } = data;
  forecastGrid.innerHTML = '';

  daily.time.forEach((dateStr, i) => {
    const code   = daily.weather_code[i];
    const info   = getCode(code);
    const max    = Math.round(daily.temperature_2m_max[i]);
    const min    = Math.round(daily.temperature_2m_min[i]);
    const prec   = daily.precipitation_probability_max[i];
    const dayName = i === 0 ? 'Today' : new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });

    const card = document.createElement('div');
    card.className = 'day-card';
    card.innerHTML = `
      <div class="day-name">${dayName}</div>
      <div class="day-icon">${info.icon}</div>
      <div class="day-max">${max}°</div>
      <div class="day-min">${min}°</div>
      <div class="day-prec">💧 ${prec}%</div>
    `;

    // Click → CSS transition expand (Requirement 4)
    card.addEventListener('click', () => {
      document.getElementById('detailDate').textContent  = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      document.getElementById('detailMax').textContent   = `${max}°`;
      document.getElementById('detailMin').textContent   = `${min}°`;
      document.getElementById('detailPrecip').textContent= `${prec}%`;
      document.getElementById('detailIcon').textContent  = info.icon;

      // Toggle CSS transition
      dayDetail.classList.remove('hidden');
      requestAnimationFrame(() => dayDetail.classList.add('visible'));
      dayDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    forecastGrid.appendChild(card);
  });
}

// Close detail panel
closeDetail.addEventListener('click', () => {
  dayDetail.classList.remove('visible');
  setTimeout(() => dayDetail.classList.add('hidden'), 400);
});

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 5 – Canvas 24-hour temperature chart
//  Pure Canvas 2D API – NO Chart.js or any library
// ══════════════════════════════════════════════════════════
function drawTempChart(canvas, hourlyTemps) {
  const ctx = canvas.getContext('2d');

  // High-DPI / retina support
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth  || canvas.parentElement.offsetWidth;
  const H   = 180;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const temps  = hourlyTemps.slice(0, 24);
  const minT   = Math.min(...temps) - 2;
  const maxT   = Math.max(...temps) + 2;

  // Map helpers
  const xOf = (i) => PAD.left + (i / (temps.length - 1)) * chartW;
  const yOf = (t) => PAD.top  + chartH - ((t - minT) / (maxT - minT)) * chartH;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;
  for (let g = 0; g <= 4; g++) {
    const y = PAD.top + (g / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
  }

  // Gradient fill under curve
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
  grad.addColorStop(0, 'rgba(79,142,247,0.45)');
  grad.addColorStop(1, 'rgba(79,142,247,0.02)');

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(temps[0]));
  for (let i = 1; i < temps.length; i++) {
    // Smooth curve using bezier control points
    const x0 = xOf(i - 1), y0 = yOf(temps[i - 1]);
    const x1 = xOf(i),     y1 = yOf(temps[i]);
    const cx  = (x0 + x1) / 2;
    ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
  }
  ctx.lineTo(xOf(temps.length - 1), PAD.top + chartH);
  ctx.lineTo(xOf(0), PAD.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(temps[0]));
  for (let i = 1; i < temps.length; i++) {
    const x0 = xOf(i - 1), y0 = yOf(temps[i - 1]);
    const x1 = xOf(i),     y1 = yOf(temps[i]);
    const cx  = (x0 + x1) / 2;
    ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
  }
  ctx.strokeStyle = '#4f8ef7';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // Data point dots
  temps.forEach((t, i) => {
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(t), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4f8ef7';
    ctx.fill();
  });

  // X-axis labels (every 4 hours)
  ctx.fillStyle = 'rgba(139,144,168,0.9)';
  ctx.font      = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 24; i += 4) {
    ctx.fillText(`${String(i).padStart(2,'0')}:00`, xOf(i), H - 6);
  }

  // Y-axis labels
  ctx.textAlign = 'right';
  for (let g = 0; g <= 4; g++) {
    const val = minT + ((4 - g) / 4) * (maxT - minT);
    const y   = PAD.top + (g / 4) * chartH;
    ctx.fillText(Math.round(val) + '°', PAD.left - 6, y + 4);
  }
}

function renderChart(data) {
  const canvas = document.getElementById('tempChart');
  const temps  = data.hourly.temperature_2m;
  drawTempChart(canvas, temps);
}

// ══════════════════════════════════════════════════════════
//  REQUIREMENT 7 – Resize listener with debounce (clamp)
// ══════════════════════════════════════════════════════════
const debouncedResize = debounce(() => {
  // Re-draw canvas chart on window resize so it fits the new width
  const canvas = document.getElementById('tempChart');
  if (canvas && !dashboard.classList.contains('hidden')) {
    // Re-use last fetched data stored in closure
    if (lastData) renderChart(lastData);
  }
}, 250);

window.addEventListener('resize', debouncedResize);

// Keep last data in memory for resize re-render
let lastData = null;
const _origRenderAll = renderAll;

// Override to capture data
window.renderAll = function(data, cityLabel) {
  lastData = data;
  _origRenderAll(data, cityLabel);
};

// Patch loadWeather to use window.renderAll
async function loadWeatherPatched(lat, lon, cityLabel) {
  showSpinner();
  try {
    const data = await getWeather(lat, lon);
    lastData = data;
    renderAll(data, cityLabel);
  } catch {
    showError('Could not load weather data. Please try again.');
  }
}

// ── Helpers ──────────────────────────────────────────────
function showSpinner() {
  spinner.classList.remove('hidden');
  dashboard.classList.add('hidden');
  errorMsg.classList.add('hidden');
}

function hideSpinner() {
  spinner.classList.add('hidden');
}

function showError(msg) {
  hideSpinner();
  dashboard.classList.add('hidden');
  errorMsg.textContent = `⚠️ ${msg}`;
  errorMsg.classList.remove('hidden');
}

// ── Kick off the app ─────────────────────────────────────
(async () => {
  showSpinner();

  if (!navigator.geolocation) {
    await loadWeatherPatched(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      await loadWeatherPatched(latitude, longitude, 'Your Location');
    },
    async () => {
      await loadWeatherPatched(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    },
    { timeout: 8000 }
  );
})();
