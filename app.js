// Booker — simple local-first collection manager
// Stores data in localStorage and can export/import JSON.

const STORAGE_KEY = "booker.collection.v1";

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
};

let state = {
  items: loadItems(),
  sort: { key: "number", dir: "asc" }, // asc | desc
  search: "",
};

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

function normalizeText(s) {
  return (s ?? "").toString().toLowerCase().trim();
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return -1;
  if (b === null || b === undefined || b === "") return 1;

  // numeric compare if both are numbers
  const an = Number(a), bn = Number(b);
  const aIsNum = Number.isFinite(an) && a !== "" && a !== null;
  const bIsNum = Number.isFinite(bn) && b !== "" && b !== null;

  if (aIsNum && bIsNum) return an < bn ? -1 : 1;

  // fallback string compare
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
  els.countLabel.textContent = `${count} book${count === 1 ? "" : "s"}`;
}

function render() {
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

  const numVal = number === "" || number === null || number === undefined ? null : Number(number);
  const yearVal = year === "" || year === null || year === undefined ? null : Number(year);

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
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

  // Accept either a raw array OR our export format
  const importedItems = Array.isArray(parsed) ? parsed : parsed?.items;

  if (!Array.isArray(importedItems)) {
    alert("JSON didn't contain a valid 'items' array.");
    return;
  }

  // Light validation + normalize
  const cleaned = importedItems
    .filter((x) => x && typeof x === "object" && (x.title || x.number || x.year || x.notes))
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

  const ok = confirm(
    `Import ${cleaned.length} item(s)?\n\nOK = replace your current list\nCancel = do nothing`
  );
  if (!ok) return;

  state.items = cleaned;
  saveItems();
  render();
}

// Events
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  addItem({
    number: els.num.value,
    title: els.title.value,
    year: els.year.value,
    notes: els.notes.value,
  });

  els.num.value = "";
  els.title.value = "";
  els.year.value = "";
  els.notes.value = "";
  els.title.focus();

  render();
});

els.search.addEventListener("input", (e) => {
  state.search = e.target.value ?? "";
  render();
});

els.exportBtn.addEventListener("click", exportJson);

els.importInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  await importJsonFile(file);
  e.target.value = ""; // reset so importing same file again works
});

els.clearAllBtn.addEventListener("click", () => {
  const ok = confirm("Clear ALL books from this browser? (This cannot be undone)");
  if (!ok) return;
  state.items = [];
  saveItems();
  render();
});

// Click-to-sort headers
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

// Initial render
render();
