import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limiter";
import { classifyScreen } from "@/lib/classify-core";

const ClassifySchema = z.object({
  screenName: z.string().min(1).max(200),
  components: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ClassifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { screenName, components } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`classify:${ip}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429 },
    );
  }

  try {
    const result = await classifyScreen(screenName, components, req.signal);
    return NextResponse.json(result);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }
    throw err;
  }
}
