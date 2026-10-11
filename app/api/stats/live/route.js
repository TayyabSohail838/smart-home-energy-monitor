import { getUserDevice } from "@/lib/getUserDevice";
import { getLiveStats, LIVE_RANGES } from "@/lib/stats";

// GET /api/stats/live?range=1h|24h|week - the Overview page's live monitor chart.
export async function GET(request) {
  const range = new URL(request.url).searchParams.get("range") ?? "24h";
  if (!LIVE_RANGES.includes(range)) {
    return Response.json(
      { error: `range must be one of: ${LIVE_RANGES.join(", ")}` },
      { status: 400 }
    );
  }

  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json(await getLiveStats(supabase, device.id, range));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load live stats" }, { status: 500 });
  }
}
