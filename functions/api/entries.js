export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let sql = `SELECT * FROM entries`;
  const params = [];

  if (from && to) {
    sql += ` WHERE entry_date BETWEEN ? AND ?`;
    params.push(from, to);
  }

  sql += ` ORDER BY entry_date DESC`;

  const { results } = await ctx.env.DB.prepare(sql).bind(...params).all();
  return Response.json(results);
}

export async function onRequestPost(ctx) {
  const body = await ctx.request.json();
  const now = new Date().toISOString();

  const id = crypto.randomUUID();
  const entry_date = body.entry_date;
  if (!entry_date) return new Response("entry_date required", { status: 400 });

  await ctx.env.DB.prepare(`
    INSERT INTO entries (id, entry_date, rain_mm, bore_litres, pump_minutes, method, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    entry_date,
    body.rain_mm ?? null,
    body.bore_litres ?? null,
    body.pump_minutes ?? null,
    body.method ?? "manual",
    body.notes ?? null,
    now,
    now
  ).run();

  return Response.json({ id });
}
