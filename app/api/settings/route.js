import { getUser } from "@/lib/getUserDevice";
import { getSettings, parseSettingsPatch, updateSettings } from "@/lib/settings";

const NO_SETTINGS = { error: "no settings yet; link a device first" };

// GET /api/settings - { email_alerts, alert_email }
export async function GET() {
  const { supabase, user, response } = await getUser();
  if (response) return response;

  try {
    const settings = await getSettings(supabase, user.id);
    return settings ? Response.json(settings) : Response.json(NO_SETTINGS, { status: 404 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not load settings" }, { status: 500 });
  }
}

// PATCH /api/settings - body { "email_alerts": false } and/or { "alert_email": "me@x.com" }
export async function PATCH(request) {
  const { supabase, user, response } = await getUser();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { changes, error } = parseSettingsPatch(body);
  if (error) return Response.json({ error }, { status: 400 });

  try {
    const settings = await updateSettings(supabase, user.id, changes);
    return settings ? Response.json(settings) : Response.json(NO_SETTINGS, { status: 404 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "could not save settings" }, { status: 500 });
  }
}
