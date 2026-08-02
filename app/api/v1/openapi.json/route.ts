export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Solaris Grid API",
      version: "1.0.0",
      description:
        "Versioned API for solar forecasts, live plant overview, and inverter anomaly scoring.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    paths: {
      "/health": {
        get: { summary: "Service health", responses: { "200": { description: "Healthy" } } },
      },
      "/sites/{siteId}/overview": {
        get: {
          summary: "Live site overview",
          parameters: [
            { name: "siteId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Telemetry, weather, forecasts, and health" } },
        },
      },
      "/sites/{siteId}/forecasts": {
        get: {
          summary: "Forecast for one horizon",
          parameters: [
            { name: "siteId", in: "path", required: true, schema: { type: "string" } },
            {
              name: "horizon",
              in: "query",
              schema: { type: "string", enum: ["nowcast", "tomorrow", "outlook"] },
            },
          ],
          responses: { "200": { description: "Forecast points and model metadata" } },
        },
      },
      "/anomalies/evaluate": {
        post: {
          summary: "Evaluate an inverter operating point",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "actualKw",
                    "expectedKw",
                    "inverterTemperatureC",
                    "ambientTemperatureC",
                  ],
                  properties: {
                    actualKw: { type: "number" },
                    expectedKw: { type: "number" },
                    inverterTemperatureC: { type: "number" },
                    ambientTemperatureC: { type: "number" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Anomaly score and reasons" } },
        },
      },
    },
  });
}
