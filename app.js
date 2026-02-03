// Booker — local-first book sorter + simple API key generator
// Data stored in localStorage.

const STORAGE_KEY = "booker.collection.v1";
const API_KEY_STORAGE_KEY = "booker.api_key.v1";

const els = {
  form: document.getElementById("bookForm"),
  num: document.getElementById("numInput"),
  title: document.getElementById("titleInput"),
  year: document.getElementById("yearInput"),
  notes: document.getElementById("notesInput"),
  tbody: document.getElementById("tbody"),
  search: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  countLabel: document.getElementById("countLabel"),

  genKeyBtn: document.getElementById("genKeyBtn"),
  clearKeyBtn: document.getElementById("clearKeyBtn"),
  copyKeyBtn: document.getElementById("copyKeyBtn"),
  apiKeyOutput: document.getElementById("apiKeyOutput"),
  keyStatus: document.getElementById("keyStatus"),
};

let state = {
  items: loadItems(),
  sort: { key: "number", dir: "asc" },
  search: "",
  apiKey: loadApiKey(),
};

function setStatus(msg) {
  if (!els.keyStatus) return;
  els.keyStatus.textContent = msg || "";
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function loadApiKey() {
  try {
    const k = localStorage.getItem(API_KEY_STORAGE_KEY);
    return (k && typeof k === "string") ? k : "";
  } catch {
    return "";
  }
}

function saveApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

function renderKey() {
  if (!els.apiKeyOutput || !els.copyKeyBtn) return;
  els.apiKeyOutput.value = state.apiKey || "";
  els.copyKeyBtn.disabled = !state.apiKey;
}

function normalizeText(s) {
  return (s ?? "").toString().toLowerCase().trim();
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return -1;
  if (b === null || b === undefined || b === "") return 1;

  const an = Number(a), bn = Number(b);
  const aIsNum = Number.isFinite(an) && a !== "" && a !== null;
  const bIsNum = Number.isFinite(bn) && b !== "" && b !== null;

  if (aIsNum && bIsNum) return an < bn ? -1 : 1;

  const as = a.toString();
  const bs = b.toString();
  return as.localeCompare(bs, undefined, { numeric: true, sensitivity: "base" });
}

function getFilteredSortedItems() {
  const q = normalizeText(state.search);
  let items = state.items.slice();

  if (q) {
    items = items.filter((it) => {
      const hay = `${it.number ?? ""} ${it.title ?? ""} ${it.year ?? ""} ${it.notes ?? ""}`;
      return normalizeText(hay).includes(q);
    });
  }

  const { key, dir } = state.sort;
  items.sort((x, y) => {
    const cmp = compareValues(x[key], y[key]);
    return dir === "asc" ? cmp : -cmp;
  });

  return items;
}

function updateCountLabel(count) {
  if (!els.countLabel) return;
  els.countLabel.textContent = `${count} book${count === 1 ? "" : "s"}`;
}

function render() {
  if (!els.tbody) return;

  const items = getFilteredSortedItems();
  updateCountLabel(items.length);

  els.tbody.innerHTML = "";

  for (const it of items) {
    const tr = document.createElement("tr");

    const tdNum = document.createElement("td");
    tdNum.textContent = it.number ?? "";
    tr.appendChild(tdNum);

    const tdTitle = document.createElement("td");
    tdTitle.textContent = it.title ?? "";
    tr.appendChild(tdTitle);

    const tdYear = document.createElement("td");
    tdYear.textContent = it.year ?? "";
    tr.appendChild(tdYear);

    const tdNotes = document.createElement("td");
    tdNotes.textContent = it.notes ?? "";
    tr.appendChild(tdNotes);

    const tdActions = document.createElement("td");
    tdActions.className = "right row-actions";

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.addEventListener("click", () => {
      state.items = state.items.filter((x) => x.id !== it.id);
      saveItems();
      render();
    });

    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    els.tbody.appendChild(tr);
  }
}

function addItem({ number, title, year, notes }) {
  const trimmedTitle = (title ?? "").toString().trim();
  if (!trimmedTitle) return;

  const numVal = number === "" ? null : Number(number);
  const yearVal = year === "" ? null : Number(year);

  const item = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
    number: Number.isFinite(numVal) ? numVal : null,
    title: trimmedTitle,
    year: Number.isFinite(yearVal) ? yearVal : null,
    notes: (notes ?? "").toString().trim(),
    createdAt: new Date().toISOString(),
  };

  state.items.push(item);
  saveItems();
}

