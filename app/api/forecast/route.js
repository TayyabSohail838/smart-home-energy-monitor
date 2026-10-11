import { getForecast, MAX_OUTLOOK_MONTHS } from "@/lib/forecast";
import { getUserDevice } from "@/lib/getUserDevice";

// GET /api/forecast?months=1-12 (default 12)
// Detailed weather + predicted kWh for the next 14 days, a month-by-month outlook
// (weather, units, bill), a year summary and saving suggestions.
export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("months");
  const months = raw === null ? MAX_OUTLOOK_MONTHS : Number(raw);
  if (!Number.isInteger(months) || months < 1 || months > MAX_OUTLOOK_MONTHS) {
    return Response.json({ error: `months must be 1-${MAX_OUTLOOK_MONTHS}` }, { status: 400 });
  }

  const { supabase, device, response } = await getUserDevice();
  if (response) return response;

  try {
    const forecast = await getForecast(supabase, device.id, { months });
    if (forecast.error) return Response.json(forecast, { status: 422 });
    return Response.json(forecast);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load forecast" }, { status: 500 });
  }
}
