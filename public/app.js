// public/app.js
// Adds Edit/Delete support via /api/entries/:id (PUT/DELETE)

let chart = null;
let editingId = null; // when set, Save button performs an update

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${text.slice(0, 400)}`);
  if (!ct.includes("application/json")) throw new Error(`Expected JSON but got ${ct} - ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function setStatus(msg, clearMs = 2500) {
  const status = $("status");
  status.textContent = msg || "";
  if (msg && clearMs) setTimeout(() => (status.textContent = ""), clearMs);
}

function setEditMode(id) {
  editingId = id;
  const saveBtn = $("save_btn");
  const cancelBtn = $("cancel_btn");

  if (editingId) {
    saveBtn.textContent = "Update entry";
    cancelBtn.style.display = "inline-block";
  } else {
    saveBtn.textContent = "Save entry";
    cancelBtn.style.display = "none";
  }
}

function clearFormKeepDate() {
  $("rain_mm").value = "";
  $("bore_litres").value = "";
  $("notes").value = "";
}

function loadEntryIntoForm(e) {
  $("entry_date").value = e.entry_date;
  $("rain_mm").value = e.rain_mm ?? "";
  $("bore_litres").value = e.bore_litres ? formatIntWithCommas(e.bore_litres) : "";
  $("notes").value = e.notes ?? "";
}

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

  entries.slice(0, 50).forEach((e) => {
    const tr = document.createElement("tr");
    tr.dataset.id = e.id;

    tr.innerHTML = `
      <td>${e.entry_date}</td>
      <td class="num">${e.rain_mm ?? ""}</td>
      <td class="num">${e.bore_litres ? formatIntWithCommas(e.bore_litres) : ""}</td>
      <td>${e.notes ?? ""}</td>
      <td>
        <button type="button" data-action="edit">Edit</button>
        <button type="button" data-action="delete">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  });

  if (entries.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">No entries yet.</td>`;
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

function buildPayloadFromForm() {
  const entry_date = $("entry_date").value;

  const rain_mm_raw = $("rain_mm").value;
  const bore_raw = $("bore_litres").value;
  const notes_raw = $("notes").value;

  const rain_mm = parseNumberOrNull(rain_mm_raw);
  const bore_num = parseNumberOrNull(bore_raw);

  if (!entry_date) throw new Error("Date is required.");
  if (Number.isNaN(rain_mm)) throw new Error("Rain (mm) must be a number.");
  if (Number.isNaN(bore_num)) throw new Error("Bore usage must be a number (litres).");

  const bore_litres = bore_num === null ? null : Math.round(bore_num);

  if (rain_mm !== null && rain_mm < 0) throw new Error("Rain (mm) must be positive.");
  if (bore_litres !== null && bore_litres < 0) throw new Error("Bore usage must be positive.");

  // Optional: prevent empty entries (allow notes-only if you want; tweak as desired)
  if (rain_mm === null && (bore_litres === null || bore_litres === 0) && notes_raw.trim() === "") {
    throw new Error("Enter rain or bore (or add a note) before saving.");
  }

  return {
    entry_date,
    rain_mm,
    bore_litres: bore_litres === 0 ? null : bore_litres,
    method: "manual",
    notes: notes_raw.trim() === "" ? null : notes_raw.trim(),
  };
}

async function saveOrUpdateEntry() {
  const btn = $("save_btn");
  btn.disabled = true;
  setStatus(editingId ? "Updating..." : "Saving...", 0);

  try {
    const payload = buildPayloadFromForm();

    if (editingId) {
      await fetchJson(`/api/entries/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus("Updated.");
      setEditMode(null);
    } else {
      await fetchJson("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus("Saved.");
    }

    clearFormKeepDate();
    await refresh();
  } catch (e) {
    setStatus(`Error: ${e?.message || e}`, 6000);
  } finally {
    btn.disabled = false;
    // clear status later if it wasn't an error
    setTimeout(() => {
      if ($("status").textContent && !$("status").textContent.startsWith("Error:")) {
        $("status").textContent = "";
      }
    }, 2500);
  }
}

async function deleteEntry(id) {
  const ok = confirm("Delete this entry? This cannot be undone.");
  if (!ok) return;

  setStatus("Deleting...", 0);

  try {
    await fetchJson(`/api/entries/${id}`, { method: "DELETE" });

    // If you were editing the same record, exit edit mode
    if (editingId === id) {
      setEditMode(null);
      clearFormKeepDate();
    }

    await refresh();
    setStatus("Deleted.");
  } catch (e) {
    setStatus(`Error: ${e?.message || e}`, 6000);
  }
}

async function startEdit(id) {
  setStatus("Loading entry...", 0);
  try {
    // We already have data in the table, but simplest is to fetch all and find it
    // (still tiny dataset). If you want, we can add GET /api/entries/:id later.
    const entries = await fetchJson("/api/entries");
    const e = entries.find((x) => x.id === id);
    if (!e) throw new Error("Entry not found.");

    loadEntryIntoForm(e);
    setEditMode(id);
    setStatus("Editing entry.");
  } catch (err) {
    setStatus(`Error: ${err?.message || err}`, 6000);
  }
}

function cancelEdit() {
  setEditMode(null);
  clearFormKeepDate();
  setStatus("Edit cancelled.");
}

function wire() {
  $("entry_date").value = todayYYYYMMDD();

  $("save_btn").onclick = saveOrUpdateEntry;
  $("cancel_btn").onclick = cancelEdit;
  $("download_btn").onclick = () => {
  // Triggers the browser file download
  window.location.href = "/api/export";
};

  // Event delegation for Edit/Delete buttons in the table
  $("entries_body").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const tr = btn.closest("tr");
    const id = tr?.dataset?.id;

    if (!id) return;

    if (action === "edit") startEdit(id);
    if (action === "delete") deleteEntry(id);
  });

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
