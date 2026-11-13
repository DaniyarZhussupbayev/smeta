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

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

let nextRowId = 0;

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

function addPosition({ focus = true } = {}) {
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
  }

  positionsBody.append(fragment);
  updateRowLabels();
  recalculate();

  if (focus) {
    row.querySelector('[data-field="name"]').focus();
    rowAnnouncement.textContent = `Добавлена позиция ${positionsBody.rows.length}.`;
  }
}

addPositionButton.addEventListener("click", () => addPosition());
positionsBody.addEventListener("input", recalculate);
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencySelect.addEventListener("change", recalculate);

discountInput.addEventListener("change", () => {
  if (parseNumber(discountInput.value) > 100) {
    discountInput.value = "100";
    recalculate();
  }
});

positionsBody.addEventListener("focusout", (event) => {
  if (event.target.matches('[data-field="price"]') && event.target.value.trim() !== "") {
    event.target.value = formatNumber(parseNumber(event.target.value));
    recalculate();
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
});

form.addEventListener("submit", (event) => event.preventDefault());

// Используем местную дату устройства: UTC может дать соседний день.
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, "0");
const day = String(today.getDate()).padStart(2, "0");
dateInput.value = `${year}-${month}-${day}`;

addPosition({ focus: false });
