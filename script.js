"use strict";

const form = document.querySelector("#estimate-form");
const positionsBody = document.querySelector("#positions-body");
const positionTemplate = document.querySelector("#position-template");
const addPositionButton = document.querySelector("#add-position");
const grandTotal = document.querySelector("#grand-total");
const rowAnnouncement = document.querySelector("#row-announcement");
const dateInput = document.querySelector("#estimate-date");

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
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
  return `${formatNumber(number)} ₸`;
}

function calculateLineCents(row) {
  const quantity = parseNumber(row.querySelector('[data-field="quantity"]').value);
  const price = parseNumber(row.querySelector('[data-field="price"]').value);
  // Округляем каждую строку до сотых и складываем целые числа, чтобы избежать
  // накопления погрешности при сложении денежных сумм.
  const cents = Math.round((quantity * price + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

function recalculate() {
  let totalCents = 0;

  for (const row of positionsBody.rows) {
    const lineCents = calculateLineCents(row);
    totalCents += lineCents;
    row.querySelector('[data-field="total"]').textContent = formatMoney(lineCents / 100);
  }

  grandTotal.textContent = formatMoney(totalCents / 100);
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

  row.querySelector('[data-field="price"]').setAttribute("aria-label", "Цена, тенге");
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
