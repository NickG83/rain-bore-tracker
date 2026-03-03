function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Escape double quotes
  const escaped = s.replace(/"/g, '""');
  // Wrap if it contains comma, quote, or newline
  if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
  return escaped;
}

export async function onRequestGet(ctx) {
  const { results } = await ctx.env.DB.prepare(`
    SELECT
      entry_date,
      rain_mm,
      bore_litres,
      notes,
      created_at,
      updated_at
    FROM entries
    ORDER BY entry_date ASC
  `).all();

  const header = ["entry_date", "rain_mm", "bore_litres", "notes", "created_at", "updated_at"];
  const lines = [header.join(",")];

  for (const row of results) {
    const line = [
      csvEscape(row.entry_date),
      csvEscape(row.rain_mm),
      csvEscape(row.bore_litres),
      csvEscape(row.notes),
      csvEscape(row.created_at),
      csvEscape(row.updated_at),
    ].join(",");
    lines.push(line);
  }

  // Add BOM to help Excel open UTF-8 cleanly
  const bom = "\ufeff";
  const csv = bom + lines.join("\r\n");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `rain-bore-tracker-${today}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
