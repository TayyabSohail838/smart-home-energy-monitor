import { getUserDevice } from "@/lib/getUserDevice";
import { getPeakHours } from "@/lib/stats";

// GET /api/stats/peak-hours - average power for each hour of the day (last 14 days) + top 3 hours.
export async function GET() {
  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json(await getPeakHours(supabase, device.id));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load peak hours" }, { status: 500 });
  }
}
