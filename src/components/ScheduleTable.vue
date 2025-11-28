<template>
  <div class="schedule-table-wrapper">
    <table class="schedule-table">
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
            :class="[cellClass(cell), isValidCell(cell) ? '' : 'invalid']" contenteditable="true"
            @input="onCellInput(pIdx, i, $event)" @keydown="onCellKeydown($event)">
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
  const target = e.target as HTMLElement;
  const newVal = target.innerText.trim();
  const person = people.value[personIdx];
  if (!person) return;
  if (dayIdx < 0 || dayIdx >= person.schedule.length) return;
  person.schedule[dayIdx] = newVal;
}

function onCellKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const target = e.target as HTMLElement;
    target.blur();
  }
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
