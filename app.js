const BASE = 'https://api.open-meteo.com/v1/forecast';
const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

const DEFAULT_LAT = 19.076;
const DEFAULT_LON = 72.877;
const DEFAULT_CITY = 'Mumbai';

const CODES = {
  0: { label: 'Clear sky', icon: '☀️', bg: 'clear' },
  1: { label: 'Mainly clear', icon: '🌤️', bg: 'clear' },
  2: { label: 'Partly cloudy', icon: '⛅', bg: 'clouds' },
  3: { label: 'Overcast', icon: '☁️', bg: 'clouds' },
  45: { label: 'Foggy', icon: '🌫️', bg: 'clouds' },
  48: { label: 'Icy fog', icon: '🌫️', bg: 'clouds' },
  51: { label: 'Light drizzle', icon: '🌦️', bg: 'rain' },
  53: { label: 'Drizzle', icon: '🌧️', bg: 'rain' },
  55: { label: 'Heavy drizzle', icon: '🌧️', bg: 'rain' },
  61: { label: 'Slight rain', icon: '🌧️', bg: 'rain' },
  63: { label: 'Rain', icon: '🌧️', bg: 'rain' },
  65: { label: 'Heavy rain', icon: '🌧️', bg: 'rain' },
  71: { label: 'Light snow', icon: '🌨️', bg: 'clouds' },
  80: { label: 'Rain showers', icon: '🌦️', bg: 'rain' },
  95: { label: 'Thunderstorm', icon: '⛈️', bg: 'thunder' },
  99: { label: 'Heavy thunderstorm', icon: '🌩️', bg: 'thunder' }
};

function getCode(code) {
  return CODES[code] || { label: 'Unknown', icon: '🌡️', bg: 'clouds' };
}

const spinner = document.getElementById('spinner');
const dashboard = document.getElementById('dashboard');
const errorMsg = document.getElementById('errorMsg');
const cityNameEl = document.getElementById('cityName');
const weatherLabelEl = document.getElementById('weatherLabel');
const weatherIconEl = document.getElementById('weatherIcon');
const tempEl = document.getElementById('temp');
const windEl = document.getElementById('wind');
const humidityEl = document.getElementById('humidity');
const precipProbEl = document.getElementById('precipProb');
const forecastGrid = document.getElementById('forecastGrid');
const dayDetail = document.getElementById('dayDetail');
const closeDetail = document.getElementById('closeDetail');
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const currentCard = document.getElementById('currentWeather');

async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code',
    hourly: 'temperature_2m,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: 7
  });

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

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

function debounce(fn, delay) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedSearch = debounce((val) => {
  if (val.trim().length > 2) searchCity(val.trim());
}, 600);

cityInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

searchBtn.addEventListener('click', () => {
  if (cityInput.value.trim()) searchCity(cityInput.value.trim());
});

cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && cityInput.value.trim()) {
    searchCity(cityInput.value.trim());
  }
});

async function loadWeather(lat, lon, cityLabel) {
  showSpinner();

  try {
    const data = await getWeather(lat, lon);
    renderAll(data, cityLabel);
  } catch {
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

function renderCurrent(data, cityLabel) {
  const c = data.current;
  const info = getCode(c.weather_code);

  cityNameEl.textContent = cityLabel;
  weatherLabelEl.textContent = info.label;
  weatherIconEl.textContent = info.icon;

  tempEl.textContent = Math.round(c.temperature_2m);
  windEl.textContent = Math.round(c.wind_speed_10m);
  humidityEl.textContent = c.relative_humidity_2m;

  const currentHour = new Date().getHours();
  const prob = data.hourly?.precipitation_probability?.[currentHour] ?? '--';

  precipProbEl.textContent = prob;
  currentCard.className = `current-card ${info.bg}`;
}

function renderForecast(data) {
  const { daily } = data;
  forecastGrid.innerHTML = '';

  daily.time.forEach((dateStr, i) => {
    const info = getCode(daily.weather_code[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const prec = daily.precipitation_probability_max[i];

    const dayName =
      i === 0
        ? 'Today'
        : new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short'
          });

    const card = document.createElement('div');

    card.className = 'day-card';

    card.innerHTML = `
      <div class="day-name">${dayName}</div>
      <div class="day-icon">${info.icon}</div>
      <div class="day-max">${max}°</div>
      <div class="day-min">${min}°</div>
      <div class="day-prec">💧 ${prec}%</div>
    `;

    card.addEventListener('click', () => {
      document.getElementById('detailDate').textContent =
        new Date(dateStr).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });

      document.getElementById('detailMax').textContent = `${max}°`;
      document.getElementById('detailMin').textContent = `${min}°`;
      document.getElementById('detailPrecip').textContent = `${prec}%`;
      document.getElementById('detailIcon').textContent = info.icon;

      dayDetail.classList.remove('hidden');

      requestAnimationFrame(() => {
        dayDetail.classList.add('visible');
      });

      dayDetail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    });

    forecastGrid.appendChild(card);
  });
}

