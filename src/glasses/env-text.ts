import type { EnvironmentData } from '../state/types';

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

/** Format the full environment display for the environment glasses mode. */
export function formatEnvironmentDisplay(env: EnvironmentData | null): string {
  if (!env) return 'Loading environment data...';

  const sections: string[] = [];

  // Weather
  if (env.weather) {
    const w = env.weather;
    sections.push(
      `Weather: ${Math.round(w.temperature)}C ${w.condition}`,
      `Feels like: ${Math.round(w.feelsLike)}C | Humidity: ${w.humidity}%`,
      `Wind: ${Math.round(w.windSpeed)} ${w.windUnit} | UV: ${w.uvIndex} ${uvLabel(w.uvIndex)}`,
    );
  } else {
    sections.push('Weather: unavailable');
  }

  sections.push('────────────────────');

  // Air Quality
  if (env.airQuality) {
    const aq = env.airQuality;
    sections.push(
      `Air Quality: ${aq.aqi} ${aq.category}`,
      `Pollutant: ${aq.dominantPollutant.toUpperCase()}`,
    );
  } else {
    sections.push('Air Quality: unavailable');
  }

  sections.push('────────────────────');

  // Pollen
  if (env.pollen) {
    const p = env.pollen;
    sections.push(
      `Pollen:`,
      `  Grass: ${p.grass.category} | Tree: ${p.tree.category}`,
      `  Weed: ${p.weed.category}`,
    );
  } else {
    sections.push('Pollen: unavailable');
  }

  return sections.join('\n');
}

/** Compact weather string for the navigation header. */
export function formatWeatherCompact(env: EnvironmentData | null): string {
  if (!env?.weather) return '';
  return `${Math.round(env.weather.temperature)}C`;
}

/** Compact environment string for the small env box in default nav mode. */
export function formatEnvironmentCompact(env: EnvironmentData | null): string {
  if (!env) return '';

  const parts: string[] = [];

  if (env.weather) {
    const w = env.weather;
    parts.push(`${Math.round(w.temperature)}C ${w.condition}`);
    parts.push(`Feels ${Math.round(w.feelsLike)}C | H:${w.humidity}%`);
    parts.push(`UV:${w.uvIndex} ${uvLabel(w.uvIndex)}`);
  }

  if (env.airQuality) {
    parts.push(`AQI:${env.airQuality.aqi} ${env.airQuality.category}`);
  }

  if (env.pollen) {
    const p = env.pollen;
    parts.push(`Pollen G:${p.grass.category} T:${p.tree.category}`);
  }

  return parts.join('\n');
}

/** Format the environment header. */
export function formatEnvironmentHeader(_env: EnvironmentData | null): string {
  return 'Weather & Environment';
}

/** Format the environment footer. */
export function formatEnvironmentFooter(env: EnvironmentData | null): string {
  if (!env) return '';
  const ago = Math.round((Date.now() - env.fetchedAt) / 60000);
  const agoText = ago < 1 ? 'just now' : `${ago}m ago`;
  return `Updated ${agoText} | Tap to return`;
}
