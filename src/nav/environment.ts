import type { LatLng, EnvironmentData, AirQualityData, WeatherData, PollenData } from '../state/types';

const isDev = import.meta.env.DEV;

function airQualityBase() {
  return isDev ? '/api/airquality' : 'https://airquality.googleapis.com';
}

function weatherBase() {
  return isDev ? '/api/weather' : 'https://weather.googleapis.com';
}

function pollenBase() {
  return isDev ? '/api/pollen' : 'https://pollen.googleapis.com';
}

export async function fetchAirQuality(location: LatLng, apiKey: string): Promise<AirQualityData | undefined> {
  try {
    const res = await fetch(`${airQualityBase()}/v1/currentConditions:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: location.lat, longitude: location.lng },
        universalAqi: true,
        extraComputations: ['HEALTH_RECOMMENDATIONS', 'DOMINANT_POLLUTANT_CONCENTRATION'],
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      console.warn('[Environment] Air Quality API error:', res.status);
      return undefined;
    }

    const data = await res.json();
    const index = data.indexes?.find((i: any) => i.code === 'uaqi') || data.indexes?.[0];

    if (!index) return undefined;

    const recommendation = data.healthRecommendations?.generalPopulation ||
      data.healthRecommendations?.elderly ||
      '';

    return {
      aqi: index.aqi || 0,
      category: index.category || 'Unknown',
      dominantPollutant: index.dominantPollutant || 'Unknown',
      recommendation: typeof recommendation === 'string' ? recommendation : '',
    };
  } catch (e) {
    console.warn('[Environment] Air Quality fetch failed:', e);
    return undefined;
  }
}

export async function fetchWeather(location: LatLng, apiKey: string): Promise<WeatherData | undefined> {
  try {
    const params = new URLSearchParams({
      key: apiKey,
      'location.latitude': location.lat.toString(),
      'location.longitude': location.lng.toString(),
      unitsSystem: 'METRIC',
    });

    const res = await fetch(`${weatherBase()}/v1/currentConditions:lookup?${params}`);

    if (!res.ok) {
      console.warn('[Environment] Weather API error:', res.status);
      return undefined;
    }

    const data = await res.json();

    return {
      temperature: data.temperature?.degrees ?? 0,
      feelsLike: data.feelsLikeTemperature?.degrees ?? 0,
      condition: data.weatherCondition?.description?.text || data.weatherCondition?.type || 'Unknown',
      humidity: data.relativeHumidity ?? 0,
      windSpeed: data.windSpeed?.speed ?? 0,
      windUnit: data.windSpeed?.unit === 'KILOMETERS_PER_HOUR' ? 'km/h' : 'm/s',
      uvIndex: data.uvIndex ?? 0,
    };
  } catch (e) {
    console.warn('[Environment] Weather fetch failed:', e);
    return undefined;
  }
}

export async function fetchPollen(location: LatLng, apiKey: string): Promise<PollenData | undefined> {
  try {
    const res = await fetch(`${pollenBase()}/v1/forecast:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: location.lat, longitude: location.lng },
        days: 1,
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      console.warn('[Environment] Pollen API error:', res.status);
      return undefined;
    }

    const data = await res.json();
    const today = data.dailyInfo?.[0] || data.daily?.[0];

    if (!today) return undefined;

    const plantInfo = today.plantInfo || today.pollenTypeInfo || [];
    const defaultLevel = { level: 0, category: 'None' };

    function findPlant(code: string) {
      const plant = plantInfo.find((p: any) =>
        p.code?.toUpperCase() === code || p.displayName?.toUpperCase() === code
      );
      if (!plant?.indexInfo) return defaultLevel;
      return {
        level: plant.indexInfo.value || 0,
        category: plant.indexInfo.category || 'Unknown',
      };
    }

    return {
      grass: findPlant('GRASS'),
      tree: findPlant('TREE'),
      weed: findPlant('WEED'),
    };
  } catch (e) {
    console.warn('[Environment] Pollen fetch failed:', e);
    return undefined;
  }
}

/** Fetch all environmental data in parallel. Individual failures don't block others. */
export async function fetchAllEnvironmentData(location: LatLng, apiKey: string): Promise<EnvironmentData> {
  const [airQuality, weather, pollen] = await Promise.all([
    fetchAirQuality(location, apiKey),
    fetchWeather(location, apiKey),
    fetchPollen(location, apiKey),
  ]);

  return {
    airQuality,
    weather,
    pollen,
    fetchedAt: Date.now(),
  };
}

const ENV_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Start periodic environment data fetching. */
export function startEnvironmentUpdates(
  getLocation: () => LatLng | null,
  apiKey: string,
  onUpdate: (data: EnvironmentData) => void
) {
  stopEnvironmentUpdates();

  // Fetch immediately
  const loc = getLocation();
  if (loc) {
    fetchAllEnvironmentData(loc, apiKey).then(onUpdate);
  }

  // Refresh every 5 minutes
  refreshTimer = setInterval(() => {
    const loc = getLocation();
    if (loc) {
      fetchAllEnvironmentData(loc, apiKey).then(onUpdate);
    }
  }, ENV_REFRESH_INTERVAL);
}

export function stopEnvironmentUpdates() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
