const STORAGE_KEY = 'monthly-budget-planner-v1';
const THEME_KEY = 'monthly-budget-theme-v1';
const CURRENCY_KEY = 'monthly-budget-currency-v1';

const TYPES = ['income', 'expense'];
const OCCURRENCES = ['one-off', 'recurring'];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];
const THEMES = ['light', 'dark', 'auto'];
const CURRENCIES = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];
const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Business', 'Investments', 'Gifts', 'Other'],
  expense: [
    'Housing', 'Utilities', 'Groceries', 'Dining', 'Transport', 'Insurance',
    'Health', 'Entertainment', 'Shopping', 'Debt', 'Savings', 'Other',
  ],
};
const MS_PER_DAY = 86400000;
const UPCOMING_DAYS = 5;

/* ---------- Elements ---------- */

const form = document.querySelector('#entryForm');
const titleInput = document.querySelector('#title');
const amountInput = document.querySelector('#amount');
const typeSelect = document.querySelector('#type');
const categorySelect = document.querySelector('#category');
const occurrenceSelect = document.querySelector('#occurrence');
const dateInput = document.querySelector('#date');
const dateLabelText = document.querySelector('#dateLabelText');
const frequencySelect = document.querySelector('#frequency');
const frequencyField = document.querySelector('#frequencyField');
const notesInput = document.querySelector('#notes');
const monthFilter = document.querySelector('#monthFilter');
const themeModeSelect = document.querySelector('#themeMode');
const currencySelect = document.querySelector('#currency');
const incomeTotalEl = document.querySelector('#incomeTotal');
const expenseTotalEl = document.querySelector('#expenseTotal');
const netTotalEl = document.querySelector('#netTotal');
const paidTotalEl = document.querySelector('#paidTotal');
const remainingTotalEl = document.querySelector('#remainingTotal');
const paidProgressBar = document.querySelector('#paidProgressBar');
const paidProgressText = document.querySelector('#paidProgressText');
const upcomingBtn = document.querySelector('#upcomingBtn');
const upcomingDialog = document.querySelector('#upcomingDialog');
const upcomingList = document.querySelector('#upcomingList');
const closeUpcomingBtn = document.querySelector('#closeUpcomingBtn');
const entriesList = document.querySelector('#entriesList');
const clearAllBtn = document.querySelector('#clearAllBtn');
const submitBtn = document.querySelector('#submitBtn');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/* ---------- Helpers ---------- */

const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD (not UTC).
function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const todayISO = () => toISODate(new Date());
const thisMonthISO = () => todayISO().slice(0, 7);

function parseLocalDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseLocalDate(value)) === value; // rejects e.g. 2026-02-31
}

// Whole-day index, unaffected by daylight-saving shifts.
const dayIndex = (date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);

function fromDayIndex(index) {
  const d = new Date(index * MS_PER_DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const toCents = (amount) => Math.round(Number(amount) * 100);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function makeId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/* ---------- Data ---------- */

// Returns a clean entry, or null if the data is invalid.
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const amount = Math.round(Number(raw.amount) * 100) / 100;
  const entry = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    title: String(raw.title ?? '').trim(),
    amount,
    type: TYPES.includes(raw.type) ? raw.type : null,
    occurrence: OCCURRENCES.includes(raw.occurrence) ? raw.occurrence : null,
    frequency: FREQUENCIES.includes(raw.frequency) ? raw.frequency : 'monthly',
    date: isValidISODate(raw.date) ? raw.date : null,
    notes: String(raw.notes ?? '').trim(),
    // Dates (YYYY-MM-DD) of the occurrences that have been paid.
    paid: Array.isArray(raw.paid) ? [...new Set(raw.paid.filter(isValidISODate))].sort() : [],
  };

  if (!entry.title || !entry.type || !entry.occurrence || !entry.date) return null;
  // Entries saved before categories existed fall back to 'Other'.
  entry.category = CATEGORIES[entry.type].includes(raw.category) ? raw.category : 'Other';
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return entry;
}

