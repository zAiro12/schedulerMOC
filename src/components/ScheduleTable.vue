<template>
  <div class="schedule-table-wrapper">
    <table class="schedule-table">
      <thead>
        <tr>
          <th scope="col" rowspan="2" class="col-name"></th>
          <th scope="col" colspan="31" class="month-header">Maggio 2025</th>
          <th scope="col" rowspan="5">Ore totali</th>
          <th scope="col" rowspan="5">Shifts</th>
          <th scope="col" rowspan="5">Leave</th>
          <th scope="col" rowspan="5">Overtime</th>
          <th scope="col" rowspan="5">TOIL worked</th>
          <th scope="col" rowspan="5">TOIL taken</th>
          <th scope="col" rowspan="5">Sick</th>
          <th scope="col" rowspan="5">Week Days</th>
        </tr>
        <tr>
          <th v-for="day in days" :key="'header-' + day" scope="col">{{ day }}</th>
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
import { reactive, computed } from 'vue';

const days = Array.from({ length: 31 }, (_, i) => i + 1);

interface Person {
  name: string;
  schedule: string[];
}

const people = reactive<Person[]>([
  {
    name: "Giorgia",
    schedule: ["*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d", "spl4", "*", "spl4", "d"],
  },
  {
    name: "Luca",
    schedule: ["D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N", "N", "D", "d", "N"]
  },
  {
    name: "Martina",
    schedule: ["I", "I", "D", "d", "*", "*", "N", "N", "D", "d", "*", "*", "N", "N", "D", "d", "*", "*", "N", "N", "D", "d", "*", "*", "N", "N", "D", "d", "*", "*", "N"]
  },
  {
    name: "Alessio",
    schedule: ["spl4", "spl4", "*", "*", "D", "d", "N", "N", "*", "*", "D", "d", "N", "N", "*", "*", "D", "d", "N", "N", "*", "*", "D", "d", "N", "N", "*", "*", "D", "d", "N"]
  },
  {
    name: "Sara",
    schedule: ["*", "D", "d", "N", "N", "I", "I", "D", "D", "N", "N", "I", "I", "D", "d", "N", "N", "I", "I", "D", "d", "N", "N", "I", "I", "D", "d", "N", "N", "I", "I"]
  },
  {
    name: "Francesco",
    schedule: ["N", "N", "D", "d", "I", "I", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D"]
  },
  {
    name: "Giulia",
    schedule: ["D", "d", "D", "N", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4"]
  },
  {
    name: "Davide",
    schedule: ["I", "I", "N", "N", "D", "d", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D", "d", "N", "N", "I", "I", "*", "*", "spl4", "spl4", "D"]
  },
  {
    name: "Elena",
    schedule: ["D", "N", "I", "*", "spl4", "D", "d", "I", "*", "spl4", "D", "N", "I", "*", "spl4", "D", "d", "I", "*", "spl4", "D", "N", "I", "*", "spl4", "D", "d", "I", "*", "spl4", "D"]
  },
  {
    name: "Simone",
    schedule: ["N", "D", "I", "*", "spl4", "N", "d", "I", "*", "spl4", "N", "D", "I", "*", "spl4", "N", "d", "I", "*", "spl4", "N", "D", "I", "*", "spl4", "N", "d", "I", "*", "spl4", "N"]
  }
]);

// valid codes
const validCodes = new Set(['N', 'D', 'd', 'I', '*', 'spl4', '8']);

function isValidCell(cell: string) {
  return validCodes.has(cell);
}

// Calcolo riepilogo per ogni giorno (reactive)
const staffAway = computed(() =>
  days.map((_, idx) => people.reduce((acc, person) => person.schedule[idx] === 'I' ? acc + 1 : acc, 0))
);
const daytimeCover = computed(() =>
  days.map((_, idx) => people.reduce((acc, person) => (person.schedule[idx] === 'D' || person.schedule[idx] === 'd') ? acc + 1 : acc, 0))
);
const nighttimeCover = computed(() =>
  days.map((_, idx) => people.reduce((acc, person) => person.schedule[idx] === 'N' ? acc + 1 : acc, 0))
);

function onCellInput(personIdx: number, dayIdx: number, e: Event) {
  const target = e.target as HTMLElement;
  const newVal = target.innerText.trim();
  // bounds check before updating reactive array
  const person = people[personIdx];
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

interface Person {
  name: string;
  schedule: string[];
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
    // aggiungi altre logiche se servono
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
