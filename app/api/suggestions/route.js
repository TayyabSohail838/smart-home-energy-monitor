import { ChatConfigError, ChatQuotaError } from "@/lib/chat/gemini";
import { getSuggestions } from "@/lib/chat/suggestions";
import { getUserDevice } from "@/lib/getUserDevice";

// GET /api/suggestions?refresh=1 - three AI tips for the Overview, from the user's own data.
// Returns { suggestions: [{ title, text }], at, tools_used, cached }.
export async function GET(request) {
  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    return Response.json(await getSuggestions({ supabase, deviceId: device.id }, { refresh }));
  } catch (err) {
    if (err instanceof ChatConfigError) {
      return Response.json({ error: "AI suggestions need GEMINI_API_KEY." }, { status: 503 });
    }
    if (err instanceof ChatQuotaError) {
      return Response.json({ error: "The AI is busy (Gemini quota). Try again in a minute." }, { status: 429 });
    }
    console.error("suggestions failed:", err);
    return Response.json({ error: "Couldn't write suggestions right now." }, { status: 502 });
  }
}