function loadEntries() {
  const saved = storageGet(STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  storageSet(STORAGE_KEY, JSON.stringify(entries));
}

function createSampleEntries() {
  const month = getSelectedMonth();
  const on = (day) => `${month}-${pad(day)}`;

  return [
    { title: 'Salary', amount: 3200, type: 'income', category: 'Salary', occurrence: 'recurring', frequency: 'monthly', date: on(25), notes: 'Main pay' },
    { title: 'Rent', amount: 1200, type: 'expense', category: 'Housing', occurrence: 'recurring', frequency: 'monthly', date: on(1), notes: 'Apartment rent' },
    { title: 'Groceries', amount: 85, type: 'expense', category: 'Groceries', occurrence: 'recurring', frequency: 'weekly', date: on(2), notes: 'Food and household items' },
    { title: 'Car insurance', amount: 640, type: 'expense', category: 'Insurance', occurrence: 'recurring', frequency: 'yearly', date: on(15), notes: 'Annual premium' },
    { title: 'Car service', amount: 180, type: 'expense', category: 'Transport', occurrence: 'one-off', frequency: 'monthly', date: on(10), notes: 'Service and inspection' },
    { title: 'Freelance work', amount: 900, type: 'income', category: 'Freelance', occurrence: 'one-off', frequency: 'monthly', date: on(18), notes: 'One-off client project' },
  ].map((e) => normalizeEntry({ ...e, id: makeId() }));
}

let entries = loadEntries();
let editingId = null;

/* ---------- Month logic ---------- */

function getSelectedMonth() {
  if (!/^\d{4}-\d{2}$/.test(monthFilter.value)) monthFilter.value = thisMonthISO();
  return monthFilter.value;
}

// Dates (YYYY-MM-DD) on which an entry falls between rangeStart and rangeEnd, inclusive.
// Monthly/yearly entries on a day the month lacks (e.g. the 31st) fall on its last day.
function occurrenceDates(entry, rangeStart, rangeEnd) {
  const start = parseLocalDate(entry.date);
  const from = start > rangeStart ? start : rangeStart;
  if (from > rangeEnd) return []; // hasn't started yet

  if (entry.occurrence === 'one-off') {
    return start >= rangeStart ? [entry.date] : [];
  }

  const dates = [];
  const pushIfInRange = (date) => {
    if (date >= from && date <= rangeEnd) dates.push(toISODate(date));
  };

  switch (entry.frequency) {
    case 'weekly': {
      let i = dayIndex(start);
      const a = dayIndex(from);
      if (i < a) i += Math.ceil((a - i) / 7) * 7;
      for (const b = dayIndex(rangeEnd); i <= b; i += 7) dates.push(toISODate(fromDayIndex(i)));
      break;
    }
    case 'monthly':
      for (let y = from.getFullYear(), m = from.getMonth(); new Date(y, m, 1) <= rangeEnd; m++) {
        pushIfInRange(new Date(y, m, Math.min(start.getDate(), daysInMonth(y, m))));
      }
      break;
    case 'yearly':
      for (let y = from.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
        const m = start.getMonth();
        pushIfInRange(new Date(y, m, Math.min(start.getDate(), daysInMonth(y, m))));
      }
      break;
  }
  return dates;
}

function getMonthItems() {
  const [year, month] = getSelectedMonth().split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  return entries
    .map((entry) => {
      const dates = occurrenceDates(entry, monthStart, monthEnd);
      return { entry, dates, count: dates.length };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) =>
      a.entry.date.localeCompare(b.entry.date) || a.entry.title.localeCompare(b.entry.title)
    );
}

/* ---------- Payments ---------- */

const isPaid = (entry, date) => entry.paid.includes(date);

function togglePaid(id, date) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || entry.type !== 'expense' || !isValidISODate(date)) return;

  entry.paid = isPaid(entry, date)
    ? entry.paid.filter((d) => d !== date)
    : [...entry.paid, date].sort();
  saveEntries();
  updateView();
}

// Every expense occurrence from today through the next UPCOMING_DAYS days.
function getUpcomingPayments() {
  const today = parseLocalDate(todayISO());
  const end = addDays(today, UPCOMING_DAYS);

  return entries
    .filter((entry) => entry.type === 'expense')
    .flatMap((entry) =>
      occurrenceDates(entry, today, end).map((date) => ({ entry, date, paid: isPaid(entry, date) }))
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.entry.title.localeCompare(b.entry.title));
}

/* ---------- Formatting ---------- */

const CURRENCY_SYMBOLS = { USD: '$', JMD: 'J$', CAD: 'CA$', GBP: '£', EUR: '€' };
const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
let currencySymbol = '$';

