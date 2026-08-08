import { getSolarOverview } from "../../../../../lib/solar";

export async function GET(
  _request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await context.params;
  if (siteId !== "kiran-solar") {
    return Response.json(
      {
        error: {
          code: "SITE_NOT_FOUND",
          message: `No site exists with id '${siteId}'.`,
        },
      },
      { status: 404 },
    );
  }

  const overview = await getSolarOverview();
  return Response.json(overview, {
    headers: { "cache-control": "public, max-age=120, stale-while-revalidate=300" },
  });
}
