export async function onRequestGet(ctx) {
  const row = await ctx.env.DB.prepare(`
    SELECT entry_date, rain_mm
    FROM entries
    WHERE rain_mm IS NOT NULL AND rain_mm > 0
    ORDER BY entry_date DESC, updated_at DESC
    LIMIT 1
  `).first();

  return Response.json(
    {
      last_date: row?.entry_date ?? null,
      last_rain_mm: row?.rain_mm ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
