import { chat, ChatConfigError, ChatQuotaError } from "@/lib/chat/gemini";
import { getUserDevice } from "@/lib/getUserDevice";

// POST /api/chat - the dashboard chatbot (Gemini).
// Body: { messages: [{ role: "user" | "assistant", text }] }, last message from the user.
// Returns { reply, tools_used }.

const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const LIMIT_PER_HOUR = 30;
const usage = new Map(); // userId -> timestamps of recent requests (per server instance)

function overLimit(userId) {
  const hourAgo = Date.now() - 3600_000;
  const recent = (usage.get(userId) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= LIMIT_PER_HOUR) return true;
  recent.push(Date.now());
  usage.set(userId, recent);
  return false;
}

function parseMessages(body) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return { error: "messages must be a non-empty array" };
  const clean = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    text: typeof m?.text === "string" ? m.text.trim().slice(0, MAX_CHARS) : "",
  }));
  if (clean.some((m) => !m.text)) return { error: "every message needs text" };
  if (clean.at(-1).role !== "user") return { error: "the last message must be from the user" };
  // Gemini expects the conversation to start with the user.
  while (clean[0].role !== "user") clean.shift();
  return { messages: clean };
}

export async function POST(request) {
  const { supabase, user, device, response } = await getUserDevice();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { messages, error } = parseMessages(body);
  if (error) return Response.json({ error }, { status: 400 });

  if (overLimit(user.id)) {
    return Response.json({ error: `Limit reached: ${LIMIT_PER_HOUR} messages per hour. Try again later.` }, { status: 429 });
  }

  try {
    const { text, tools_used } = await chat(messages, { supabase, deviceId: device.id });
    return Response.json({ reply: text, tools_used });
  } catch (err) {
    if (err instanceof ChatConfigError) {
      return Response.json({ error: "Chatbot is not set up yet (missing GEMINI_API_KEY)." }, { status: 503 });
    }
    if (err instanceof ChatQuotaError) {
      return Response.json({ error: "The AI is busy (Gemini quota reached). Wait a minute and try again." }, { status: 429 });
    }
    console.error("chat failed:", err);
    return Response.json({ error: "The assistant couldn't answer right now." }, { status: 502 });
  }
}
