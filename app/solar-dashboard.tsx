"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Bot,
  Boxes,
  CloudSun,
  Gauge,
  LayoutDashboard,
  MapPin,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  ThermometerSun,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Horizon, SolarOverview } from "./lib/solar";

const HORIZONS: Array<{ id: Horizon; label: string; hint: string }> = [
  { id: "nowcast", label: "Next 30 min", hint: "5-minute nowcast" },
  { id: "tomorrow", label: "Tomorrow", hint: "Hourly forecast" },
  { id: "outlook", label: "15 days", hint: "Daily outlook" },
];

const EMPTY_OVERVIEW: SolarOverview = {
  generatedAt: "2026-08-02T00:00:00.000Z",
  source: "demo-fallback",
  site: {
    id: "surya-one",
    name: "Surya One",
    location: "Jaisalmer, Rajasthan",
    latitude: 26.9157,
    longitude: 70.9083,
    capacityMw: 5,
    inverterCount: 12,
  },
  telemetry: {
    acPowerMw: 0,
    dcPowerMw: 0,
    dcCurrentA: 0,
    dcVoltageV: 0,
    energyTodayMwh: 0,
    performanceRatio: 0,
    availability: 0,
  },
  weather: {
    temperatureC: 0,
    cloudCover: 0,
    windSpeedKmh: 0,
    irradianceWm2: 0,
    condition: "Loading",
  },
  nowcast: [],
  tomorrow: [],
  outlook: [],
  inverters: [],
  model: {
    name: "Hybrid PV v1",
    version: "1.0.0-demo",
    lastTrainedAt: "2026-07-26T03:30:00.000Z",
    validationNmae: 0,
  },
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <article className={`metric-card ${accent ? "metric-card--accent" : ""}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <div className="metric-card__value">
        {value} <small>{unit}</small>
      </div>
      <div className="metric-card__detail">{detail}</div>
    </article>
  );
}

type TooltipDatum = {
  powerMw?: number;
  lowerMw?: number;
  upperMw?: number;
  energyMwh?: number;
  lowerMwh?: number;
  upperMwh?: number;
};

function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const isDaily = data.energyMwh !== undefined;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>
        {isDaily ? `${data.energyMwh ?? 0} MWh` : `${data.powerMw ?? 0} MW`}
      </span>
      <small>
        Range {isDaily ? data.lowerMwh ?? 0 : data.lowerMw ?? 0}–
        {isDaily ? data.upperMwh ?? 0 : data.upperMw ?? 0} {isDaily ? "MWh" : "MW"}
      </small>
    </div>
  );
}

export function SolarDashboard() {
  const [overview, setOverview] = useState<SolarOverview>(EMPTY_OVERVIEW);
  const [horizon, setHorizon] = useState<Horizon>("tomorrow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/sites/surya-one/overview", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("The plant feed could not be loaded.");
      setOverview((await response.json()) as SolarOverview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh plant data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadInitialOverview() {
      try {
        const response = await fetch("/api/v1/sites/surya-one/overview", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("The plant feed could not be loaded.");
        const payload = (await response.json()) as SolarOverview;
        if (active) setOverview(payload);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Unable to refresh plant data.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInitialOverview();
    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(() => {
    if (horizon === "outlook") return overview.outlook;
    return overview[horizon];
  }, [horizon, overview]);

  const activeHorizon = HORIZONS.find((item) => item.id === horizon)!;
  const tomorrowEnergy = overview.outlook[1]?.energyMwh ?? overview.outlook[0]?.energyMwh ?? 0;
  const watchInverters = overview.inverters.filter((item) => item.status !== "healthy");

  return (
    <main className="app-shell">
      <div className="energy-grid" aria-hidden="true" />
      <div className="energy-horizon" aria-hidden="true" />

      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="brand">
          <span className="brand__mark"><Sun size={19} /></span>
          <span><strong>SOLARIS</strong><small>Grid intelligence</small></span>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Primary navigation">
          <a className="nav-item nav-item--active" href="#overview"><LayoutDashboard size={18} />Overview</a>
          <a className="nav-item" href="#forecast"><Waves size={18} />Forecasts</a>
          <a className="nav-item" href="#health"><ShieldCheck size={18} />Inverter health<span className="nav-badge">1</span></a>
          <a className="nav-item" href="#model"><Bot size={18} />Model registry</a>
          <a className="nav-item" href="/api/v1/openapi.json" target="_blank" rel="noreferrer"><BookOpen size={18} />API specification<ArrowUpRight size={14} /></a>
        </nav>

        <div className="sidebar__bottom">
          <div className="model-chip">
            <span className="pulse-dot" />
            <div><small>Active model</small><strong>{overview.model.name}</strong></div>
            <Sparkles size={15} />
          </div>
          <a className="nav-item" href="#settings"><Settings size={18} />Configuration</a>
        </div>
      </aside>

      {menuOpen && <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div>
            <p className="eyebrow">SOLAR OPERATIONS / LIVE</p>
            <h1>Generation intelligence</h1>
          </div>
          <div className="topbar__actions">
            <div className="site-picker">
              <MapPin size={16} />
              <span><small>Monitoring site</small><strong>{overview.site.name} · {overview.site.capacityMw} MW</strong></span>
            </div>
            <button className="refresh-button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh data">
              <RefreshCw size={17} className={loading ? "spin" : ""} />
              <span>{loading ? "Refreshing" : "Refresh"}</span>
            </button>
          </div>
        </header>

        <div className="dashboard" id="overview">
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={17} /> {error}
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          )}

          <section className="hero-strip">
            <div className="hero-strip__copy">
              <div className="live-label"><span /> LIVE PLANT</div>
              <h2>{overview.site.name}</h2>
              <p><MapPin size={14} /> {overview.site.location} · Updated {new Date(overview.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</p>
            </div>
            <div className="weather-row">
              <div><ThermometerSun size={19} /><span><strong>{overview.weather.temperatureC}°</strong><small>Ambient</small></span></div>
              <div><CloudSun size={19} /><span><strong>{overview.weather.cloudCover}%</strong><small>{overview.weather.condition}</small></span></div>
              <div><Wind size={19} /><span><strong>{overview.weather.windSpeedKmh}</strong><small>km/h wind</small></span></div>
              <div><Sun size={19} /><span><strong>{overview.weather.irradianceWm2}</strong><small>W/m² GHI</small></span></div>
            </div>
          </section>

          <section className="metrics-grid" aria-label="Live plant metrics">
            <MetricCard label="AC power" value={formatNumber(overview.telemetry.acPowerMw, 2)} unit="MW" detail={`${formatNumber((overview.telemetry.acPowerMw / overview.site.capacityMw) * 100)}% of installed capacity`} icon={<Zap size={18} />} accent />
            <MetricCard label="Energy today" value={formatNumber(overview.telemetry.energyTodayMwh)} unit="MWh" detail="Metered estimate since sunrise" icon={<Activity size={18} />} />
            <MetricCard label="DC array" value={formatNumber(overview.telemetry.dcCurrentA, 0)} unit="A" detail={`${formatNumber(overview.telemetry.dcVoltageV, 0)} V · ${formatNumber(overview.telemetry.dcPowerMw, 2)} MW`} icon={<Gauge size={18} />} />
            <MetricCard label="Tomorrow P50" value={formatNumber(tomorrowEnergy)} unit="MWh" detail={`${overview.outlook[1]?.condition ?? "Forecast preparing"} · probabilistic`} icon={<CloudSun size={18} />} />
          </section>

          <div className="content-grid">
            <section className="panel forecast-panel" id="forecast">
              <div className="panel__header panel__header--stacked">
                <div>
                  <p className="eyebrow">POWER FORECAST</p>
                  <h3>{activeHorizon.label}</h3>
                  <span>{activeHorizon.hint} · P10/P50/P90 range</span>
                </div>
                <div className="horizon-tabs" role="tablist" aria-label="Forecast horizon">
                  {HORIZONS.map((item) => (
                    <button key={item.id} role="tab" aria-selected={horizon === item.id} className={horizon === item.id ? "active" : ""} onClick={() => setHorizon(item.id)}>{item.label}</button>
                  ))}
                </div>
              </div>

              <div className="chart-wrap" aria-label={`${activeHorizon.label} power forecast chart`}>
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 18, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#25ef91" stopOpacity={0.42} />
                          <stop offset="90%" stopColor="#25ef91" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(106, 175, 143, 0.12)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#789083", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: "#789083", fontSize: 11 }} axisLine={false} tickLine={false} unit={horizon === "outlook" ? "" : ""} />
                      <Tooltip content={<ForecastTooltip />} />
                      <Area type="monotone" dataKey={horizon === "outlook" ? "upperMwh" : "upperMw"} stroke="none" fill="#25ef91" fillOpacity={0.07} />
                      <Area type="monotone" dataKey={horizon === "outlook" ? "energyMwh" : "powerMw"} stroke="#28f39a" strokeWidth={2.2} fill="url(#powerFill)" activeDot={{ r: 5, fill: "#d8ffe9", stroke: "#28f39a", strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty"><RefreshCw size={22} className={loading ? "spin" : ""} />Preparing forecast…</div>
                )}
              </div>

              <div className="forecast-foot">
                <span><i className="legend-line" /> P50 expected</span>
                <span><i className="legend-range" /> P10–P90 range</span>
                <span className="source-note">Weather: {overview.source === "live-weather" ? "Open-Meteo live feed" : "resilient demo fallback"}</span>
              </div>
            </section>

            <section className="panel health-panel" id="health">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">INVERTER HEALTH</p>
                  <h3>{overview.inverters.length - watchInverters.length}/{overview.inverters.length} healthy</h3>
                </div>
                <span className="status-pill status-pill--watch"><AlertTriangle size={13} /> {watchInverters.length} watch</span>
              </div>

              {watchInverters[0] && (
                <article className="anomaly-card">
                  <div className="anomaly-card__head">
                    <span className="inverter-icon"><Boxes size={19} /></span>
                    <div><strong>{watchInverters[0].id}</strong><small>Early warning</small></div>
                    <span className="risk-score">{watchInverters[0].score}</span>
                  </div>
                  <p>{watchInverters[0].reason}</p>
                  <div className="anomaly-metrics">
                    <span><small>Actual</small><strong>{watchInverters[0].actualKw} kW</strong></span>
                    <span><small>Expected</small><strong>{watchInverters[0].expectedKw} kW</strong></span>
                    <span><small>Temperature</small><strong>{watchInverters[0].temperatureC}°C</strong></span>
                  </div>
                  <button>Review signal <ArrowUpRight size={14} /></button>
                </article>
              )}

              <div className="inverter-list">
                {overview.inverters.slice(0, 6).map((inverter) => (
                  <div key={inverter.id} className="inverter-row">
                    <span className={`health-dot health-dot--${inverter.status}`} />
                    <strong>{inverter.id}</strong>
                    <span>{inverter.actualKw} kW</span>
                    <small>{inverter.temperatureC}°C</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="bottom-grid" id="model">
            <article className="mini-panel">
              <span className="mini-panel__icon"><ShieldCheck size={19} /></span>
              <div><small>Plant availability</small><strong>{overview.telemetry.availability}%</strong><p>SCADA and inverter uptime</p></div>
            </article>
            <article className="mini-panel">
              <span className="mini-panel__icon"><Gauge size={19} /></span>
              <div><small>Performance ratio</small><strong>{overview.telemetry.performanceRatio}%</strong><p>Weather-normalized output</p></div>
            </article>
            <article className="mini-panel">
              <span className="mini-panel__icon"><Bot size={19} /></span>
              <div><small>Validation nMAE</small><strong>{overview.model.validationNmae}%</strong><p>Rolling daylight backtest</p></div>
            </article>
            <article className="mini-panel mini-panel--api">
              <span className="mini-panel__icon"><BookOpen size={19} /></span>
              <div><small>Developer API</small><strong>v1 · Online</strong><p>OpenAPI 3.1 specification</p></div>
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" aria-label="Open API specification"><ArrowUpRight size={17} /></a>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