function setCurrency(code) {
  const currency = CURRENCIES.includes(code) ? code : 'USD';
  currencySelect.value = currency;
  currencySymbol = CURRENCY_SYMBOLS[currency];
}

// Symbol, space, then the signed number: "J$ -1,250.00", "£ 980.00".
function formatNumber(cents, showPlus) {
  const sign = cents < 0 ? '-' : showPlus && cents > 0 ? '+' : '';
  return `${sign}${numberFormatter.format(Math.abs(cents) / 100)}`;
}

const formatCents = (cents, showPlus = false) =>
  `${currencySymbol} ${formatNumber(cents, showPlus)}`;

// Same as formatCents, with the number kept on one line so it wraps below
// the symbol when the card is narrow.
function formatCentsHTML(cents) {
  return `${escapeHTML(currencySymbol)} ` +
    `<span class="amount-number">${formatNumber(cents, false)}</span>`;
}

const formatDate = (iso) => parseLocalDate(iso).toLocaleDateString();
const formatShortDate = (iso) =>
  parseLocalDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function describeDue(iso) {
  const days = dayIndex(parseLocalDate(iso)) - dayIndex(parseLocalDate(todayISO()));
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

function describeEntry(entry) {
  if (entry.occurrence === 'one-off') return formatDate(entry.date);
  return `${capitalize(entry.frequency)} from ${formatDate(entry.date)}`;
}

/* ---------- Theme ---------- */

function applyTheme() {
  const saved = storageGet(THEME_KEY);
  const mode = THEMES.includes(saved) ? saved : 'auto';
  const theme = mode === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : mode;

  document.body.dataset.theme = theme;
  themeModeSelect.value = mode;
}

/* ---------- Rendering ---------- */

function renderSummary(items) {
  let income = 0;
  let expense = 0;
  let paid = 0;

  for (const { entry, dates, count } of items) {
    const unitCents = toCents(entry.amount);
    if (entry.type === 'income') {
      income += unitCents * count;
    } else {
      expense += unitCents * count;
      paid += unitCents * dates.filter((date) => isPaid(entry, date)).length;
    }
  }

  incomeTotalEl.innerHTML = formatCentsHTML(income);
  expenseTotalEl.innerHTML = formatCentsHTML(expense);
  netTotalEl.innerHTML = formatCentsHTML(income - expense);
  paidTotalEl.innerHTML = formatCentsHTML(paid);
  remainingTotalEl.innerHTML = formatCentsHTML(expense - paid);

  const percent = expense ? Math.round((paid / expense) * 100) : 0;
  paidProgressBar.style.width = `${percent}%`;
  paidProgressText.textContent = expense ? `${percent}% of expenses paid` : 'No expenses this month';
}

// Toggle button for one occurrence's paid state.
function paidToggle(entry, date, className, text) {
  const paid = isPaid(entry, date);
  return `<button class="${className}${paid ? ' is-paid' : ''}" type="button"
    data-id="${escapeHTML(entry.id)}" data-paid-date="${date}" aria-pressed="${paid}"
    aria-label="Paid: ${escapeHTML(entry.title)}, ${escapeHTML(formatDate(date))}">${text(paid)}</button>`;
}

function renderEntryItem({ entry, dates, count }) {
  const isExpense = entry.type === 'expense';
  const unitCents = toCents(entry.amount);
  const signedTotal = (isExpense ? -1 : 1) * unitCents * count;
  const title = escapeHTML(entry.title);
  const id = escapeHTML(entry.id);
  const detail = count > 1
    ? `<span class="amount-detail">${count} × ${escapeHTML(formatCents(unitCents))}</span>`
    : '';

  const paidCount = isExpense ? dates.filter((date) => isPaid(entry, date)).length : 0;
  const allPaid = isExpense && paidCount === count;
  let paidBadge = '';
  if (allPaid) paidBadge = '<span class="badge paid">✓ Paid</span>';
  else if (paidCount) paidBadge = `<span class="badge paid-partial">${paidCount}/${count} paid</span>`;

  // A single payment gets one button; several (e.g. weekly) get one chip per date.
  const singleToggle = isExpense && count === 1
    ? paidToggle(entry, dates[0], 'paid-btn', (paid) => (paid ? '✓ Paid' : 'Mark paid'))
    : '';
  const chipRow = isExpense && count > 1
    ? `<div class="paid-row">
        <span class="paid-row-label">Mark each payment:</span>
        ${dates.map((date) => paidToggle(entry, date, 'paid-chip',
          (paid) => `${paid ? '✓ ' : ''}${escapeHTML(formatShortDate(date))}`)).join('')}
      </div>`
    : '';

  return `
    <article class="entry-item${allPaid ? ' is-paid' : ''}">
      <div class="entry-main">
        <div class="entry-name-row">
          <span class="entry-name">${title}</span>
          <span class="badge ${entry.type}">${entry.type}</span>
          <span class="badge category">${escapeHTML(entry.category)}</span>
          <span class="badge ${entry.occurrence}">${entry.occurrence}</span>
          ${paidBadge}
        </div>
        <div class="entry-meta">
          ${escapeHTML(describeEntry(entry))} • ${escapeHTML(entry.notes || 'No notes')}
        </div>
        ${chipRow}
      </div>
      <div class="amount-block">
        <span class="amount-value ${entry.type}">${escapeHTML(formatCents(signedTotal, true))}</span>
        ${detail}
      </div>
      <div class="entry-actions">
        ${singleToggle}
        <button class="edit-btn" data-id="${id}" type="button" aria-label="Edit ${title}">Edit</button>
        <button class="delete-btn" data-id="${id}" type="button" aria-label="Delete ${title}">Delete</button>
      </div>
    </article>`;
}

function renderEntries(items) {
  if (!entries.length) {
    entriesList.innerHTML = `
      <div class="empty-state">
        <p>No entries yet. Add your first one above, or start with some examples.</p>
        <button id="loadSampleBtn" class="ghost-btn" type="button">Load sample data</button>
      </div>`;
    return;
  }

  if (!items.length) {
    entriesList.innerHTML = '<div class="empty-state"><p>No entries for this month.</p></div>';
    return;
  }

  entriesList.innerHTML = items.map(renderEntryItem).join('');
}

function renderUpcoming() {
  const upcoming = getUpcomingPayments();
  const unpaid = upcoming.filter((item) => !item.paid);
  const unpaidCents = unpaid.reduce((sum, { entry }) => sum + toCents(entry.amount), 0);

  upcomingBtn.innerHTML = unpaid.length
    ? `<span class="upcoming-count">${unpaid.length}</span> due · ${escapeHTML(formatCents(unpaidCents))}`
    : 'Nothing due';
  upcomingBtn.classList.toggle('has-due', unpaid.length > 0);

  if (!upcoming.length) {
    upcomingList.innerHTML =
      `<div class="empty-state"><p>No expenses due in the next ${UPCOMING_DAYS} days.</p></div>`;
    return;
  }

  upcomingList.innerHTML = upcoming.map(({ entry, date, paid }) => `
    <div class="upcoming-item${paid ? ' is-paid' : ''}">
      <div class="entry-main">
        <span class="entry-name">${escapeHTML(entry.title)}</span>
        <span class="entry-meta">
          ${describeDue(date)} • ${escapeHTML(formatDate(date))} • ${escapeHTML(entry.category)}
        </span>
      </div>
      <span class="amount-value expense">${escapeHTML(formatCents(-toCents(entry.amount)))}</span>
      ${paidToggle(entry, date, 'paid-btn', (isDone) => (isDone ? '✓ Paid' : 'Mark paid'))}
    </div>`).join('');
}

function updateView() {
  const items = getMonthItems();
  renderSummary(items);
  renderEntries(items);
  renderUpcoming();
  clearAllBtn.disabled = entries.length === 0;
}

/* ---------- Form ---------- */

// Rebuilds the category list for the selected type, keeping the choice if still valid.
function syncCategoryOptions(selected = categorySelect.value) {
  const options = CATEGORIES[typeSelect.value] || CATEGORIES.expense;
  categorySelect.innerHTML = options
    .map((name) => `<option value="${name}">${name}</option>`)
    .join('');
  categorySelect.value = options.includes(selected) ? selected : options[0];
}

function syncOccurrenceFields() {
  const recurring = occurrenceSelect.value === 'recurring';
  frequencySelect.disabled = !recurring;
  frequencyField.classList.toggle('is-disabled', !recurring);
  dateLabelText.textContent = recurring ? 'Start date' : 'Date';
}

function resetForm() {
  form.reset();
  dateInput.value = todayISO();
  editingId = null;
  submitBtn.textContent = 'Add entry';
  cancelEditBtn.classList.add('hidden');
  syncCategoryOptions();
  syncOccurrenceFields();
}

function populateFormForEdit(entry) {
  editingId = entry.id;
  titleInput.value = entry.title;
  amountInput.value = entry.amount;
  typeSelect.value = entry.type;
  syncCategoryOptions(entry.category);
  occurrenceSelect.value = entry.occurrence;
  dateInput.value = entry.date;
  frequencySelect.value = entry.frequency;
  notesInput.value = entry.notes || '';
  syncOccurrenceFields();
  submitBtn.textContent = 'Save changes';
  cancelEditBtn.classList.remove('hidden');
}

/* ---------- Events ---------- */

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const occurrence = occurrenceSelect.value;
  const existing = entries.find((entry) => entry.id === editingId);
  const candidate = normalizeEntry({
    paid: existing ? existing.paid : [],
    id: editingId || makeId(),
    title: titleInput.value,
    amount: amountInput.value,
    type: typeSelect.value,
    category: categorySelect.value,
    occurrence,
    frequency: occurrence === 'recurring' ? frequencySelect.value : 'monthly',
    date: dateInput.value,
    notes: notesInput.value,
  });

  if (!candidate) return;

  if (existing) {
    entries = entries.map((entry) => (entry.id === editingId ? candidate : entry));
  } else {
    entries.push(candidate);
  }

  saveEntries();
  resetForm();
  updateView();
});

