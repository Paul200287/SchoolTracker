import { useEffect, useMemo, useState } from 'react';
import './App.css';

const STORAGE_KEYS = {
  unit: 'unit',
  theme: 'theme',
  schoolSemi: 'schoolSemi',
  coordsPlace: 'coords_place',
  customSchoolTimes: 'customSchoolTimes'
};

const DEFAULT_LOCATION = {
  lat: 48.2082,
  lon: 16.3738,
  place: 'Wien, Österreich'
};

const WEEKDAY_SCHOOL = {
  1: ['08:40', '15:45'],
  2: ['07:50', '14:05'],
  3: ['07:50', '15:45'],
  4: ['07:50', '13:15'],
  5: ['07:50', '13:15']
};

const WX_MAP = {
  0: ['Klar', '☀️'],
  1: ['Überwiegend klar', '🌤️'],
  2: ['Wolkig', '⛅️'],
  3: ['Bedeckt', '☁️'],
  45: ['Nebel', '🌫️'],
  48: ['Reifnebel', '🌫️'],
  51: ['Niesel leicht', '🌦️'],
  53: ['Niesel', '🌦️'],
  55: ['Niesel stark', '🌦️'],
  61: ['Regen leicht', '🌧️'],
  63: ['Regen', '🌧️'],
  65: ['Regen stark', '🌧️'],
  66: ['Gefrierender Regen leicht', '🌧️'],
  67: ['Gefrierender Regen stark', '🌧️'],
  71: ['Schnee leicht', '🌨️'],
  73: ['Schnee', '🌨️'],
  75: ['Schnee stark', '🌨️'],
  77: ['Schneekörner', '🌨️'],
  80: ['Schauer leicht', '🌦️'],
  81: ['Schauer', '🌦️'],
  82: ['Schauer stark', '🌧️'],
  85: ['Schneeschauer leicht', '🌨️'],
  86: ['Schneeschauer stark', '🌨️'],
  95: ['Gewitter', '⛈️'],
  96: ['Gewitter mit Hagel', '⛈️'],
  99: ['Gewitter mit starkem Hagel', '⛈️']
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function pad(value) {
  return value.toString().padStart(2, '0');
}

function toF(value) {
  return value * 9 / 5 + 32;
}

function kmh(ms) {
  return Math.round(ms * 3.6);
}

function fmtDate(date) {
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function getStoredJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function getStoredString(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function safeSetItem(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // ignore storage errors (e.g. private mode)
  }
}

function getSchoolTimesForDay(date, customSchoolTimes = {}) {
  const weekday = date.getDay();
  const custom = customSchoolTimes?.[weekday];
  if (typeof custom === 'string' && /^[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d$/.test(custom)) {
    const [start, end] = custom.split('-');
    return [start, end];
  }
  return WEEKDAY_SCHOOL[weekday] ?? null;
}

function getSchoolYearRange(now = new Date()) {
  const y = now.getFullYear();
  const startThisYear = new Date(y, 8, 8, 0, 0, 0, 0);
  const endThisCycle = new Date(y + 1, 3, 30, 23, 59, 59, 999);

  if (now >= startThisYear && now <= endThisCycle) {
    return { start: startThisYear, end: endThisCycle };
  }

  if (now < startThisYear) {
    return { start: startThisYear, end: endThisCycle };
  }

  const startNext = new Date(y + 1, 8, 8, 0, 0, 0, 0);
  const endNext = new Date(y + 2, 3, 30, 23, 59, 59, 999);
  return { start: startNext, end: endNext };
}

function computeSchoolInfo(now, customSchoolTimes) {
  const times = getSchoolTimesForDay(now, customSchoolTimes);

  if (!times) {
    return {
      times: null,
      ringValue: 0,
      percentLabel: '0.00%',
      countdown: '00:00:00',
      countdownLabel: 'Schultag beendet in:',
      statusText: 'Heute kein Unterricht',
      isAfterEnd: false
    };
  }

  const [startStr, endStr] = times;
  const start = new Date(now);
  const end = new Date(now);
  const [startHour, startMinute] = startStr.split(':').map(Number);
  const [endHour, endMinute] = endStr.split(':').map(Number);
  start.setHours(startHour, startMinute, 0, 0);
  end.setHours(endHour, endMinute, 0, 0);

  let nextTarget = end;
  let ringValue = 0;
  let status = '';
  let countdownLabel = 'Schultag beendet in:';
  let isAfterEnd = false;

  if (now < start) {
    status = 'Noch nicht gestartet';
    nextTarget = start;
    ringValue = 1;
    countdownLabel = 'Schultag beginnt in:';
  } else if (now >= start && now <= end) {
    status = 'Unterricht läuft';
    nextTarget = end;
    ringValue = clamp01((end - now) / (end - start));
  } else {
    status = 'Heute vorbei';
    nextTarget = new Date(start.getTime() + DAY_MS);
    ringValue = 0;
    countdownLabel = 'Nächster Schultag in:';
    isAfterEnd = true;
  }

  const diff = Math.max(0, nextTarget - now);
  const hh = pad(Math.floor(diff / HOUR_MS));
  const mm = pad(Math.floor((diff % HOUR_MS) / 60_000));
  const ss = pad(Math.floor((diff % 60_000) / 1_000));
  const countdown = `${hh}:${mm}:${ss}`;

  return {
    times,
    ringValue,
    percentLabel: `${(ringValue * 100).toFixed(2)}%`,
    countdown,
    countdownLabel,
    statusText: `${status} · ${startStr}–${endStr}`,
    isAfterEnd
  };
}

function computeYearInfo(now) {
  const { start, end } = getSchoolYearRange(now);
  const total = Math.max(1, end - start);

  let remaining;
  if (now < start) {
    remaining = total;
  } else if (now > end) {
    remaining = 0;
  } else {
    remaining = end - now;
  }

  const pctRemain = clamp01(remaining / total);
  const daysLeft = Math.max(0, Math.ceil(remaining / DAY_MS));
  const hoursLeft = Math.max(0, remaining / HOUR_MS);

  return {
    ringValue: pctRemain,
    percentLabel: `${(pctRemain * 100).toFixed(2)}%`,
    daysLeftText: `${daysLeft.toLocaleString('de-DE')} Tage`,
    hoursLeftText: `${hoursLeft.toLocaleString('de-DE', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1
    })} h`,
    statusText: `Zeitraum: ${fmtDate(start)} – ${fmtDate(end)}`
  };
}

async function getPlaceName(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=de&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Ort konnte nicht geladen werden');
  }
  const data = await response.json();
  const item = data?.results?.[0];
  if (!item) {
    return DEFAULT_LOCATION.place;
  }
  return item.country ? `${item.name}, ${item.country}` : item.name;
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Stadt nicht gefunden');
  }
  const data = await response.json();
  const item = data?.results?.[0];
  if (!item) {
    throw new Error('Stadt nicht gefunden');
  }
  return {
    lat: item.latitude,
    lon: item.longitude,
    place: item.country ? `${item.name}, ${item.country}` : item.name
  };
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Wetterdaten nicht verfügbar');
  }
  return response.json();
}

