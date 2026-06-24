import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import { adaptScenario } from "@/lib/generation";

const FixSchema = z.object({
  prototypeJsx: z.string(),
  scenarioName: z.string(),
  scenarioDescription: z.string(),
  error: z.string(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`fix:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = FixSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { prototypeJsx, scenarioName, scenarioDescription, error } = parsed.data;

  try {
    const result = await adaptScenario(
      prototypeJsx,
      {
        name: scenarioName,
        description: `${scenarioDescription}

IMPORTANT: Previous attempt crashed with: "${error.slice(0, 300)}"
Use simpler Blade patterns. Prefer Box/Text/Heading over List/ListItem. Avoid Badge wrapping non-text children.`,
      },
      req.signal,
    );
    return NextResponse.json({ jsx: result.jsx });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