function exportJson() {
  const payload = {
    app: "Booker",
    version: 1,
    exportedAt: new Date().toISOString(),
    apiKey: state.apiKey || "",
    items: state.items,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `Booker-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function importJsonFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert("That file wasn't valid JSON.");
    return;
  }

  const importedItems = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(importedItems)) {
    alert("JSON didn't contain a valid 'items' array.");
    return;
  }

  const cleaned = importedItems
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: x.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      number: Number.isFinite(Number(x.number)) ? Number(x.number) : null,
      title: (x.title ?? "").toString().trim(),
      year: Number.isFinite(Number(x.year)) ? Number(x.year) : null,
      notes: (x.notes ?? "").toString().trim(),
      createdAt: x.createdAt || new Date().toISOString(),
    }))
    .filter((x) => x.title.length > 0 || x.number !== null || x.year !== null || x.notes.length > 0);

  if (cleaned.length === 0) {
    alert("No usable items found in that JSON.");
    return;
  }

  const ok = confirm(`Import ${cleaned.length} item(s)?\n\nOK = replace your current list\nCancel = do nothing`);
  if (!ok) return;

  state.items = cleaned;

  const importedKey =
    (parsed && typeof parsed === "object" && typeof parsed.apiKey === "string") ? parsed.apiKey : "";

  if (importedKey) {
    state.apiKey = importedKey;
    saveApiKey(importedKey);
    setStatus("Imported API key from JSON.");
  } else {
    setStatus("Imported books. (No API key in JSON.)");
  }

  saveItems();
  renderKey();
  render();
}

/**
 * Generate a "special" API key
 * Uses cryptographically secure random bytes.
 * Format: booker_<base64url>
 */
function generateApiKey() {
  if (!window.crypto || !crypto.getRandomValues) {
    throw new Error("Secure random not available (crypto.getRandomValues missing).");
  }

  const bytes = new Uint8Array(32); // 256-bit
  crypto.getRandomValues(bytes);

  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `booker_${b64}`;
}

async function copyKeyToClipboard() {
  const key = state.apiKey;
  if (!key) return;

  try {
    await navigator.clipboard.writeText(key);
    if (els.copyKeyBtn) {
      const old = els.copyKeyBtn.textContent;
      els.copyKeyBtn.textContent = "Copied!";
      setTimeout(() => (els.copyKeyBtn.textContent = old || "Copy"), 900);
    }
    setStatus("Copied key. You shoud save the key in notepad or smtn.");
  } catch {
    // Fallback: select input so user can Ctrl+C
    if (els.apiKeyOutput) {
      els.apiKeyOutput.focus();
      els.apiKeyOutput.select();
    }
    alert("Clipboard blocked. The key is selected — press Ctrl+C to copy.");
    setStatus("Clipboard blocked; key selected for Ctrl+C.");
  }
}

/* -------------------- Wire up events -------------------- */

if (els.form) {
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    addItem({
      number: els.num?.value ?? "",
      title: els.title?.value ?? "",
      year: els.year?.value ?? "",
      notes: els.notes?.value ?? "",
    });

    if (els.num) els.num.value = "";
    if (els.title) els.title.value = "";
    if (els.year) els.year.value = "";
    if (els.notes) els.notes.value = "";
    els.title?.focus();

    render();
  });
}

els.search?.addEventListener("input", (e) => {
  state.search = e.target.value ?? "";
  render();
});

els.exportBtn?.addEventListener("click", exportJson);

els.importInput?.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  await importJsonFile(file);
  e.target.value = "";
});

els.clearAllBtn?.addEventListener("click", () => {
  const ok = confirm("Clear ALL books from this browser? (This cannot be undone)");
  if (!ok) return;
  state.items = [];
  saveItems();
  render();
  setStatus("");
});

document.querySelectorAll("th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    if (!key) return;

    if (state.sort.key === key) {
      state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    } else {
      state.sort.key = key;
      state.sort.dir = "asc";
    }
    render();
  });
});

// API key actions
els.genKeyBtn?.addEventListener("click", () => {
  try {
    // No confirm (removes the #1 cause of "nothing happened")
    state.apiKey = generateApiKey();
    saveApiKey(state.apiKey);
    renderKey();
    setStatus("Generated key. You shoud save the key in notepad or smtn.");

    // Try to copy automatically (nice UX, fails gracefully)
    copyKeyToClipboard();
  } catch (err) {
    alert(err?.message || "Failed to generate key.");
    setStatus("Failed to generate key.");
  }
});

els.clearKeyBtn?.addEventListener("click", () => {
  const ok = confirm("Clear the stored API key from this browser?");
  if (!ok) return;

  state.apiKey = "";
  clearApiKey();
  renderKey();
  setStatus("Cleared key.");
});

els.copyKeyBtn?.addEventListener("click", copyKeyToClipboard);

/* -------------------- Initial render -------------------- */
renderKey();
render();
setStatus(state.apiKey ? "Loaded existing key from this browser." : "");
