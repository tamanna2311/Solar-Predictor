export type Horizon = "nowcast" | "tomorrow" | "outlook";

export type ForecastPoint = {
  time: string;
  label: string;
  powerMw: number;
  lowerMw: number;
  upperMw: number;
  irradianceWm2: number;
  cloudCover: number;
  temperatureC: number;
};

export type DailyForecast = {
  date: string;
  label: string;
  condition: string;
  energyMwh: number;
  lowerMwh: number;
  upperMwh: number;
  peakMw: number;
  cloudCover: number;
};

export type InverterHealth = {
  id: string;
  status: "healthy" | "watch" | "critical";
  score: number;
  actualKw: number;
  expectedKw: number;
  temperatureC: number;
  reason?: string;
};

export type SolarOverview = {
  generatedAt: string;
  source: "live-weather" | "demo-fallback";
  site: {
    id: string;
    name: string;
    location: string;
    latitude: number;
    longitude: number;
    capacityMw: number;
    inverterCount: number;
  };
  telemetry: {
    acPowerMw: number;
    dcPowerMw: number;
    dcCurrentA: number;
    dcVoltageV: number;
    energyTodayMwh: number;
    performanceRatio: number;
    availability: number;
  };
  weather: {
    temperatureC: number;
    cloudCover: number;
    windSpeedKmh: number;
    irradianceWm2: number;
    condition: string;
  };
  nowcast: ForecastPoint[];
  tomorrow: ForecastPoint[];
  outlook: DailyForecast[];
  inverters: InverterHealth[];
  model: {
    name: string;
    version: string;
    lastTrainedAt: string;
    validationNmae: number;
  };
};

type WeatherPayload = {
  current?: {
    temperature_2m?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    shortwave_radiation?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    cloud_cover?: number[];
    wind_speed_10m?: number[];
    shortwave_radiation?: number[];
  };
};

const SITE = {
  id: "surya-one",
  name: "Surya One",
  location: "Jaisalmer, Rajasthan",
  latitude: 26.9157,
  longitude: 70.9083,
  capacityMw: 5,
  inverterCount: 12,
};

const round = (value: number, digits = 2) =>
  Number(value.toFixed(digits));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function conditionFromCloud(cloudCover: number) {
  if (cloudCover < 18) return "Clear";
  if (cloudCover < 45) return "Mostly sunny";
  if (cloudCover < 72) return "Partly cloudy";
  return "Overcast";
}

function powerFromWeather(irradiance: number, temperatureC: number) {
  const poa = Math.max(0, irradiance) * 1.06;
  const cellTemperature = temperatureC + poa * 0.025;
  const temperatureFactor = 1 - 0.0038 * (cellTemperature - 25);
  const dc = SITE.capacityMw * (poa / 1000) * temperatureFactor * 0.92;
  const ac = Math.min(4.6, Math.max(0, dc * 0.975));
  return { dc: round(dc), ac: round(ac) };
}

function fallbackWeather(now = new Date()): WeatherPayload {
  const times: string[] = [];
  const temperature: number[] = [];
  const cloud: number[] = [];
  const wind: number[] = [];
  const irradiance: number[] = [];

  for (let index = 0; index < 16 * 24; index += 1) {
    const date = new Date(now.getTime() + index * 60 * 60 * 1000);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(date),
    );
    const dayWave = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const cloudValue = clamp(20 + 17 * Math.sin(index * 0.31), 4, 74);
    times.push(date.toISOString());
    temperature.push(round(27 + dayWave * 10 + Math.sin(index * 0.12), 1));
    cloud.push(round(cloudValue, 0));
    wind.push(round(12 + 4 * Math.sin(index * 0.19), 1));
    irradiance.push(round(980 * dayWave * (1 - cloudValue * 0.006), 0));
  }

  return {
    current: {
      temperature_2m: temperature[0],
      cloud_cover: cloud[0],
      wind_speed_10m: wind[0],
      shortwave_radiation: irradiance[0],
    },
    hourly: {
      time: times,
      temperature_2m: temperature,
      cloud_cover: cloud,
      wind_speed_10m: wind,
      shortwave_radiation: irradiance,
    },
  };
}

async function loadWeather() {
  const params = new URLSearchParams({
    latitude: String(SITE.latitude),
    longitude: String(SITE.longitude),
    current:
      "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation",
    hourly:
      "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation",
    forecast_days: "16",
    timezone: "Asia/Kolkata",
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) throw new Error(`weather upstream returned ${response.status}`);
    const payload = (await response.json()) as WeatherPayload;
    if (!payload.hourly?.time?.length) throw new Error("weather response was empty");
    return { payload, source: "live-weather" as const };
  } catch {
    return { payload: fallbackWeather(), source: "demo-fallback" as const };
  }
}

function buildHourly(payload: WeatherPayload): ForecastPoint[] {
  const hourly = payload.hourly ?? {};
  const times = hourly.time ?? [];
  return times.map((time, index) => {
    const temperatureC = hourly.temperature_2m?.[index] ?? 30;
    const cloudCover = hourly.cloud_cover?.[index] ?? 25;
    const irradianceWm2 = hourly.shortwave_radiation?.[index] ?? 0;
    const { ac } = powerFromWeather(irradianceWm2, temperatureC);
    const leadHours = index + 1;
    const uncertainty = clamp(0.09 + leadHours * 0.0025 + cloudCover * 0.0012, 0.1, 0.36);
    const date = new Date(time);
    return {
      time: date.toISOString(),
      label: date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }),
      powerMw: ac,
      lowerMw: round(ac * (1 - uncertainty)),
      upperMw: round(Math.min(4.6, ac * (1 + uncertainty))),
      irradianceWm2: round(irradianceWm2, 0),
      cloudCover: round(cloudCover, 0),
      temperatureC: round(temperatureC, 1),
    };
  });
}

