import { getForecast } from "@/lib/forecast";
import { getUserDevice } from "@/lib/getUserDevice";

// GET /api/forecast - predicted kWh for the next 7 days and next month from the weather,
// with saving suggestions.
export async function GET() {
  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    const forecast = await getForecast(supabase, device.id);
    if (forecast.error) return Response.json(forecast, { status: 422 });
    return Response.json(forecast);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load forecast" }, { status: 500 });
  }
}
