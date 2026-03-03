let boreLitres = 0;
const step = 1000;
let chart;

function todayYYYYMMDD() {
  // en-CA gives YYYY-MM-DD in most browsers
  return new Date().toLocaleDateString("en-CA");
}

function setBore(v) {
  boreLitres = Math.max(0, v);
  document.getElementById("bore_value").textContent = boreLitres.toLocaleString();
}

async function refresh() {
  const [entries, summary] = await Promise.all([
    fetch("/api/entries").then(r => r.json()),
    fetch("/api/summary").then(r => r.json()),
  ]);

  // table
  const body = document.getElementById("entries_body");
  body.innerHTML = "";
  entries.slice(0, 15).forEach(e => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.entry_date}</td>
      <td class="num">${e.rain_mm ?? ""}</td>
      <td class="num">${e.bore_litres ? e.bore_litres.toLocaleString() : ""}</td>
      <td class="num">${e.pump_minutes ?? ""}</td>
      <td>${e.notes ?? ""}</td>
    `;
    body.appendChild(tr);
  });
  if (entries.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">No entries yet.</td>`;
    body.appendChild(tr);
  }

  // chart (bore shown as kL)
  const labels = summary.map(x => x.month);
  const rain = summary.map(x => Number(x.rain_mm_total || 0));
  const boreKL = summary.map(x => Number(x.bore_litres_total || 0) / 1000);

  const ctx = document.getElementById("monthly_chart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Rain (mm)", data: rain },
        { label: "Bore (kL)", data: boreKL },
      ]
    },
    options: { responsive: true }
  });
}

async function saveEntry() {
  const status = document.getElementById("status");
  const btn = document.getElementById("save_btn");
  btn.disabled = true;
  status.textContent = "Saving...";

  try {
    const entry_date = document.getElementById("entry_date").value;
    const rain_mm_raw = document.getElementById("rain_mm").value.trim();
    const pump_raw = document.getElementById("pump_minutes").value.trim();
    const notes = document.getElementById("notes").value.trim();

    const payload = {
      entry_date,
      rain_mm: rain_mm_raw === "" ? null : Number(rain_mm_raw),
      bore_litres: boreLitres === 0 ? null : boreLitres,
      pump_minutes: pump_raw === "" ? null : Number(pump_raw),
      method: "manual",
      notes: notes === "" ? null : notes,
    };

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(await res.text());

    // reset quick-entry fields (keep date)
    document.getElementById("rain_mm").value = "";
    document.getElementById("pump_minutes").value = "";
    document.getElementById("notes").value = "";
    setBore(0);

    await refresh();
    status.textContent = "Saved.";
  } catch (e) {
    status.textContent = `Error: ${e.message || e}`;
  } finally {
    setTimeout(() => (status.textContent = ""), 2500);
    btn.disabled = false;
  }
}

function wire() {
  document.getElementById("entry_date").value = todayYYYYMMDD();

  document.getElementById("bore_minus").onclick = () => setBore(boreLitres - step);
  document.getElementById("bore_plus").onclick = () => setBore(boreLitres + step);
  document.getElementById("bore_zero").onclick = () => setBore(0);
  document.getElementById("bore_1000").onclick = () => setBore(1000);
  document.getElementById("bore_2000").onclick = () => setBore(2000);
  document.getElementById("bore_5000").onclick = () => setBore(5000);

  document.getElementById("save_btn").onclick = saveEntry;
}

wire();
refresh();
