"use strict";

const form = document.querySelector("#estimate-form");
const positionsBody = document.querySelector("#positions-body");
const positionTemplate = document.querySelector("#position-template");
const addPositionButton = document.querySelector("#add-position");
const grandTotal = document.querySelector("#grand-total");
const rowAnnouncement = document.querySelector("#row-announcement");
const dateInput = document.querySelector("#estimate-date");
const discountInput = document.querySelector("#discount-percent");
const vatInput = document.querySelector("#vat-percent");
const currencySelect = document.querySelector("#currency");
const currencyNote = document.querySelector("#currency-note");
const subtotalOutput = document.querySelector("#subtotal");
const discountOutput = document.querySelector("#discount-amount");
const discountedOutput = document.querySelector("#discounted-subtotal");
const vatOutput = document.querySelector("#vat-amount");
const discountRow = document.querySelector("#discount-row");
const discountedRow = document.querySelector("#discounted-row");
const vatRow = document.querySelector("#vat-row");
const senderInput = document.querySelector("#sender");
const recipientInput = document.querySelector("#recipient");
const estimateNumberInput = document.querySelector("#estimate-number");
const commentInput = document.querySelector("#comment");
const savePdfButton = document.querySelector("#save-pdf");
const newEstimateButton = document.querySelector("#new-estimate");
const copyWhatsappButton = document.querySelector("#copy-whatsapp");
const copyStatus = document.querySelector("#copy-status");
const manualCopy = document.querySelector("#manual-copy");
const copyTextInput = document.querySelector("#copy-text");
const storageNotice = document.querySelector("#storage-notice");

const draftStorageKey = "smeta-za-5-minut.draft.v1";
const draftFields = {
  sender: senderInput,
  recipient: recipientInput,
  number: estimateNumberInput,
  date: dateInput,
  discount: discountInput,
  vat: vatInput,
  currency: currencySelect,
  comment: commentInput,
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const printNumberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 20,
});

let nextRowId = 0;
let isRestoringDraft = true;
let copyStatusTimer;
let copyRequestId = 0;

function getToday() {
  // Используем местную дату устройства: UTC может дать соседний день.
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function collectDraft() {
  return {
    version: 1,
    fields: Object.fromEntries(Object.entries(draftFields).map(([key, input]) => [key, input.value])),
    positions: Array.from(positionsBody.rows, (row) => Object.fromEntries(
      ["name", "quantity", "unit", "price"].map((field) => [field, row.querySelector(`[data-field="${field}"]`).value])
    )),
  };
}

function saveDraft() {
  if (isRestoringDraft) {
    return;
  }

  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(collectDraft()));
    storageNotice.hidden = true;
  } catch {
    storageNotice.textContent = "Не удалось сохранить черновик в этом браузере. Скопируйте текст сметы или сохраните PDF.";
    storageNotice.hidden = false;
  }
}

function readDraft() {
  try {
    const saved = window.localStorage.getItem(draftStorageKey);
    if (saved === null) {
      return null;
    }

    const draft = JSON.parse(saved);
    const validFields = draft?.fields && Object.keys(draftFields).every((key) => typeof draft.fields[key] === "string");
    const validPositions = Array.isArray(draft?.positions) && draft.positions.every((position) => (
      position && ["name", "quantity", "unit", "price"].every((field) => typeof position[field] === "string")
      && ["шт", "час", "услуга"].includes(position.unit)
    ));

    if (draft?.version !== 1 || !validFields || !validPositions || !["₸", "₽", "$", "€"].includes(draft.fields.currency)) {
      throw new Error("Некорректный черновик");
    }

    return draft;
  } catch {
    storageNotice.textContent = "Не удалось восстановить черновик. Можно заполнить смету заново и сохранить её в PDF или скопировать текст.";
    storageNotice.hidden = false;
    return null;
  }
}

function parseNumber(value) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  // Не принимаем частично верные строки вроде «15000abc» и отрицательные числа.
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return 0;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(number) {
  const safeNumber = Number.isFinite(number) ? number : 0;
  return numberFormatter.format(safeNumber).replace(/[\u00a0\u202f]/g, " ");
}

function formatMoney(number) {
  const safeNumber = Number.isFinite(number) ? number : 0;
  const amount = moneyFormatter.format(safeNumber).replace(/[\u00a0\u202f]/g, " ");
  return `${amount} ${currencySelect.value || "₸"}`;
}

function formatDetailedNumber(value) {
  return printNumberFormatter.format(parseNumber(value)).replace(/[\u00a0\u202f]/g, " ");
}

function roundAmount(number) {
  const rounded = Math.round(number);
  return Number.isSafeInteger(rounded) ? rounded : 0;
}

