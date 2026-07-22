import { NextResponse } from "next/server";
import OpenAI from "openai";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

function parseConversation(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];

  const messages: ConversationMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;

    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      messages.push({ role, content: content.trim() });
    }
  }

  return messages;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const material =
      typeof body?.material === "string" ? body.material.trim() : "";
    const question =
      typeof body?.question === "string" ? body.question.trim() : "";
    const conversation = parseConversation(body?.conversation);

    if (!material || !question) {
      return NextResponse.json(
        {
          error:
            "Invalid request body. Required fields: material, question. Optional: conversation.",
        },
        { status: 400 },
      );
    }

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You answer questions using the provided study material first.",
            "Use prior conversation for context when relevant.",
            "If the material does not contain enough information, answer using your own knowledge.",
            "Be clear, accurate, and concise.",
            "",
            "Study material:",
            material,
          ].join("\n"),
        },
        ...conversation.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user", content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!answer) {
      return NextResponse.json(
        { error: "Failed to generate an answer." },
        { status: 500 },
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Answer API error:", error);
    return NextResponse.json(
      { error: "Failed to answer question." },
      { status: 500 },
    );
  }
}
