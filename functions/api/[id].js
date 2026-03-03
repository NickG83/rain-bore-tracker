export async function onRequestPut(ctx) {
  const id = ctx.params.id;
  const body = await ctx.request.json();
  const now = new Date().toISOString();

  const entry_date = body.entry_date;
  if (!entry_date) return new Response("entry_date required", { status: 400 });

  await ctx.env.DB.prepare(`
    UPDATE entries
    SET entry_date = ?,
        rain_mm = ?,
        bore_litres = ?,
        method = ?,
        notes = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    entry_date,
    body.rain_mm ?? null,
    body.bore_litres ?? null,
    body.method ?? "manual",
    body.notes ?? null,
    now,
    id
  ).run();

  return Response.json({ ok: true });
}

export async function onRequestDelete(ctx) {
  const id = ctx.params.id;

  await ctx.env.DB.prepare(`DELETE FROM entries WHERE id = ?`)
    .bind(id)
    .run();

  return Response.json({ ok: true });
}