closeDetail.addEventListener('click', () => {
  dayDetail.classList.remove('visible');

  setTimeout(() => {
    dayDetail.classList.add('hidden');
  }, 400);
});

function drawTempChart(canvas, hourlyTemps) {
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || canvas.parentElement.offsetWidth;
  const H = 180;

  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  ctx.scale(dpr, dpr);

  const PAD = {
    top: 20,
    right: 20,
    bottom: 30,
    left: 40
  };

  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const temps = hourlyTemps.slice(0, 24);

  const minT = Math.min(...temps) - 2;
  const maxT = Math.max(...temps) + 2;

  const xOf = (i) => PAD.left + (i / (temps.length - 1)) * chartW;

  const yOf = (t) =>
    PAD.top +
    chartH -
    ((t - minT) / (maxT - minT)) * chartH;

  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;

  for (let g = 0; g <= 4; g++) {
    const y = PAD.top + (g / 4) * chartH;

    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(W - PAD.right, y);
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(
    0,
    PAD.top,
    0,
    PAD.top + chartH
  );

  grad.addColorStop(0, 'rgba(79,142,247,0.45)');
  grad.addColorStop(1, 'rgba(79,142,247,0.02)');

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(temps[0]));

  for (let i = 1; i < temps.length; i++) {
    const x0 = xOf(i - 1);
    const y0 = yOf(temps[i - 1]);
    const x1 = xOf(i);
    const y1 = yOf(temps[i]);

    const cx = (x0 + x1) / 2;

    ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
  }

  ctx.lineTo(xOf(temps.length - 1), PAD.top + chartH);
  ctx.lineTo(xOf(0), PAD.top + chartH);
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(temps[0]));

  for (let i = 1; i < temps.length; i++) {
    const x0 = xOf(i - 1);
    const y0 = yOf(temps[i - 1]);
    const x1 = xOf(i);
    const y1 = yOf(temps[i]);

    const cx = (x0 + x1) / 2;

    ctx.bezierCurveTo(cx, y0, cx, y1, x1, y1);
  }

  ctx.strokeStyle = '#4f8ef7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  temps.forEach((t, i) => {
    ctx.beginPath();
    ctx.arc(xOf(i), yOf(t), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4f8ef7';
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(139,144,168,0.9)';
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';

  for (let i = 0; i < 24; i += 4) {
    ctx.fillText(
      `${String(i).padStart(2, '0')}:00`,
      xOf(i),
      H - 6
    );
  }

  ctx.textAlign = 'right';

  for (let g = 0; g <= 4; g++) {
    const val = minT + ((4 - g) / 4) * (maxT - minT);
    const y = PAD.top + (g / 4) * chartH;

    ctx.fillText(
      Math.round(val) + '°',
      PAD.left - 6,
      y + 4
    );
  }
}

function renderChart(data) {
  const canvas = document.getElementById('tempChart');
  drawTempChart(canvas, data.hourly.temperature_2m);
}

const debouncedResize = debounce(() => {
  const canvas = document.getElementById('tempChart');

  if (canvas && !dashboard.classList.contains('hidden')) {
    if (lastData) renderChart(lastData);
  }
}, 250);

window.addEventListener('resize', debouncedResize);

let lastData = null;

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

(async () => {
  showSpinner();

  const loadAndStore = async (lat, lon, city) => {
    try {
      const data = await getWeather(lat, lon);
      lastData = data;
      renderAll(data, city);
    } catch {
      showError('Could not load weather data. Please try again.');
    }
  };

  if (!navigator.geolocation) {
    await loadAndStore(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      await loadAndStore(latitude, longitude, 'Your Location');
    },
    async () => {
      await loadAndStore(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
    },
    { timeout: 8000 }
  );
})();
