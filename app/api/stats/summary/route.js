import { getSummary } from "@/lib/bill";
import { getUserDevice } from "@/lib/getUserDevice";

// GET /api/stats/summary - today/month kWh, bill so far, slab position and month-end projection.
export async function GET() {
  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json(await getSummary(supabase, device.id));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load summary" }, { status: 500 });
  }
}