function calculateLineTotal(row) {
  const quantity = parseNumber(row.querySelector('[data-field="quantity"]').value);
  const price = parseNumber(row.querySelector('[data-field="price"]').value);
  return roundAmount(quantity * price);
}

function calculateTotals(subtotal, discountPercent, vatPercent) {
  // Все этапы округляются до целых, чтобы видимые строки сходились с итогом.
  const discount = roundAmount(subtotal * (Math.min(discountPercent, 100) / 100));
  const discountedSubtotal = subtotal - discount;
  const vat = roundAmount(discountedSubtotal * (vatPercent / 100));

  return {
    discount,
    discountedSubtotal,
    vat,
    total: roundAmount(discountedSubtotal + vat),
  };
}

function recalculate() {
  let subtotal = 0;
  const currency = currencySelect.value || "₸";

  for (const row of positionsBody.rows) {
    const lineTotal = calculateLineTotal(row);
    subtotal += lineTotal;
    row.querySelector('[data-field="total"]').textContent = formatMoney(lineTotal);
    row.querySelector(".price-currency").textContent = currency;
    row.querySelector('[data-field="price"]').setAttribute("aria-label", `Цена, ${currency}`);
  }

  const totals = calculateTotals(roundAmount(subtotal), parseNumber(discountInput.value), parseNumber(vatInput.value));
  subtotalOutput.textContent = formatMoney(roundAmount(subtotal));
  discountOutput.textContent = formatMoney(totals.discount);
  discountedOutput.textContent = formatMoney(totals.discountedSubtotal);
  vatOutput.textContent = formatMoney(totals.vat);
  grandTotal.textContent = formatMoney(totals.total);
  discountRow.hidden = totals.discount === 0;
  discountedRow.hidden = totals.discountedSubtotal === 0;
  vatRow.hidden = totals.vat === 0;
  currencyNote.textContent = `Все суммы — ${currency}`;
}

function updateRowLabels() {
  Array.from(positionsBody.rows).forEach((row, index) => {
    row.querySelector(".remove-button").setAttribute("aria-label", `Удалить позицию ${index + 1}`);
    row.querySelector('[data-field="total"]').setAttribute("aria-label", `Сумма позиции ${index + 1}`);
  });
}

function getEstimateHeading() {
  const number = estimateNumberInput.value.trim() || "—";
  const date = dateInput.value ? dateInput.value.split("-").reverse().join(".") : "—";
  return `Смета № ${number} от ${date}`;
}

function preparePrint() {
  recalculate();

  document.querySelector("#print-title").textContent = getEstimateHeading();
  document.querySelector("#print-sender").textContent = senderInput.value.trim() || "—";
  document.querySelector("#print-recipient").textContent = recipientInput.value.trim() || "—";

  for (const row of positionsBody.rows) {
    row.querySelector('[data-print-field="name"]').textContent = row.querySelector('[data-field="name"]').value.trim() || "—";
    row.querySelector('[data-print-field="unit"]').textContent = row.querySelector('[data-field="unit"]').value;

    for (const field of ["quantity", "price"]) {
      const formatted = formatDetailedNumber(row.querySelector(`[data-field="${field}"]`).value);
      row.querySelector(`[data-print-field="${field}"]`).textContent = field === "price"
        ? `${formatted} ${currencySelect.value || "₸"}`
        : formatted;
    }
  }

  const comment = commentInput.value.trim();
  document.querySelector("#print-comment").textContent = comment;
  document.querySelector(".comment-card").classList.toggle("is-empty", comment === "");
}

function buildShareText() {
  recalculate();
  const lines = [getEstimateHeading()];

  if (senderInput.value.trim()) {
    lines.push(`От кого: ${senderInput.value.trim()}`);
  }
  if (recipientInput.value.trim()) {
    lines.push(`Для кого: ${recipientInput.value.trim()}`);
  }
  lines.push("");

  for (const row of positionsBody.rows) {
    const name = row.querySelector('[data-field="name"]').value.trim();
    const quantity = row.querySelector('[data-field="quantity"]').value;
    const price = row.querySelector('[data-field="price"]').value;
    const unit = row.querySelector('[data-field="unit"]').value;
    if (!name && parseNumber(quantity) === 0 && parseNumber(price) === 0) {
      continue;
    }

    const priceText = `${formatDetailedNumber(price)} ${currencySelect.value || "₸"}`;
    lines.push(`• ${name || "Без наименования"} — ${formatDetailedNumber(quantity)} ${unit} × ${priceText} = ${row.querySelector('[data-field="total"]').textContent}`);
  }

  lines.push("", `Сумма: ${subtotalOutput.textContent}`);
  if (!discountRow.hidden) {
    lines.push(`Скидка: ${discountOutput.textContent}`, `Сумма со скидкой: ${discountedOutput.textContent}`);
  }
  if (!vatRow.hidden) {
    lines.push(`НДС: ${vatOutput.textContent}`);
  }
  lines.push(`Итого к оплате: ${grandTotal.textContent}`);

  if (commentInput.value.trim()) {
    lines.push("", `Комментарий: ${commentInput.value.trim()}`);
  }
  return lines.join("\n");
}