function deriveWeatherDisplay(weather, unit) {
  if (!weather) {
    return {
      emoji: '⛅️',
      description: '—',
      temperature: '—',
      unitLabel: unit === 'c' ? '°C' : '°F',
      feelsLike: '—',
      pop: '—',
      wind: '—',
      humidity: '—',
      maxTemp: '—',
      minTemp: '—',
      sunrise: '—',
      sunset: '—'
    };
  }

  const { current, daily, hourly } = weather;
  const convert = (value) => (unit === 'f' ? toF(value) : value);

  let pop = null;
  try {
    const nowIsoHour = new Date(current.time).toISOString().slice(0, 13) + ':00';
    const index = hourly?.time?.indexOf(nowIsoHour) ?? -1;
    pop = index >= 0 ? hourly.precipitation_probability?.[index] ?? null : null;
  } catch (error) {
    pop = null;
  }

  if (pop == null && Array.isArray(hourly?.precipitation_probability) && hourly.precipitation_probability.length) {
    const values = hourly.precipitation_probability.slice(0, 12).filter((value) => typeof value === 'number');
    if (values.length) {
      pop = Math.round(values.reduce((acc, val) => acc + val, 0) / values.length);
    }
  }

  const [description, emoji] = WX_MAP[current.weather_code] ?? ['Wetter', '⛅️'];
  const sunriseDate = daily.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
  const sunsetDate = daily.sunset?.[0] ? new Date(daily.sunset[0]) : null;

  return {
    emoji,
    description,
    temperature: Math.round(convert(current.temperature_2m)),
    unitLabel: unit === 'c' ? '°C' : '°F',
    feelsLike: Math.round(convert(current.apparent_temperature)),
    pop: pop ?? '—',
    wind: kmh(current.wind_speed_10m),
    humidity: Math.round(current.relative_humidity_2m),
    maxTemp: Math.round(convert(daily.temperature_2m_max?.[0] ?? NaN)),
    minTemp: Math.round(convert(daily.temperature_2m_min?.[0] ?? NaN)),
    sunrise: sunriseDate
      ? sunriseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
    sunset: sunsetDate
      ? sunsetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—'
  };
}

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export default function App() {
  const storedLocation = getStoredJSON(STORAGE_KEYS.coordsPlace, null);
  const [unit, setUnit] = useState(() => getStoredString(STORAGE_KEYS.unit, 'c'));
  const [theme, setTheme] = useState(() => getStoredString(STORAGE_KEYS.theme, 'dark'));
  const [schoolSemi, setSchoolSemi] = useState(() => getStoredString(STORAGE_KEYS.schoolSemi, '0') === '1');
  const [coords, setCoords] = useState(() => (storedLocation ? { lat: storedLocation.lat, lon: storedLocation.lon } : null));
  const [place, setPlace] = useState(() => storedLocation?.place ?? null);
  const [weather, setWeather] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [customSchoolTimes] = useState(() => getStoredJSON(STORAGE_KEYS.customSchoolTimes, {}));

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.unit, unit);
  }, [unit]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.schoolSemi, schoolSemi ? '1' : '0');
  }, [schoolSemi]);

  useEffect(() => {
    if (coords && place) {
      safeSetItem(STORAGE_KEYS.coordsPlace, JSON.stringify({ lat: coords.lat, lon: coords.lon, place }));
    }
  }, [coords, place]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('light', theme === 'light');
    safeSetItem(STORAGE_KEYS.theme, theme);
  }, [theme]);

  useEffect(() => {
    if (!coords) {
      let cancelled = false;
      (async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 8_000,
                maximumAge: 60_000
              });
            });
            if (cancelled) return;
            const { latitude, longitude } = position.coords;
            let resolvedPlace = DEFAULT_LOCATION.place;
            try {
              resolvedPlace = await getPlaceName(latitude, longitude);
            } catch (error) {
              resolvedPlace = DEFAULT_LOCATION.place;
            }
            if (cancelled) return;
            setCoords({ lat: latitude, lon: longitude });
            setPlace(resolvedPlace);
            return;
          }
        } catch (error) {
          // ignore and fall back
        }
        if (cancelled) return;
        setCoords({ lat: DEFAULT_LOCATION.lat, lon: DEFAULT_LOCATION.lon });
        setPlace(DEFAULT_LOCATION.place);
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [coords]);

  useEffect(() => {
    if (!coords) return;
    let ignore = false;

    const load = async () => {
      setIsLoadingWeather(true);
      setWeatherError('');
      try {
        const data = await fetchWeather(coords.lat, coords.lon);
        if (!ignore) {
          setWeather(data);
        }
      } catch (error) {
        if (!ignore) {
          setWeatherError(error instanceof Error ? error.message : 'Unbekannter Fehler');
        }
      } finally {
        if (!ignore) {
          setIsLoadingWeather(false);
        }
      }
    };

    load();
    const interval = setInterval(load, 600_000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [coords]);

  useEffect(() => {
    if (!coords || place) return;
    let ignore = false;
    (async () => {
      try {
        const resolved = await getPlaceName(coords.lat, coords.lon);
        if (!ignore) {
          setPlace(resolved);
        }
      } catch (error) {
        if (!ignore) {
          setPlace(DEFAULT_LOCATION.place);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [coords, place]);

  useEffect(() => {
    if (!weather) return;
    if (typeof document === 'undefined') return;
    const isDay = Boolean(weather.current?.is_day);
    const base = getComputedStyle(document.body).getPropertyValue('--bg');
    const gradient = isDay
      ? 'radial-gradient(1200px 800px at 70% -10%, rgba(110,168,254,.15), transparent 60%)'
      : 'radial-gradient(1200px 800px at 70% -10%, rgba(10,12,30,.35), transparent 60%)';
    document.body.style.background = `${gradient}, ${base}`;
    return () => {
      document.body.style.background = '';
    };
  }, [weather, theme]);

  const weatherDisplay = useMemo(() => deriveWeatherDisplay(weather, unit), [weather, unit]);
  const schoolInfo = useMemo(() => computeSchoolInfo(now, customSchoolTimes), [now, customSchoolTimes]);
  const yearInfo = useMemo(() => computeYearInfo(now), [now]);

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleRingToggle = () => {
    setSchoolSemi((prev) => !prev);
  };

  const handleCitySearch = async () => {
    const query = cityQuery.trim();
    if (!query) return;
    try {
      const result = await geocodeCity(query);
      setCoords({ lat: result.lat, lon: result.lon });
      setPlace(result.place);
    } catch (error) {
      window.alert('Stadt nicht gefunden. Bitte erneut versuchen.');
    }
  };

  const handleCityKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCitySearch();
    }
  };

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    [now]
  );

  const timeLabel = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
    [now]
  );

  const [startTime, endTime] = schoolInfo.times ?? ['', ''];
  const placeLabel = place ?? '—';

  return (
    <div className="app">
      <header>
        <div className="brand">📚 Schoolboard</div>
        <div className="controls">
          <input
            type="search"
            className="city-input"
            placeholder="Stadt suchen … (optional)"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            onKeyDown={handleCityKeyDown}
          />
          <button className="btn" type="button" onClick={handleCitySearch}>
            Suchen
          </button>
          <select
            className="btn"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          >
            <option value="c">°C</option>
            <option value="f">°F</option>
          </select>
          <button className="btn" type="button" onClick={handleThemeToggle}>
            Dark/Light
          </button>
          <button className="btn" type="button" onClick={handleRingToggle} title="Schulring: Voll/Halb">
            Ring: Voll/Halb
          </button>
          {isLoadingWeather && <span className="loading-pill">Lade Wetter …</span>}
        </div>
      </header>

      <main className="grid">
        <section className="card col-12">
          <div className="sub" aria-live="polite">
            {dateLabel}
          </div>
          <div className="clock monospace-digits" aria-live="polite">
            {timeLabel}
          </div>
          <div className="weather-row">
            <div className="w-emoji" aria-hidden="true">
              {weatherDisplay.emoji}
            </div>
            <div>
              <div className="big">
                <span>{weatherDisplay.temperature}</span> <span>{weatherDisplay.unitLabel}</span> ·{' '}
                <span>{weatherDisplay.description}</span>
              </div>
              <div className="sub">
                Ort: <strong>{placeLabel}</strong>
              </div>
            </div>
            <div className="pill">Gefühlt: <span>{weatherDisplay.feelsLike}</span>°</div>
            <div className="pill">Regenwahrscheinlichkeit: <span>{weatherDisplay.pop}</span>%</div>
            <div className="pill">Wind: <span>{weatherDisplay.wind}</span> km/h</div>
            <div className="pill">LF: <span>{weatherDisplay.humidity}</span>%</div>
          </div>
          <div style={{ height: 10 }} />
          <div className="two-col">
            <div className="k">Max heute</div>
            <div className="k">Min heute</div>
            <div className="big">
              <span>{weatherDisplay.maxTemp}</span>°
            </div>
            <div className="big">
              <span>{weatherDisplay.minTemp}</span>°
            </div>
          </div>
          <div className="two-col" style={{ marginTop: 10 }}>
            <div className="k">Sonnenaufgang</div>
            <div className="k">Sonnenuntergang</div>
            <div className="big">{weatherDisplay.sunrise}</div>
            <div className="big">{weatherDisplay.sunset}</div>
          </div>
          {weatherError && <div className="error" role="alert">{weatherError}</div>}
        </section>

        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Schultag</h3>
          <div className="two-col">
            <div>
              <label className="k" htmlFor="schoolStart">
                Schulstart (heute)
              </label>
              <input id="schoolStart" type="time" className="btn" value={startTime} readOnly />
            </div>
            <div>
              <label className="k" htmlFor="schoolEnd">
                Schulende (heute)
              </label>
              <input id="schoolEnd" type="time" className="btn" value={endTime} readOnly />
            </div>
          </div>
          <div style={{ height: 10 }} />
          <div className="k">Schulzeit-Fortschritt</div>
          <div className="ring-wrap">
            <div
              className={classNames('school-ring', schoolSemi && 'semi', schoolInfo.isAfterEnd && 'end')}
              style={{ '--pct': schoolInfo.ringValue }}
            >
              <div className="label">
                <div className="monospace-digits" style={{ fontSize: 28 }}>{schoolInfo.percentLabel}</div>
                <div className="sub">verbleibend</div>
              </div>
            </div>
            <div>
              <div className="k">{schoolInfo.countdownLabel}</div>
              <div className="big monospace-digits">{schoolInfo.countdown}</div>
              <div className="tiny">{schoolInfo.statusText}</div>
            </div>
          </div>
        </section>

        <section className="card col-6">
          <h3 style={{ marginTop: 0 }}>Schuljahr (08.09 – 30.04)</h3>
          <div className="ring-wrap">
            <div className="year-ring" style={{ '--pct': yearInfo.ringValue }}>
              <div className="label">
                <div className="monospace-digits" style={{ fontSize: 28 }}>{yearInfo.percentLabel}</div>
                <div className="sub">verbleibend</div>
              </div>
            </div>
            <div>
              <div className="k">Verbleibende Tage</div>
              <div className="big monospace-digits">{yearInfo.daysLeftText}</div>
              <div className="k">Verbleibende Stunden</div>
              <div className="big monospace-digits">{yearInfo.hoursLeftText}</div>
              <div className="tiny">{yearInfo.statusText}</div>
            </div>
          </div>
        </section>
      </main>

      <footer>Passath&apos;sche School Tracker</footer>
    </div>
  );
}
