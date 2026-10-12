import { getUserDevice } from "@/lib/getUserDevice";
import { getVoltageStats, LIVE_RANGES } from "@/lib/stats";
import { HIGH_VOLTAGE_V } from "@/lib/voltage";

// GET /api/stats/voltage?range=1h|24h|week - mains voltage for the Overview's voltage chart.
export async function GET(request) {
  const range = new URL(request.url).searchParams.get("range") ?? "24h";
  if (!LIVE_RANGES.includes(range)) {
    return Response.json({ error: `range must be one of: ${LIVE_RANGES.join(", ")}` }, { status: 400 });
  }

  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    return Response.json({ ...(await getVoltageStats(supabase, device.id, range)), high_voltage_v: HIGH_VOLTAGE_V });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load voltage" }, { status: 500 });
  }
}
