# Solaris Grid

Solaris Grid is a production-shaped MVP for multi-horizon photovoltaic power
forecasting and early inverter anomaly detection. It combines live weather,
plant physics, probabilistic forecast ranges, peer comparison, and a versioned
HTTP API in a responsive operations dashboard.

## What is included

- 5-minute solar nowcast for the next 30 minutes
- hourly day-ahead forecast with P10/P50/P90-style bounds
- 15-day daily generation outlook
- Kiran Solar site configuration (2.52 MW AC / 3.02 MWp DC, eight inverters)
- inverter health ranking and an explainable early-warning card
- a standalone anomaly-evaluation endpoint
- interactive Swagger and ReDoc API documentation
- OpenAPI 3.1 discovery document with schemas and examples
- live Open-Meteo weather with a deterministic fallback for resilient demos
- Cloudflare Worker-compatible deployment through vinext

> The current model is a demonstrator. Production accuracy requires site SCADA,
> archived issue-time weather forecasts, plant metadata, and maintenance labels.

## Architecture

```text
Open-Meteo forecast ─┐
                     ├─> weather normalization ─> PV physics ─> uncertainty bands
SCADA telemetry ─────┘                                  │
                                                        ├─> REST API ─> dashboard
Peer inverters + expected power ─> anomaly score ───────┘
```

The forecasting engine uses irradiance, ambient/cell-temperature correction,
DC losses, inverter conversion efficiency, and AC clipping. It is intentionally
structured so a pvlib service or trained residual model can replace the demo
calculation without changing the public API.

## API

All endpoints are versioned under `/api/v1`.

- **Live app:** [solar-predictor-ft87.onrender.com](https://solar-predictor-ft87.onrender.com)
- **Swagger:** [interactive API endpoints](https://solar-predictor-ft87.onrender.com/docs)
- **ReDoc:** [readable API reference](https://solar-predictor-ft87.onrender.com/redoc)
- **OpenAPI:** [openapi.json](https://solar-predictor-ft87.onrender.com/openapi.json)
- **Render:** [manage deployment](https://dashboard.render.com/web/srv-d9ncoou417fc73d3q1pg)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | service readiness |
| `GET` | `/api/v1/meta` | capabilities and documentation links |
| `GET` | `/api/v1/sites/kiran-solar/overview` | complete dashboard payload |
| `GET` | `/api/v1/sites/kiran-solar/forecasts?horizon=tomorrow` | one forecast horizon |
| `POST` | `/api/v1/anomalies/evaluate` | score an inverter operating point |
| `GET` | `/openapi.json` | OpenAPI 3.1 document |

Supported forecast horizons are `nowcast`, `tomorrow`, and `outlook`.

Example anomaly request:

```bash
curl -X POST http://localhost:3000/api/v1/anomalies/evaluate \
  -H 'content-type: application/json' \
  -d '{
    "actualKw": 352,
    "expectedKw": 401,
    "inverterTemperatureC": 68,
    "ambientTemperatureC": 37
  }'
```

## Local development

Requires Node.js `>=24.14.0 <25`.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run build
npm test
npm run lint
```

## Production data path

For a real plant, replace the reference-site adapter with:

1. timestamped SCADA ingestion at 1–5 minute resolution;
2. archived weather forecasts as they were issued, to prevent leakage;
3. exact module, array, tracker, inverter, tilt, azimuth, and loss metadata;
4. a pvlib baseline and LightGBM quantile/residual model;
5. maintenance work orders and fault labels for alert validation;
6. model monitoring using daylight nMAE, bias, interval coverage, false alerts,
   and warning lead time.

## Company-data proof of concept

The `ml/` directory implements the requested company-data method rather than
embedding confidential exports in the web bundle:

```text
SolarLive inverter + plant exports ─┐
Satellite weather export ───────────┼─> 15-minute alignment + quality flags
Plant configuration ────────────────┘                 │
                                                       ├─> 15-minute LightGBM
                                                       └─> pvlib ─> residual LightGBM
```

Raw exports, aligned tables, and model binaries are Git-ignored. See
`ml/README.md` for the training command and artifact contract.

The first chronological July holdout produced the following proof-of-concept
scores. These are pipeline-validation results, not production claims:

| Model | MAE | nMAE |
| --- | ---: | ---: |
| Persistence | 149.38 kW | 5.93% |
| pvlib baseline | 229.46 kW | 9.11% |
| 15-minute LightGBM | 182.21 kW | 7.23% |
| pvlib + residual LightGBM | 295.85 kW | 11.74% |

Persistence currently wins. The hybrid model needs more seasons, confirmed
units/array geometry, and archived issue-time weather forecasts before it can
be promoted to the live runtime.

## Research and data references

- [pvlib](https://pvlib-python.readthedocs.io/)
- [PVAnalytics](https://pvanalytics.readthedocs.io/)
- [Solar Forecast Arbiter](https://solarforecastarbiter-core.readthedocs.io/)
- [PVDAQ public data](https://data.openei.org/submissions/4568)
- [Open-Meteo forecast API](https://open-meteo.com/en/docs)
- [ECMWF AIFS](https://www.ecmwf.int/en/about/media-centre/news/2025/ecmwfs-ai-forecasts-become-operational)
- [Open Climate Fix](https://github.com/openclimatefix)

## License

MIT