typeSelect.addEventListener('change', () => syncCategoryOptions());
occurrenceSelect.addEventListener('change', syncOccurrenceFields);
cancelEditBtn.addEventListener('click', resetForm);
monthFilter.addEventListener('change', updateView);

themeModeSelect.addEventListener('change', (event) => {
  storageSet(THEME_KEY, event.target.value);
  applyTheme();
});
darkQuery.addEventListener('change', applyTheme);

currencySelect.addEventListener('change', (event) => {
  storageSet(CURRENCY_KEY, event.target.value);
  setCurrency(event.target.value);
  updateView();
});

entriesList.addEventListener('click', (event) => {
  if (event.target.closest('#loadSampleBtn')) {
    entries = createSampleEntries();
    saveEntries();
    updateView();
    return;
  }

  const paidButton = event.target.closest('[data-paid-date]');
  if (paidButton) {
    togglePaid(paidButton.dataset.id, paidButton.dataset.paidDate);
    return;
  }

  const editButton = event.target.closest('.edit-btn');
  if (editButton) {
    const entry = entries.find((item) => item.id === editButton.dataset.id);
    if (entry) {
      populateFormForEdit(entry);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      titleInput.focus({ preventScroll: true });
    }
    return;
  }

  const deleteButton = event.target.closest('.delete-btn');
  if (deleteButton) {
    const id = deleteButton.dataset.id;
    const entry = entries.find((item) => item.id === id);
    if (!entry || !confirm(`Delete "${entry.title}"?`)) return;

    entries = entries.filter((item) => item.id !== id);
    saveEntries();
    if (editingId === id) resetForm();
    updateView();
  }
});

clearAllBtn.addEventListener('click', () => {
  if (!entries.length) return;
  const noun = entries.length === 1 ? 'entry' : 'entries';
  if (!confirm(`Delete all ${entries.length} ${noun}? This can't be undone.`)) return;

  entries = [];
  saveEntries();
  resetForm();
  updateView();
});

upcomingBtn.addEventListener('click', () => upcomingDialog.showModal());
closeUpcomingBtn.addEventListener('click', () => upcomingDialog.close());

upcomingDialog.addEventListener('click', (event) => {
  if (event.target === upcomingDialog) {
    upcomingDialog.close(); // clicked the backdrop
    return;
  }
  const paidButton = event.target.closest('[data-paid-date]');
  if (paidButton) togglePaid(paidButton.dataset.id, paidButton.dataset.paidDate);
});

// Keeps "due today" current when the app is reopened on a later day.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateView();
});

/* ---------- Init ---------- */

monthFilter.value = thisMonthISO();
setCurrency(storageGet(CURRENCY_KEY));
applyTheme();
resetForm();
updateView();
