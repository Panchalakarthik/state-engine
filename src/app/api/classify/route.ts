import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFY_SYSTEM_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

/** Strip ```json fences / stray prose and parse the first JSON object. */
function parseJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const { screenName, components } = (await req.json()) as {
      screenName: string;
      components: string[];
    };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: CLASSIFY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Screen name: "${screenName}"\nComponents on screen: ${components.join(", ")}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "{}";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("classify error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Classification failed" },
      { status: 500 },
    );
  }
}
