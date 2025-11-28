<template>
  <div class="schedule-table-wrapper">
    <table ref="tableRef" class="schedule-table">
      <thead>
        <tr>
          <th scope="col" rowspan="3" class="col-name"></th>
          <th scope="col" :colspan="days.length" class="month-header">
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
              <button @click.prevent="prevMonth">◀</button>
              <span>{{ monthLabel }}</span>
              <button @click.prevent="nextMonth">▶</button>

            </div>
          </th>
          <th scope="col" rowspan="6">Ore totali</th>
          <th scope="col" rowspan="6">Shifts</th>
          <th scope="col" rowspan="6">Leave</th>
          <th scope="col" rowspan="6">Overtime</th>
          <th scope="col" rowspan="6">TOIL worked</th>
          <th scope="col" rowspan="6">TOIL taken</th>
          <th scope="col" rowspan="6">Sick</th>
          <th scope="col" rowspan="6">Week Days</th>
        </tr>
        <tr>
          <th v-for="day in days" :key="'header-' + day" scope="col">{{ day }}</th>
        </tr>
        <tr>
          <th v-for="(day, idx) in days" :key="'weekday-' + day" scope="col">{{ weekdayLabels[idx] }}</th>
        </tr>
        <tr>
          <th scope="row" class="summary-label">Staff Away</th>
          <th v-for="day in days" :key="'away-' + day" scope="col" class="summary-cell staff-away">{{ staffAway[day - 1]
          }}</th>
        </tr>
        <tr>
          <th scope="row" class="summary-label">Daytime Cover</th>
          <th v-for="day in days" :key="'daycover-' + day" scope="col"
            :class="['summary-cell', (daytimeCover[day - 1] || 0) < 2 ? 'alert' : 'day-cover']">{{ (daytimeCover[day -
              1] || 0) }}</th>
        </tr>
        <tr>
          <th scope="row" class="summary-label">Nighttime Cover</th>
          <th v-for="day in days" :key="'nightcover-' + day" scope="col"
            :class="['summary-cell', (nighttimeCover[day - 1] || 0) < 2 ? 'alert' : 'night-cover']">{{
              (nighttimeCover[day - 1] || 0) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(person, pIdx) in people" :key="person.name">
          <td class="name">{{ person.name }}</td>
          <td v-for="(cell, i) in person.schedule" :key="i"
            :class="[cellClass(cell), isValidCell(cell) ? '' : 'invalid']" contenteditable="true" tabindex="0"
            @input="onCellInput(pIdx, i, $event)" @keydown="onCellKeydown($event, pIdx, i)"
            @blur="onCellBlur(pIdx, i, $event)" @focus="onCellFocus(pIdx, i, $event)"
            @compositionstart="onCompositionStart(pIdx, i, $event)"
            @compositionupdate="onCompositionUpdate(pIdx, i, $event)"
            @compositionend="onCompositionEnd(pIdx, i, $event)">
            {{ cell }}
          </td>
          <td>{{ getCalculated(person).totalHours.toFixed(2).replace('.', ',') }}</td>
          <td>{{ (getCalculated(person).totalHours / 12).toFixed(2).replace('.', ',') }}</td>
          <td>{{ getCalculated(person).leave }}</td>
          <td>{{ getCalculated(person).overtime }}</td>
          <td>{{ getCalculated(person).toilWorked }}</td>
          <td>{{ getCalculated(person).toilTaken }}</td>
          <td>{{ getCalculated(person).sick }}</td>
          <td>{{ getCalculated(person).weekDays }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { API_URL } from '../utils/env';
import { getTurnsUrl } from '../utils/turnsEndpoint';

const currentMonth = ref(new Date(2025, 10, 1)); // Novembre 2025 (month is 0-based)

const days = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => i + 1);
});

const monthLabel = computed(() => {
  return currentMonth.value.toLocaleString(undefined, { month: 'long', year: 'numeric' });
});

const weekdayLabels = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  return days.value.map((day) => {
    const d = new Date(Date.UTC(year, month, day));
    return d.toLocaleString(undefined, { weekday: 'short' });
  });
});

const loading = ref(false);
const error = ref<string | null>(null);

function prevMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() - 1);
  currentMonth.value = d;
}

function nextMonth() {
  const d = new Date(currentMonth.value);
  d.setMonth(d.getMonth() + 1);
  currentMonth.value = d;
}

interface Person {
  name: string;
  schedule: string[];
}

