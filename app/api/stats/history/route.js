import { getUserDevice } from "@/lib/getUserDevice";
import { getHistory, HISTORY_RANGES } from "@/lib/stats";

// GET /api/stats/history?range=day|week|month|30d - kWh for the usage graphs.
export async function GET(request) {
  const range = new URL(request.url).searchParams.get("range") ?? "day";
  if (!HISTORY_RANGES.includes(range)) {
    return Response.json(
      { error: `range must be one of: ${HISTORY_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json(await getHistory(supabase, device.id, range));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load history" }, { status: 500 });
  }
}