function clearCopyFeedback() {
  copyRequestId += 1;
  window.clearTimeout(copyStatusTimer);
  copyStatus.textContent = "";
  manualCopy.hidden = true;
  copyTextInput.value = "";
}

async function copyForWhatsapp() {
  const text = buildShareText();
  clearCopyFeedback();
  const requestId = copyRequestId;

  try {
    await navigator.clipboard.writeText(text);
    if (requestId !== copyRequestId) {
      return;
    }
    copyStatus.textContent = "Скопировано ✓";
    copyStatusTimer = window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 2000);
  } catch {
    if (requestId !== copyRequestId) {
      return;
    }
    copyTextInput.value = text;
    manualCopy.hidden = false;
    copyTextInput.focus();
    copyTextInput.select();
  }
}

function nextEstimateNumber(value) {
  const match = value.trim().match(/^(.*?)(\d+)$/);
  if (!match) {
    return "1";
  }
  const number = (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0");
  return `${match[1]}${number}`;
}

function startNewEstimate() {
  if (!window.confirm("Начать новую смету? Текущий черновик будет очищен.")) {
    return;
  }

  const number = nextEstimateNumber(estimateNumberInput.value);
  isRestoringDraft = true;
  form.reset();
  positionsBody.replaceChildren();
  estimateNumberInput.value = number;
  dateInput.value = getToday();
  addPosition({ focus: false });
  isRestoringDraft = false;
  clearCopyFeedback();
  saveDraft();
  senderInput.focus();
  rowAnnouncement.textContent = `Создана новая смета № ${number}.`;
}

function addPosition({ focus = true, values } = {}) {
  const fragment = positionTemplate.content.cloneNode(true);
  const row = fragment.querySelector("tr");
  nextRowId += 1;

  for (const label of row.querySelectorAll("[data-label-for]")) {
    const field = label.dataset.labelFor;
    const input = row.querySelector(`[data-field="${field}"]`);
    const id = `position-${nextRowId}-${field}`;
    label.htmlFor = id;
    input.id = id;
    input.name = id;
    if (values) {
      input.value = values[field];
    }
  }

  positionsBody.append(fragment);
  updateRowLabels();
  recalculate();
  saveDraft();

  if (focus) {
    row.querySelector('[data-field="name"]').focus();
    rowAnnouncement.textContent = `Добавлена позиция ${positionsBody.rows.length}.`;
  }
}

addPositionButton.addEventListener("click", () => addPosition());
positionsBody.addEventListener("input", recalculate);
form.addEventListener("input", saveDraft);
form.addEventListener("change", saveDraft);
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencySelect.addEventListener("change", recalculate);

discountInput.addEventListener("change", () => {
  if (parseNumber(discountInput.value) > 100) {
    discountInput.value = "100";
    recalculate();
    saveDraft();
  }
});

positionsBody.addEventListener("focusout", (event) => {
  if (event.target.matches('[data-field="price"]') && event.target.value.trim() !== "") {
    event.target.value = formatNumber(parseNumber(event.target.value));
    recalculate();
    saveDraft();
  }
});

positionsBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || !event.target.matches("input")) {
    return;
  }

  event.preventDefault();
  const row = event.target.closest("tr");
  if (row === positionsBody.lastElementChild) {
    addPosition();
  }
});

positionsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) {
    return;
  }

  const row = button.closest("tr");
  const focusTarget = row.nextElementSibling || row.previousElementSibling;
  row.remove();

  if (positionsBody.rows.length === 0) {
    addPosition();
  } else {
    updateRowLabels();
    recalculate();
    focusTarget.querySelector('[data-field="name"]').focus();
  }

  rowAnnouncement.textContent = `Позиция удалена. Всего позиций: ${positionsBody.rows.length}.`;
  saveDraft();
});

form.addEventListener("submit", (event) => event.preventDefault());

savePdfButton.addEventListener("click", () => {
  preparePrint();
  window.print();
});
window.addEventListener("beforeprint", preparePrint);
newEstimateButton.addEventListener("click", startNewEstimate);
copyWhatsappButton.addEventListener("click", copyForWhatsapp);

dateInput.value = getToday();
const savedDraft = readDraft();
if (savedDraft) {
  for (const [key, input] of Object.entries(draftFields)) {
    input.value = savedDraft.fields[key];
  }
  for (const position of savedDraft.positions) {
    addPosition({ focus: false, values: position });
  }
}
if (positionsBody.rows.length === 0) {
  addPosition({ focus: false });
}
isRestoringDraft = false;
recalculate();