interface Shift {
  idTurno: number;
  data: string;
  nomeUtente: string;
  oreLavorate: string;
  orePermesso: string;
  isNotturno: number;
  tipoPermesso: string | null;
}

const people = ref<Person[]>([]);

const tableRef = ref<HTMLTableElement | null>(null);
const editingCell = ref<{ p: number; i: number } | null>(null);

// Buffer + debounce state for committing edits without rerendering on every keystroke
const DEBOUNCE_MS = 300;
const editBuffer = new Map<string, string>();
const debounceTimers = new Map<string, number>();

function bufferKey(p: number, d: number) {
  return `${p}:${d}`;
}

function commitFromBuffer(key: string, p: number, d: number) {
  // clear timer if present
  const tid = debounceTimers.get(key);
  if (tid) {
    clearTimeout(tid);
    debounceTimers.delete(key);
  }
  const v = editBuffer.get(key);
  if (v === undefined) return;
  const person = people.value[p];
  if (!person) {
    editBuffer.delete(key);
    return;
  }
  // If the corresponding cell is currently focused, avoid updating the
  // reactive model (which would trigger a DOM update and move the caret).
  // Instead, re-schedule the commit for a short time later and leave the
  // buffer intact; the value will be committed on blur as an immediate
  // fallback.
  const el = getCellElement(p, d);
  if (el && document.activeElement === el) {
    // re-schedule commit for later
    const id = window.setTimeout(() => commitFromBuffer(key, p, d), DEBOUNCE_MS);
    debounceTimers.set(key, id as unknown as number);
    return;
  }

  if (d >= 0 && d < person.schedule.length) {
    person.schedule[d] = v;
  }
  editBuffer.delete(key);
}

function scheduleBufferCommit(p: number, d: number, value: string) {
  const key = bufferKey(p, d);
  editBuffer.set(key, value);
  const prev = debounceTimers.get(key);
  if (prev) {
    clearTimeout(prev);
  }
  const id = window.setTimeout(() => commitFromBuffer(key, p, d), DEBOUNCE_MS);
  debounceTimers.set(key, id as unknown as number);
}

function clearBufferFor(p: number, d: number) {
  const key = bufferKey(p, d);
  const tid = debounceTimers.get(key);
  if (tid) {
    clearTimeout(tid);
    debounceTimers.delete(key);
  }
  editBuffer.delete(key);
}

function getCellElement(p: number, i: number): HTMLElement | undefined {
  const rows = tableRef.value?.querySelectorAll('tbody tr') ?? [];
  const row = rows[p] as HTMLElement | undefined;
  if (!row) return undefined;
  // first td is the name, then day cells
  const cell = row.children[1 + i] as HTMLElement | undefined;
  return cell;
}

function focusCell(p: number, i: number) {
  const el = getCellElement(p, i);
  if (el) el.focus();
}



function onCellFocus(pIdx: number, i: number, e: FocusEvent) {
  const el = getCellElement(pIdx, i);
  void e;
  // Normalize the DOM inside the cell to a single text node containing the visible text
  if (el) {
    // preserve visible text but strip leading LRM marks we may have inserted
    const raw = (el.innerText ?? '').replace(/^\u200E+/, '');
    // set textContent to create a single text node
    el.textContent = raw;
    try {
      el.setAttribute('dir', 'ltr');
    } catch {
      // ignore
    }
  }
}

function onCellBlur(pIdx: number, i: number, e: FocusEvent) {
  const target = e.target as HTMLElement;
  // remove any leading LRM we may have inserted when entering edit-mode
  const raw = target.innerText || '';
  const newVal = raw.replace(/^\u200E+/, '').trim();
  const person = people.value[pIdx];
  if (!person) return;
  if (i < 0 || i >= person.schedule.length) return;
  // clear any pending debounce and buffer for this cell, then commit immediately
  clearBufferFor(pIdx, i);
  person.schedule[i] = newVal;
  // clear editing state if it was this cell
  if (editingCell.value && editingCell.value.p === pIdx && editingCell.value.i === i) editingCell.value = null;
}

