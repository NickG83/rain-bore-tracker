export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return new Response("from and to are required (YYYY-MM-DD)", { status: 400 });
  }

  const row = await ctx.env.DB.prepare(`
    SELECT
      SUM(COALESCE(rain_mm, 0))      AS rain_mm_total,
      SUM(COALESCE(bore_litres, 0))  AS bore_litres_total
    FROM entries
    WHERE entry_date BETWEEN ? AND ?
  `).bind(from, to).first();

  return Response.json({
    from,
    to,
    rain_mm_total: Number(row?.rain_mm_total ?? 0),
    bore_litres_total: Number(row?.bore_litres_total ?? 0),
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