function buildNowcast(currentPower: number, firstHourlyPower: number) {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() + index * 5 * 60 * 1000);
    const progress = index / 12;
    const predicted = clamp(
      currentPower + (firstHourlyPower - currentPower) * progress + Math.sin(index * 0.8) * 0.025,
      0,
      4.6,
    );
    const uncertainty = 0.035 + index * 0.009;
    return {
      time: date.toISOString(),
      label: index === 0 ? "Now" : `+${index * 5}m`,
      powerMw: round(predicted),
      lowerMw: round(Math.max(0, predicted * (1 - uncertainty))),
      upperMw: round(Math.min(4.6, predicted * (1 + uncertainty))),
      irradianceWm2: 0,
      cloudCover: 0,
      temperatureC: 0,
    };
  });
}

function buildOutlook(hourly: ForecastPoint[]) {
  const buckets = new Map<string, ForecastPoint[]>();
  hourly.forEach((point) => {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(point.time));
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries())
    .slice(0, 15)
    .map(([date, points]) => {
      const energy = points.reduce((sum, point) => sum + point.powerMw, 0);
      const cloudCover =
        points.reduce((sum, point) => sum + point.cloudCover, 0) / points.length;
      return {
        date,
        label: new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        condition: conditionFromCloud(cloudCover),
        energyMwh: round(energy, 1),
        lowerMwh: round(points.reduce((sum, point) => sum + point.lowerMw, 0), 1),
        upperMwh: round(points.reduce((sum, point) => sum + point.upperMw, 0), 1),
        peakMw: round(Math.max(...points.map((point) => point.powerMw))),
        cloudCover: round(cloudCover, 0),
      };
    });
}

function buildInverters(plantPowerMw: number): InverterHealth[] {
  const base = (plantPowerMw * 1000) / SITE.inverterCount;
  return Array.from({ length: SITE.inverterCount }, (_, index) => {
    const number = index + 1;
    const expected = base * (0.98 + Math.sin(number * 1.7) * 0.018);
    if (number === 7) {
      return {
        id: `INV-${String(number).padStart(2, "0")}`,
        status: "watch",
        score: 68,
        actualKw: round(expected * 0.88, 0),
        expectedKw: round(expected, 0),
        temperatureC: 67.8,
        reason:
          "Running hotter than normal and generating 12% less power than similar inverters.",
      };
    }
    return {
      id: `INV-${String(number).padStart(2, "0")}`,
      status: "healthy",
      score: round(8 + Math.abs(Math.sin(number)) * 18, 0),
      actualKw: round(expected * (0.985 + Math.sin(number) * 0.008), 0),
      expectedKw: round(expected, 0),
      temperatureC: round(48 + Math.abs(Math.sin(number * 0.7)) * 8, 1),
    };
  });
}

export async function getSolarOverview(): Promise<SolarOverview> {
  const { payload, source } = await loadWeather();
  const current = payload.current ?? {};
  const temperatureC = current.temperature_2m ?? 31;
  const cloudCover = current.cloud_cover ?? 22;
  const irradianceWm2 = current.shortwave_radiation ?? 0;
  const power = powerFromWeather(irradianceWm2, temperatureC);
  const hourly = buildHourly(payload);
  const nowcast = buildNowcast(power.ac, hourly[0]?.powerMw ?? power.ac);
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Kolkata" },
  );
  const tomorrow = hourly.filter(
    (point) =>
      new Date(point.time).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      }) === tomorrowDate,
  );
  const dcVoltageV = power.dc > 0 ? 918 : 0;

  return {
    generatedAt: new Date().toISOString(),
    source,
    site: SITE,
    telemetry: {
      acPowerMw: power.ac,
      dcPowerMw: power.dc,
      dcCurrentA: dcVoltageV ? round((power.dc * 1_000_000) / dcVoltageV, 0) : 0,
      dcVoltageV,
      energyTodayMwh: round(Math.max(0, power.ac * 4.7 + irradianceWm2 * 0.006), 1),
      performanceRatio: 86.4,
      availability: 99.2,
    },
    weather: {
      temperatureC: round(temperatureC, 1),
      cloudCover: round(cloudCover, 0),
      windSpeedKmh: round(current.wind_speed_10m ?? 12, 1),
      irradianceWm2: round(irradianceWm2, 0),
      condition: conditionFromCloud(cloudCover),
    },
    nowcast,
    tomorrow,
    outlook: buildOutlook(hourly),
    inverters: buildInverters(power.ac),
    model: {
      name: "Hybrid PV v1",
      version: "1.0.0-demo",
      lastTrainedAt: "2026-07-26T03:30:00.000Z",
      validationNmae: 7.8,
    },
  };
}

export function evaluateAnomaly(input: {
  actualKw: number;
  expectedKw: number;
  inverterTemperatureC: number;
  ambientTemperatureC: number;
}) {
  const residualRatio =
    input.expectedKw > 0
      ? Math.max(0, (input.expectedKw - input.actualKw) / input.expectedKw)
      : 0;
  const thermalRise = input.inverterTemperatureC - input.ambientTemperatureC;
  const score = clamp(residualRatio * 260 + Math.max(0, thermalRise - 23) * 2.2, 0, 100);
  const severity = score >= 78 ? "critical" : score >= 48 ? "watch" : "healthy";
  return {
    score: round(score, 0),
    severity,
    residualPercent: round(residualRatio * 100, 1),
    thermalRiseC: round(thermalRise, 1),
    reasons: [
      ...(residualRatio > 0.08 ? ["Actual output is materially below expected output."] : []),
      ...(thermalRise > 28 ? ["Inverter temperature rise is elevated for the operating point."] : []),
    ],
  };
}