function onCellKeydown(e: KeyboardEvent, pIdx: number, i: number) {
  // no-op debug logging here to keep handler minimal
  const isDelete = e.key === 'Delete' || e.key === 'Backspace';
  if (isDelete) {
    e.preventDefault();
    const el = getCellElement(pIdx, i);
    if (el) el.innerText = '';
    const person = people.value[pIdx];
    if (person && i >= 0 && i < person.schedule.length) person.schedule[i] = '';
    if (editingCell.value && editingCell.value.p === pIdx && editingCell.value.i === i) editingCell.value = null;
    return;
  }
  const isTab = e.key === 'Tab';
  const isEnter = e.key === 'Enter';
  if (isTab) {
    e.preventDefault();
    const shift = e.shiftKey;
    const scheduleLen = people.value[pIdx]?.schedule.length ?? days.value.length;
    let np = pIdx;
    let ni = i + (shift ? -1 : 1);
    if (ni < 0) {
      // move to previous row last day
      if (pIdx > 0) {
        np = pIdx - 1;
        ni = (people.value[np]?.schedule.length ?? scheduleLen) - 1;
      } else {
        ni = 0;
      }
    } else if (ni >= scheduleLen) {
      // move to next row first day
      if (pIdx < people.value.length - 1) {
        np = pIdx + 1;
        ni = 0;
      } else {
        ni = scheduleLen - 1;
      }
    }
    focusCell(np, ni);
    return;
  }
  if (isEnter) {
    e.preventDefault();
    const el = getCellElement(pIdx, i);
    if (!el) return;
    const currentlyEditing = editingCell.value && editingCell.value.p === pIdx && editingCell.value.i === i;
    if (!currentlyEditing) {
      // enter edit mode: clear content for the user
      editingCell.value = { p: pIdx, i };
      // enter edit mode: focus the cell (do not manipulate caret)
      el.focus();
    } else {
      // if already editing, commit
      el.blur();
    }
  }
}

async function fetchDataForMonth(monthDate: Date) {
  loading.value = true;
  error.value = null;
  try {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 0));
    const url = getTurnsUrl(API_URL, from, to);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Errore nel caricamento turni');
    const apiData = await res.json();
    const turni: Shift[] = apiData.result || [];

    const daysCount = to.getUTCDate();
    const utenti: Record<string, string[]> = {};
    // init users with full-month arrays
    turni.forEach((t) => {
      if (!utenti[t.nomeUtente]) utenti[t.nomeUtente] = Array(daysCount).fill('*');
    });
    // populate
    turni.forEach((t) => {
      const d = new Date(t.data);
      // use UTC date to match API
      const day = d.getUTCDate();
      let code = '';
      if (t.tipoPermesso) code = 'I';
      else if (parseFloat(t.oreLavorate) === 12 && t.isNotturno) code = 'N';
      else if (parseFloat(t.oreLavorate) === 12) code = 'D';
      else if (parseFloat(t.oreLavorate) === 8) code = 'd';
      else if (parseFloat(t.oreLavorate) > 0) code = 'spl4';
      else code = '*';
      const scheduleForUser = utenti[t.nomeUtente];
      if (scheduleForUser && day >= 1 && day <= daysCount) scheduleForUser[day - 1] = code;
    });
    people.value = Object.entries(utenti).map(([name, schedule]) => ({ name, schedule }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Errore fetch turni:', msg);
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchDataForMonth(currentMonth.value));
watch(currentMonth, (nv) => fetchDataForMonth(nv));

// Expose debug helpers on window for quick inspection from DevTools
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__schedDebug = {
    getCellText: (r: number, c: number) => {
      const el = getCellElement(r, c);
      return el ? { innerText: el.innerText, textContent: el.textContent } : null;
    },
    getModel: () => {
      return people.value;
    },
    dumpRow: (r: number) => {
      const rows = tableRef.value?.querySelectorAll('tbody tr') ?? [];
      const row = rows[r] as HTMLElement | undefined;
      if (!row) return null;
      // skip first cell (name) and read day cells
      const values: string[] = [];
      for (let i = 1; i < row.children.length; i++) {
        const td = row.children[i] as HTMLElement;
        values.push(td.innerText ?? '');
      }
      return values;
    }
  };
}

// valid codes
const validCodes = new Set(['N', 'D', 'd', 'I', '*', 'spl4', '8']);

function isValidCell(cell: string) {
  return validCodes.has(cell);
}

const staffAway = computed(() =>
  days.value.map((_: number, idx: number) => people.value.reduce((acc, person) => person.schedule[idx] === 'I' ? acc + 1 : acc, 0))
);
const daytimeCover = computed(() =>
  days.value.map((_: number, idx: number) => people.value.reduce((acc, person) => (person.schedule[idx] === 'D' || person.schedule[idx] === 'd') ? acc + 1 : acc, 0))
);
const nighttimeCover = computed(() =>
  days.value.map((_: number, idx: number) => people.value.reduce((acc, person) => person.schedule[idx] === 'N' ? acc + 1 : acc, 0))
);

