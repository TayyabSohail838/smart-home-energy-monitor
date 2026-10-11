import { listAlerts } from "@/lib/alerts";
import { getUserDevice } from "@/lib/getUserDevice";

// GET /api/alerts - the user's anomaly and slab alerts, newest first (max 50).
export async function GET() {
  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json({ alerts: await listAlerts(supabase, device.id) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load alerts" }, { status: 500 });
  }
}
