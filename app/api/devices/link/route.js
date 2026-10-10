import { linkDevice } from "@/lib/devices";
import { getUser } from "@/lib/getUserDevice";

// POST /api/devices/link - links the device printed with this code to the logged-in user.
// Body: { "link_code": "ABC123" }
export async function POST(request) {
  const { user, response } = await getUser();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { device, error, status } = await linkDevice(user, body?.link_code);
  if (error) return Response.json({ error }, { status });

  return Response.json({ ok: true, device });
}
