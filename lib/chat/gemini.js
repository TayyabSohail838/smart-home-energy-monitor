import { runTool, TOOL_DECLARATIONS } from "@/lib/chat/tools";

// Gemini chatbot via the generateContent REST API (plain fetch, no SDK).
// Key: GEMINI_API_KEY (server only). Model: GEMINI_MODEL, default gemini-3.8-flash.

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_TOOL_ROUNDS = 5;
const MAX_OUTPUT_TOKENS = 1024;

const SYSTEM_PROMPT = `You are the assistant inside Wattly, a home electricity monitor for a family in Faisalabad, Pakistan.
A PZEM-004T meter with a clamp on the home's mains measures current and real power every 10 seconds.

How to answer:
- Get every number from the tools. Never invent or estimate usage, bills or weather yourself. If a tool returns an error or no data, say so plainly.
- Reply in the language of the user's latest message: English question → English answer, Urdu script → Urdu script, Roman Urdu → Roman Urdu. Don't switch to Urdu just because the home is in Pakistan.
- Be short and practical: a direct answer first, then at most 2-3 tips. Use simple words; the user is not an engineer.
- Units on the bill are kWh. Money is PKR ("Rs 5,415").
- Bills are energy charge only, using NEPRA 2026 unprotected slab rates (FESCO). Taxes, fuel price adjustment and fixed charges are not included; mention this when you talk about the bill.
- Unprotected billing: all units are charged at the rate of the slab the monthly total falls in, so crossing a slab boundary raises the price of every unit.
- Weather: the next 14 days are a real forecast; months ahead come from a seasonal forecast (monthly tendencies) or typical-year normals (weather_basis "normals"). Say which when it matters.
- AC figures are estimates from the temperature pattern; the clamp measures the whole home, not individual appliances.
- Safety: never tell the user to open the meter or the distribution board.
- Stay on topic (this home's electricity, bills, weather impact, saving energy). Politely decline anything else.
- Times are Pakistan time (Asia/Karachi).`;

export class ChatConfigError extends Error {}
export class ChatQuotaError extends Error {}

async function callGemini(contents) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ChatConfigError("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new ChatQuotaError(body.error?.message ?? "rate limited");
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message ?? "request failed"}`);
  return body;
}

// history: [{ role: "user" | "assistant", text }], oldest first, last one from the user.
// ctx: { supabase, deviceId } for the tools. Returns { text, tools_used }.
export async function chat(history, ctx) {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));
  const toolsUsed = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const body = await callGemini(contents);
    const candidate = body.candidates?.[0];
    const content = candidate?.content;
    if (!content?.parts?.length) {
      const reason = candidate?.finishReason ?? body.promptFeedback?.blockReason ?? "empty response";
      return { text: `Sorry, I couldn't answer that (${reason}).`, tools_used: toolsUsed };
    }

    const calls = content.parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const text = content.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
      return { text: text || "Sorry, I couldn't answer that.", tools_used: toolsUsed };
    }

    // Send the model's turn back exactly as received: Gemini 3 attaches thought
    // signatures to these parts and rejects a conversation where they're missing.
    contents.push(content);

    const results = await Promise.all(
      calls.map(async ({ functionCall }) => {
        toolsUsed.push(functionCall.name);
        const result = await runTool(functionCall.name, functionCall.args ?? {}, ctx);
        return {
          functionResponse: {
            name: functionCall.name,
            ...(functionCall.id ? { id: functionCall.id } : {}),
            response: { result },
          },
        };
      })
    );
    contents.push({ role: "user", parts: results });
  }

  return { text: "Sorry, that took too many steps. Please ask a simpler question.", tools_used: toolsUsed };
}