function onCellInput(personIdx: number, dayIdx: number, e: Event) {
  // Do not update the reactive model on every keystroke. Instead buffer the
  // latest textual value and commit after a debounce interval.
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const raw = (target.innerText ?? '').replace(/^\u200E+/, '');
  // schedule the buffered commit
  scheduleBufferCommit(personIdx, dayIdx, raw);
}

function onCompositionStart(_pIdx: number, _i: number, _e: CompositionEvent) {
  // composition events intentionally not logged in production
  void _pIdx; void _i; void _e;
}

function onCompositionUpdate(_pIdx: number, _i: number, _e: CompositionEvent) {
  // composition events intentionally not logged in production
  void _pIdx; void _i; void _e;
}

function onCompositionEnd(_pIdx: number, _i: number, _e: CompositionEvent) {
  // composition events intentionally not logged in production
  void _pIdx; void _i; void _e;
}



function cellClass(cell: string) {
  if (cell === "N") return "night";
  if (cell === "D") return "day";
  if (cell === "d") return "day8";
  if (cell === "I") return "away";
  if (cell === "*") return "empty";
  if (cell === "spl4") return "special";
  return "";
}

function getCalculated(person: Person) {
  let totalHours = 0;
  let leave = 0;
  let overtime = 0;
  let toilWorked = 0;
  let toilTaken = 0;
  let sick = 0;
  let weekDays = 0;
  person.schedule.forEach((cell: string) => {
    if (cell === "N" || cell === "D" || cell === "spl4") totalHours += 12;
    else if (cell === "d") totalHours += 8;
    else if (cell === "I") leave++;
  });
  const normalizedShifts = Math.round(totalHours / 12);
  overtime = normalizedShifts > 20 ? normalizedShifts - 20 : 0;
  weekDays = person.schedule.filter((cell: string) => cell === "N" || cell === "D" || cell === "spl4" || cell === "d").length;
  sick = person.schedule.filter((cell: string) => cell === "I").length;
  toilWorked = Math.floor(normalizedShifts / 5);
  toilTaken = Math.floor(leave / 2);
  return { totalHours, shifts: normalizedShifts, leave, overtime, toilWorked, toilTaken, sick, weekDays };
}
</script>

<style scoped>
.schedule-table-wrapper {
  overflow-x: auto;
  margin-top: 2rem;
  padding: 2rem;
}

.summary-label {
  background: #ffe600;
  font-weight: bold;
  text-align: left;
  padding-left: 8px;
  font-size: 0.85rem;
  height: 18px;
  line-height: 18px;
  padding-top: 0;
  padding-bottom: 0;
}

.summary-cell {
  font-weight: bold;
  text-align: center;
  background: #ffffcc;
  font-size: 0.85rem;
  height: 18px;
  line-height: 18px;
  padding-top: 0;
  padding-bottom: 0;
}

.staff-away {
  background: #fffbe6;
  color: #333;
}

.day-cover {
  background: #e6ffe6;
}

.night-cover {
  background: #f0e6ff;
}

.alert {
  background: #ff4d4d !important;
  color: #fff !important;
  border: 2px solid #b30000;
}

.col-name {
  background-color: #ffe600;
  font-size: 0.95rem;
  padding: 6px 8px;
  vertical-align: middle;
  border: none;
}


.schedule-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 1400px;
  font-size: 1.05rem;
  background: #ffffcc;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.10);
}


.schedule-table th,
.schedule-table td {
  border: 1.5px solid #888;
  padding: 7px 12px;
  text-align: center;
  min-width: 32px;
}

/* Force left-to-right typing inside editable day cells and isolate bidi */
.schedule-table td[contenteditable] {
  direction: ltr;
  unicode-bidi: isolate-override;
  /* stronger isolation and override of bidi for editable cells */
}


.month-header {
  background: linear-gradient(90deg, #ffe600 60%, #fffbe6 100%);
  color: #333;
  font-size: 1.15rem;
  letter-spacing: 1px;
  font-weight: bold;
}


.name {
  background: #cce6ff;
  font-weight: bold;
  font-size: 1.05rem;
  letter-spacing: 0.5px;
}


.night {
  background: #e6b3ff;
}


.day {
  background: #ffff99;
}


.away {
  background: #b3ffd9;
}


.empty {
  background: #fff;
}
</style>
