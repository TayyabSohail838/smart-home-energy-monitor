// GET /api/health - quick check that the server is up.
export async function GET() {
  return Response.json({ ok: true });
}
