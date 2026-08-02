import { evaluateAnomaly } from "../../../../lib/solar";

const REQUIRED_FIELDS = [
  "actualKw",
  "expectedKw",
  "inverterTemperatureC",
  "ambientTemperatureC",
] as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const invalid = REQUIRED_FIELDS.filter(
    (field) => typeof body[field] !== "number" || !Number.isFinite(body[field]),
  );
  if (invalid.length) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Numeric fields required: ${invalid.join(", ")}.`,
        },
      },
      { status: 422 },
    );
  }

  const result = evaluateAnomaly({
    actualKw: body.actualKw as number,
    expectedKw: body.expectedKw as number,
    inverterTemperatureC: body.inverterTemperatureC as number,
    ambientTemperatureC: body.ambientTemperatureC as number,
  });
  return Response.json({ evaluatedAt: new Date().toISOString(), result });
}
