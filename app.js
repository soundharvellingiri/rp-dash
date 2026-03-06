const SHEET_ID = "1R8MCP0U2ZZ-ccD29jfw9Hd6BhyYu72cu_aKuDgB1X7M";
const SHEET_NAME = "COMPLETE LIST";
const DEFAULT_REG_NUMBER = "7376232AG114";

const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(
  SHEET_NAME,
)}&tq=${encodeURIComponent("select *")}&tqx=out:json`;

const state = {
  rows: [],
  fetched: false,
  fieldIndex: {
    reg: -1,
    name: -1,
    balance: -1,
    redeemed: -1,
  },
};

const form = document.getElementById("lookup-form");
const searchBtn = document.getElementById("search-btn");
const regInput = document.getElementById("reg-number");
const modalEl = document.getElementById("student-modal");
const modalCloseEl = document.getElementById("modal-close");
const modalListEl = document.getElementById("modal-list");
const modalTitleEl = document.getElementById("modal-title");
const resultEl = document.getElementById("result");
const nameEl = document.getElementById("student-name");
const regEl = document.getElementById("student-reg");
const balanceEl = document.getElementById("balance-points");
const redeemedEl = document.getElementById("redeemed-points");

form.addEventListener("submit", handleLookup);
modalCloseEl.addEventListener("click", hideModal);
modalEl.addEventListener("click", (event) => {
  if (event.target === modalEl) {
    hideModal();
  }
});

async function handleLookup(event) {
  event.preventDefault();

  const query = regInput.value.trim();
  if (!query) {
    hideModal();
    hideResult();
    showWarningModal("Enter a registration number or student name.");
    return;
  }

  setBusy(true);

  try {
    if (!state.fetched) {
      await loadSheetData();
    }

    const matches = findStudents(query);
    if (matches.length === 0) {
      hideModal();
      hideResult();
      showWarningModal("No matching student found for this registration or name.");
      return;
    }

    if (matches.length === 1) {
      hideModal();
      renderStudent(matches[0]);
      return;
    }

    renderMatches(matches);
    hideResult();
  } catch (error) {
    hideModal();
    hideResult();
    showWarningModal(`Unable to fetch data: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

async function loadSheetData() {
  const response = await fetch(SHEET_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payloadText = await response.text();
  const gviz = parseGoogleVizResponse(payloadText);

  if (!gviz.table || !Array.isArray(gviz.table.rows) || !Array.isArray(gviz.table.cols)) {
    throw new Error("Sheet response format is invalid.");
  }

  const labels = gviz.table.cols.map((col) => normalizeLabel(col.label || ""));

  state.fieldIndex.reg = findIndexByAliases(labels, ["roll no", "reg no", "registration number", "register number"]);
  state.fieldIndex.name = findIndexByAliases(labels, ["student name", "name"]);
  state.fieldIndex.balance = findIndexByAliases(labels, ["balance points", "balance point"]);
  state.fieldIndex.redeemed = findIndexByAliases(labels, [
    "redeemed points",
    "reedemed points",
    "redeemed point",
    "reedemed point",
    "reward redeemed points",
    "reward reedemed points",
    "reward redeemed point",
    "reward reedemed point",
    "redeem points",
    "redeem point",
  ]);

  if (state.fieldIndex.reg < 0 || state.fieldIndex.balance < 0 || state.fieldIndex.redeemed < 0) {
    throw new Error("Required columns missing. Need: Roll No, Balance Points, Redeemed Points.");
  }

  state.rows = gviz.table.rows
    .map((row) => (row.c || []).map((cell) => getCellValue(cell)))
    .filter((row) => row[state.fieldIndex.reg]);

  state.fetched = true;
}

function parseGoogleVizResponse(rawText) {
  const startIndex = rawText.indexOf("{");
  const endIndex = rawText.lastIndexOf("}");

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error("Unexpected gviz payload.");
  }

  return JSON.parse(rawText.slice(startIndex, endIndex + 1));
}

