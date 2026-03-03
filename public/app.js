// public/app.js
// Vanilla JS app controller for Rain & Bore Tracker (Pages + D1)
// Assumes index.html has:
// - #entry_date, #rain_mm, #bore_litres, #notes
// - #save_btn, #status
// - #entries_body, #monthly_chart
//
// Note: Chart.js is loaded globally via CDN as `Chart`.

let chart = null;

/** ---------- Utilities ---------- **/

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

// Reliable YYYY-MM-DD (don’t rely on locale)
function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Parse numeric inputs that may include commas/spaces
function parseNumberOrNull(raw) {
  const cleaned = String(raw ?? "").trim().replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function formatIntWithCommas(n) {
  return Number(n).toLocaleString();
}

// Fetch helper that surfaces real errors (HTML, Access redirects, etc.)
async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} - ${text.slice(0, 400)}`);
  }
  if (!ct.includes("application/json")) {
    throw new Error(`Expected JSON but got ${ct} - ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

/** ---------- UI Actions ---------- **/

async function refresh() {
  const [entries, summary] = await Promise.all([
    fetchJson("/api/entries"),
    fetchJson("/api/summary"),
  ]);

  renderTable(entries);
  renderMonthlyChart(summary);
}

function renderTable(entries) {
  const body = $("entries_body");
  body.innerHTML = "";

  entries.slice(0, 15).forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.entry_date}</td>
      <td class="num">${e.rain_mm ?? ""}</td>
      <td class="num">${e.bore_litres ? formatIntWithCommas(e.bore_litres) : ""}</td>
      <td>${e.notes ?? ""}</td>
    `;
    body.appendChild(tr);
  });

  if (entries.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">No entries yet.</td>`;
    body.appendChild(tr);
  }
}

function renderMonthlyChart(summary) {
  const labels = summary.map((x) => x.month);
  const rain = summary.map((x) => Number(x.rain_mm_total || 0));
  const boreKL = summary.map((x) => Number(x.bore_litres_total || 0) / 1000);

  const canvas = $("monthly_chart");

  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Rain (mm)", data: rain },
        { label: "Bore (kL)", data: boreKL },
      ],
    },
    options: { responsive: true },
  });
}

async function saveEntry() {
  const status = $("status");
  const btn = $("save_btn");

  btn.disabled = true;
  status.textContent = "Saving...";

  try {
    const entry_date = $("entry_date").value;

    const rainRaw = $("rain_mm").value;
    const boreRaw = $("bore_litres").value;
    const notesRaw = $("notes").value;

    const rain_mm = parseNumberOrNull(rainRaw);
    const bore_litres_num = parseNumberOrNull(boreRaw);

    if (!entry_date) throw new Error("Date is required.");

    if (Number.isNaN(rain_mm)) throw new Error("Rain (mm) must be a number.");
    if (Number.isNaN(bore_litres_num)) throw new Error("Bore usage must be a number (litres).");

    // Convert bore to integer litres (null if empty)
    const bore_litres =
      bore_litres_num === null ? null : Math.round(bore_litres_num);

    if (bore_litres !== null && bore_litres < 0) {
      throw new Error("Bore usage must be a positive number (litres).");
    }
    if (rain_mm !== null && rain_mm < 0) {
      throw new Error("Rain (mm) must be a positive number.");
    }

    // Optional guard: disallow totally empty entries
    if (rain_mm === null && (bore_litres === null || bore_litres === 0) && notesRaw.trim() === "") {
      throw new Error("Enter rain or bore (or add a note) before saving.");
    }

    const payload = {
      entry_date,
      rain_mm,
      bore_litres: bore_litres === 0 ? null : bore_litres,
      method: "manual",
      notes: notesRaw.trim() === "" ? null : notesRaw.trim(),
    };

    await fetchJson("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Reset quick-entry fields (keep date)
    $("rain_mm").value = "";
    $("bore_litres").value = "";
    $("notes").value = "";

    await refresh();
    status.textContent = "Saved.";
  } catch (e) {
    status.textContent = `Error: ${e?.message || e}`;
  } finally {
    setTimeout(() => (status.textContent = ""), 2500);
    btn.disabled = false;
  }
}

function wire() {
  $("entry_date").value = todayYYYYMMDD();
  $("save_btn").onclick = saveEntry;

  // Nice-to-have: format bore litres with commas on blur
  $("bore_litres").addEventListener("blur", () => {
    const n = parseNumberOrNull($("bore_litres").value);
    if (n === null || Number.isNaN(n)) return;
    $("bore_litres").value = formatIntWithCommas(Math.round(n));
  });
}

// Boot
wire();
refresh();
