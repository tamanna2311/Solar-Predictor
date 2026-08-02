export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return Response.json(
    {
      name: "Solaris Grid API",
      version: "1.0.0",
      status: "demonstrator",
      description:
        "Solar generation forecasting and early inverter warning API.",
      documentation: {
        swagger: `${origin}/docs`,
        redoc: `${origin}/redoc`,
        openapi: `${origin}/openapi.json`,
      },
      capabilities: {
        defaultSiteId: "surya-one",
        forecastHorizons: ["nowcast", "tomorrow", "outlook"],
        liveWeather: true,
        inverterEarlyWarning: true,
      },
      limitations: [
        "Plant readings are simulated from live weather until real SCADA data is connected.",
        "The prediction model is a demonstrator and must be retrained with site history before production use.",
      ],
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