function findStudents(query) {
  const normalizedRegQuery = normalizeReg(query);
  const normalizedNameQuery = normalizeName(query);

  const scored = state.rows
    .map((row) => {
      const reg = String(row[state.fieldIndex.reg] || "");
      const regNormalized = normalizeReg(reg);
      const nameRaw = state.fieldIndex.name >= 0 ? String(row[state.fieldIndex.name] || "") : "";
      const nameNormalized = normalizeName(nameRaw);
      let score = Number.POSITIVE_INFINITY;

      if (normalizedRegQuery && regNormalized === normalizedRegQuery) {
        score = 0;
      } else if (normalizedRegQuery && regNormalized.endsWith(normalizedRegQuery)) {
        score = 1;
      } else if (normalizedRegQuery && regNormalized.includes(normalizedRegQuery)) {
        score = 2;
      }

      if (normalizedNameQuery && nameNormalized.startsWith(normalizedNameQuery)) {
        score = Math.min(score, 1);
      } else if (normalizedNameQuery && nameNormalized.includes(normalizedNameQuery)) {
        score = Math.min(score, 2);
      }

      return { row, score, nameRaw, reg };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return a.nameRaw.localeCompare(b.nameRaw);
    });

  return scored.slice(0, 25).map((item) => item.row);
}

function normalizeReg(value) {
  return value.toUpperCase().replace(/\s+/g, "");
}

function normalizeName(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findIndexByAliases(labels, aliases) {
  const aliasSet = new Set(aliases.map((alias) => normalizeLabel(alias)));
  return labels.findIndex((label) => aliasSet.has(label));
}

function getCellValue(cell) {
  if (!cell) {
    return null;
  }

  if (cell.v !== null && cell.v !== undefined) {
    return cell.v;
  }

  if (cell.f !== null && cell.f !== undefined) {
    return cell.f;
  }

  return null;
}

function toNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const clean = value.replace(/,/g, "").trim();
    const parsed = Number.parseFloat(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatPoints(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(toNumber(value));
}

function renderStudent(student) {
  const selectedReg = String(student[state.fieldIndex.reg] || "");
  const balance = toNumber(student[state.fieldIndex.balance]);
  const redeemed = toNumber(student[state.fieldIndex.redeemed]);

  nameEl.textContent = student[state.fieldIndex.name] || "Student";
  regEl.textContent = `Reg Number: ${selectedReg || "-"}`;
  balanceEl.textContent = formatPoints(balance);
  redeemedEl.textContent = formatPoints(redeemed);
  regInput.value = selectedReg || regInput.value;

  showResult();
}

function renderMatches(rows) {
  modalTitleEl.textContent = "Select Student";
  modalListEl.innerHTML = "";

  rows.forEach((row) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "modal-option";
    const name = row[state.fieldIndex.name] || "Student";
    const reg = row[state.fieldIndex.reg] || "-";
    button.textContent = `${name} (${reg})`;
    button.addEventListener("click", () => {
      hideModal();
      renderStudent(row);
    });
    modalListEl.appendChild(button);
  });

  showModal();
}

function setBusy(isBusy) {
  searchBtn.disabled = isBusy;
  searchBtn.textContent = isBusy ? "Searching..." : "Search";
}

function showResult() {
  resultEl.classList.add("is-visible");
}

function hideResult() {
  resultEl.classList.remove("is-visible");
}

function showModal() {
  modalEl.classList.add("is-visible");
  modalEl.setAttribute("aria-hidden", "false");
}

function hideModal() {
  modalEl.classList.remove("is-visible");
  modalEl.setAttribute("aria-hidden", "true");
  modalListEl.innerHTML = "";
}

function showWarningModal(message) {
  modalTitleEl.textContent = "Warning";
  modalListEl.innerHTML = "";

  const warningText = document.createElement("p");
  warningText.className = "modal-warning";
  warningText.textContent = message;
  modalListEl.appendChild(warningText);

  showModal();
}

