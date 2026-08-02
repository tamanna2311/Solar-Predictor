export function getOpenApiDocument(origin: string) {
  const apiBaseUrl = `${origin}/api/v1`;

  return {
    openapi: "3.1.0",
    info: {
      title: "Solaris Grid API",
      version: "1.0.0",
      summary: "Solar generation forecasts and inverter health intelligence",
      description:
        "A versioned REST API for live solar-site conditions, 30-minute and day-ahead power forecasts, 15-day energy outlooks, and early inverter warnings.",
      license: { name: "MIT", identifier: "MIT" },
    },
    externalDocs: {
      description: "Interactive API documentation",
      url: `${origin}/docs`,
    },
    servers: [
      {
        url: apiBaseUrl,
        description:
          origin.includes("localhost") || origin.includes("127.0.0.1")
            ? "Local development"
            : "Production",
      },
    ],
    tags: [
      { name: "System", description: "Service readiness and API information" },
      { name: "Solar sites", description: "Live plant, weather, and equipment data" },
      { name: "Forecasts", description: "Short-term power and longer-term energy predictions" },
      { name: "Inverter health", description: "Early warning and anomaly scoring" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          operationId: "getHealth",
          summary: "Check API health",
          description: "Use this endpoint for uptime checks and deployment health probes.",
          responses: {
            "200": {
              description: "The API is ready.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      "/meta": {
        get: {
          tags: ["System"],
          operationId: "getMetadata",
          summary: "Get API capabilities",
          description: "Returns documentation links, supported forecast horizons, and demo limitations.",
          responses: {
            "200": {
              description: "API metadata and capability information.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MetadataResponse" },
                },
              },
            },
          },
        },
      },
      "/sites/{siteId}/overview": {
        get: {
          tags: ["Solar sites"],
          operationId: "getSiteOverview",
          summary: "Get the complete site overview",
          description:
            "Returns current power, weather, all forecast horizons, inverter health, and model information in one dashboard-ready response.",
          parameters: [{ $ref: "#/components/parameters/SiteId" }],
          responses: {
            "200": {
              description: "Current solar-site overview.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SiteOverview" },
                },
              },
            },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/sites/{siteId}/forecasts": {
        get: {
          tags: ["Forecasts"],
          operationId: "getSiteForecast",
          summary: "Get one forecast horizon",
          description:
            "Choose the next 30 minutes, tomorrow's hourly power, or the 15-day daily energy outlook.",
          parameters: [
            { $ref: "#/components/parameters/SiteId" },
            {
              name: "horizon",
              in: "query",
              description: "Prediction period. Defaults to tomorrow.",
              schema: {
                type: "string",
                enum: ["nowcast", "tomorrow", "outlook"],
                default: "tomorrow",
              },
            },
          ],
          responses: {
            "200": {
              description: "Forecast data and the model version that produced it.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ForecastResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/anomalies/evaluate": {
        post: {
          tags: ["Inverter health"],
          operationId: "evaluateInverterAnomaly",
          summary: "Check one inverter reading",
          description:
            "Compares actual versus expected output and checks temperature rise to produce a 0–100 warning score with plain-language reasons.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnomalyRequest" },
                example: {
                  actualKw: 350,
                  expectedKw: 400,
                  inverterTemperatureC: 68,
                  ambientTemperatureC: 37,
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Warning score, severity, and contributing reasons.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AnomalyResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "422": { $ref: "#/components/responses/ValidationError" },
          },
        },
      },
    },
    components: {
      parameters: {
        SiteId: {
          name: "siteId",
          in: "path",
          required: true,
          description: "Solar-site identifier. The demo site is surya-one.",
          schema: { type: "string", example: "surya-one" },
        },
      },
      responses: {
        BadRequest: {
          description: "The request could not be read.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
        ValidationError: {
          description: "One or more input values are missing or invalid.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
        NotFound: {
          description: "The requested solar site does not exist.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["status", "service", "version", "timestamp"],
          properties: {
            status: { type: "string", const: "ok" },
            service: { type: "string", example: "solaris-grid-api" },
            version: { type: "string", example: "1.0.0" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        MetadataResponse: {
          type: "object",
          required: ["name", "version", "status", "documentation", "capabilities"],
          properties: {
            name: { type: "string", example: "Solaris Grid API" },
            version: { type: "string", example: "1.0.0" },
            status: { type: "string", enum: ["demonstrator", "production"] },
            documentation: {
              type: "object",
              additionalProperties: { type: "string", format: "uri" },
            },
            capabilities: {
              type: "object",
              properties: {
                defaultSiteId: { type: "string", example: "surya-one" },
                forecastHorizons: {
                  type: "array",
                  items: { type: "string", enum: ["nowcast", "tomorrow", "outlook"] },
                },
                liveWeather: { type: "boolean" },
                inverterEarlyWarning: { type: "boolean" },
              },
            },
            limitations: { type: "array", items: { type: "string" } },
          },
        },
        ForecastPoint: {
          type: "object",
          required: ["time", "label", "powerMw", "lowerMw", "upperMw"],
          properties: {
            time: { type: "string", format: "date-time" },
            label: { type: "string", example: "+15m" },
            powerMw: { type: "number", description: "Most likely AC power in megawatts." },
            lowerMw: { type: "number", description: "Lower end of the likely power range." },
            upperMw: { type: "number", description: "Upper end of the likely power range." },
            irradianceWm2: { type: "number", description: "Solar radiation in watts per square metre." },
            cloudCover: { type: "number", minimum: 0, maximum: 100 },
            temperatureC: { type: "number" },
          },
        },
        DailyForecast: {
          type: "object",
          required: ["date", "energyMwh", "lowerMwh", "upperMwh", "peakMw"],
          properties: {
            date: { type: "string", format: "date" },
            label: { type: "string" },
            condition: { type: "string" },
            energyMwh: { type: "number", description: "Most likely daily energy." },
            lowerMwh: { type: "number" },
            upperMwh: { type: "number" },
            peakMw: { type: "number" },
            cloudCover: { type: "number", minimum: 0, maximum: 100 },
          },
        },
        ForecastResponse: {
          type: "object",
          required: ["siteId", "horizon", "generatedAt", "source", "model", "data"],
          properties: {
            siteId: { type: "string", example: "surya-one" },
            horizon: { type: "string", enum: ["nowcast", "tomorrow", "outlook"] },
            generatedAt: { type: "string", format: "date-time" },
            source: { type: "string", enum: ["live-weather", "demo-fallback"] },
            model: { $ref: "#/components/schemas/ModelInfo" },
            data: {
              type: "array",
              items: {
                oneOf: [
                  { $ref: "#/components/schemas/ForecastPoint" },
                  { $ref: "#/components/schemas/DailyForecast" },
                ],
              },
            },
          },
        },
        ModelInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            lastTrainedAt: { type: "string", format: "date-time" },
            validationNmae: { type: "number", description: "Average daylight prediction error as a percentage." },
          },
        },
        SiteOverview: {
          type: "object",
          required: ["generatedAt", "source", "site", "telemetry", "weather", "nowcast", "tomorrow", "outlook", "inverters", "model"],
          properties: {
            generatedAt: { type: "string", format: "date-time" },
            source: { type: "string", enum: ["live-weather", "demo-fallback"] },
            site: { type: "object", additionalProperties: true },
            telemetry: { type: "object", additionalProperties: { type: "number" } },
            weather: { type: "object", additionalProperties: true },
            nowcast: { type: "array", items: { $ref: "#/components/schemas/ForecastPoint" } },
            tomorrow: { type: "array", items: { $ref: "#/components/schemas/ForecastPoint" } },
            outlook: { type: "array", items: { $ref: "#/components/schemas/DailyForecast" } },
            inverters: { type: "array", items: { $ref: "#/components/schemas/InverterHealth" } },
            model: { $ref: "#/components/schemas/ModelInfo" },
          },
        },
        InverterHealth: {
          type: "object",
          properties: {
            id: { type: "string", example: "INV-07" },
            status: { type: "string", enum: ["healthy", "watch", "critical"] },
            score: { type: "number", minimum: 0, maximum: 100 },
            actualKw: { type: "number" },
            expectedKw: { type: "number" },
            temperatureC: { type: "number" },
            reason: { type: "string" },
          },
        },
        AnomalyRequest: {
          type: "object",
          additionalProperties: false,
          required: ["actualKw", "expectedKw", "inverterTemperatureC", "ambientTemperatureC"],
          properties: {
            actualKw: { type: "number", minimum: 0, description: "Measured inverter output." },
            expectedKw: { type: "number", exclusiveMinimum: 0, description: "Expected output for comparable conditions." },
            inverterTemperatureC: { type: "number", description: "Measured inverter temperature." },
            ambientTemperatureC: { type: "number", description: "Outside air temperature." },
          },
        },
        AnomalyResponse: {
          type: "object",
          required: ["evaluatedAt", "result"],
          properties: {
            evaluatedAt: { type: "string", format: "date-time" },
            result: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 100 },
                severity: { type: "string", enum: ["healthy", "watch", "critical"] },
                residualPercent: { type: "number" },
                thermalRiseC: { type: "number" },
                reasons: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "VALIDATION_ERROR" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}
