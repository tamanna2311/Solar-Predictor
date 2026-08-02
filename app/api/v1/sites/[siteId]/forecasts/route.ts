import { getSolarOverview, type Horizon } from "../../../../../lib/solar";

const horizons = new Set<Horizon>(["nowcast", "tomorrow", "outlook"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await context.params;
  const horizon = (new URL(request.url).searchParams.get("horizon") ??
    "tomorrow") as Horizon;

  if (siteId !== "surya-one") {
    return Response.json(
      { error: { code: "SITE_NOT_FOUND", message: "Unknown solar site." } },
      { status: 404 },
    );
  }
  if (!horizons.has(horizon)) {
    return Response.json(
      {
        error: {
          code: "INVALID_HORIZON",
          message: "horizon must be nowcast, tomorrow, or outlook.",
        },
      },
      { status: 400 },
    );
  }

  const overview = await getSolarOverview();
  return Response.json(
    {
      siteId,
      horizon,
      generatedAt: overview.generatedAt,
      source: overview.source,
      model: overview.model,
      data: overview[horizon],
    },
    { headers: { "cache-control": "public, max-age=120, stale-while-revalidate=300" } },
  );
}
