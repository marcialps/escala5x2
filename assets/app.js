(() => {
  'use strict';

  /* =========================================================
     Constantes
     ========================================================= */
  const STORAGE_KEY = 'escala5x2.v1';
  const LEGAL = Object.freeze({
    source: 'Emenda Constitucional nº 141/2026',
    effectiveDate: '16/12/2026',
    weeklyMinutes: 42 * 60,
    standardDailyMinutes: 8 * 60,
    maxDailyMinutes: 10 * 60,
    minInterShiftMinutes: 11 * 60,
    mealBreakMinutes: 60
  });

  const DAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const MONTHS_LOWER = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const COLORS = ['#2f6b55', '#b96c43', '#4b6c83', '#7a5368', '#94743a', '#397173', '#955b5b', '#58645a'];

  const SEED_EMPLOYEES = [
    { name: 'Mariana Alves', role: 'Barbeira', preferredOff: '1', preferredShifts: ['morning'] },
    { name: 'Lucas Ferreira', role: 'Barbeiro', preferredOff: '2', preferredShifts: ['afternoon'] },
    { name: 'Camila Souza', role: 'Cabeleireira', preferredOff: '3', preferredShifts: ['morning', 'afternoon'] },
    { name: 'Rafael Lima', role: 'Barbeiro', preferredOff: '4', preferredShifts: ['afternoon'] },
    { name: 'Beatriz Nunes', role: 'Manicure', preferredOff: '5', preferredShifts: ['morning'] },
    { name: 'Diego Martins', role: 'Barbeiro', preferredOff: '6', preferredShifts: ['morning', 'afternoon'] },
    { name: 'Juliana Prado', role: 'Recepção', preferredOff: '', preferredShifts: ['afternoon'] },
    { name: 'Thiago Rocha', role: 'Barbeiro', preferredOff: '', preferredShifts: [] }
  ];

  const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  let state;
  let ui;
  let activeModal = null;
  let storageWarningShown = false;

  /* =========================================================
     Utilitários
     ========================================================= */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISO(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
  function fromISO(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  function todayISO() { return toISO(new Date()); }
  function addDaysISO(iso, amount) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + amount);
    return toISO(d);
  }
  function startOfWeekISO(iso) {
    const d = fromISO(iso);
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    return toISO(d);
  }
  function getWeekDates(weekStart) { return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)); }
  function dayOfWeekISO(iso) { return fromISO(iso).getDay(); }
  function monthKey(iso) { return String(iso).slice(0, 7); }
  function currentMonthKey() { return monthKey(todayISO()); }
  function addMonths(month, amount) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + amount, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }
  function monthLabel(month) {
    const [y, m] = month.split('-').map(Number);
    return `${MONTHS[m - 1]} de ${y}`;
  }
  function weeksForMonth(month) {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    let cursor = startOfWeekISO(toISO(first));
    const end = startOfWeekISO(toISO(last));
    const weeks = [];
    while (cursor <= end && weeks.length < 6) {
      weeks.push(cursor);
      cursor = addDaysISO(cursor, 7);
    }
    return weeks;
  }
  function formatShortDate(iso) {
    const d = fromISO(iso);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }
  function formatDateBR(iso) {
    const d = fromISO(iso);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function formatDateLong(iso) {
    const d = fromISO(iso);
    return `${d.getDate()} de ${MONTHS_LOWER[d.getMonth()]}`;
  }
  function formatWeekRange(weekStart) {
    const end = addDaysISO(weekStart, 6);
    const a = fromISO(weekStart);
    const b = fromISO(end);
    if (a.getMonth() === b.getMonth()) {
      return `${a.getDate()} – ${b.getDate()} de ${MONTHS_LOWER[a.getMonth()]} de ${a.getFullYear()}`;
    }
    if (a.getFullYear() === b.getFullYear()) {
      return `${a.getDate()} ${MONTHS_LOWER[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS_LOWER[b.getMonth()].slice(0, 3)} de ${b.getFullYear()}`;
    }
    return `${a.getDate()} ${MONTHS_LOWER[a.getMonth()].slice(0, 3)} ${a.getFullYear()} – ${b.getDate()} ${MONTHS_LOWER[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
  }
  function formatTimeRange(start, end) { return `${start} – ${end}`; }
  function timeToMinutes(value) {
    if (!/^\d{1,2}:\d{2}$/.test(String(value || ''))) return NaN;
    const [h, m] = String(value).split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
    return h * 60 + m;
  }
  function minutesToTime(total) {
    const safe = Math.max(0, Math.min(1439, Math.round(total)));
    return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
  }
  function isValidTime(value) { return Number.isFinite(timeToMinutes(value)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function icon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }
  function uid(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < String(value).length; i++) {
      hash ^= String(value).charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }
  function formatDuration(totalMinutes) {
    const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h${pad2(m)}`;
  }
  function formatSignedDuration(totalMinutes) {
    const mins = Math.round(Number(totalMinutes) || 0);
    if (mins === 0) return '0h';
    return `${mins > 0 ? '+' : '−'}${formatDuration(Math.abs(mins))}`;
  }
  function formatDecimalHours(totalMinutes) {
    return ((Number(totalMinutes) || 0) / 60).toFixed(2).replace('.', ',');
  }
  function formatBreak(minutes) {
    const mins = Number(minutes) || 0;
    if (!mins) return '';
    if (mins === 60) return '1h almoço';
    if (mins % 60 === 0) return `${mins / 60}h intervalo`;
    return `${mins}min`;
  }
  function formatBreakShort(minutes) {
    const mins = Number(minutes) || 0;
    if (!mins) return '';
    if (mins === 60) return '1h';
    if (mins % 60 === 0) return `${mins / 60}h`;
    if (mins > 60) return `${Math.floor(mins / 60)}h${pad2(mins % 60)}`;
    return `${mins}min`;
  }
  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }
  function safeColor(value, fallback = COLORS[0]) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
  }
  function prefersSaturdayOff(employee) {
    return String(employee?.preferredOff) === '6';
  }

  const SHIFT_LABELS = { morning: 'Manhã', afternoon: 'Tarde', saturday: 'Sábado', full: 'Dia todo' };
  const SHIFT_IDS = ['morning', 'afternoon', 'saturday', 'full'];

  function shiftSpanMinutes(start, end) {
    const a = timeToMinutes(start);
    const b = timeToMinutes(end);
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0;
  }

  function defaultShiftBreak(start, end) {
    const span = shiftSpanMinutes(start, end);
    if (span > 360) return 60;
    if (span > 240) return 15;
    return 0;
  }

  function makeShift(id, label, start, end, minStaff) {
    return { id, label, start, end, minStaff, breakMinutes: defaultShiftBreak(start, end) };
  }

  function dayShifts(dow) {
    const conf = state?.settings?.weekdays?.[String(dow)];
    if (!conf || conf.open === false) return [];
    const shifts = (Array.isArray(conf.shifts) ? conf.shifts : [])
      .filter((shift) => shift && isValidTime(shift.start) && isValidTime(shift.end) && timeToMinutes(shift.end) > timeToMinutes(shift.start));
    if (shifts.length) return shifts;
    if (!isValidTime(conf.start) || !isValidTime(conf.end) || timeToMinutes(conf.end) <= timeToMinutes(conf.start)) return [];
    const id = dow === 6 ? 'saturday' : 'full';
    return [makeShift(id, SHIFT_LABELS[id], conf.start, conf.end, Number(conf.minStaff) || 0)];
  }

  function findShift(dow, shiftId) {
    const shifts = dayShifts(dow);
    return shifts.find((shift) => shift.id === shiftId) || shifts[0] || null;
  }

  function inferShiftId(dow, entry) {
    if (!entry || entry.status !== 'work') return '';
    const shifts = dayShifts(dow);
    if (!shifts.length) return '';
    if (entry.shift && shifts.some((shift) => shift.id === entry.shift)) return entry.shift;
    const start = timeToMinutes(entry.start);
    if (!Number.isFinite(start)) return shifts[0].id;
    let best = shifts[0];
    let bestDiff = Infinity;
    for (const shift of shifts) {
      const diff = Math.abs(start - timeToMinutes(shift.start));
      if (diff < bestDiff) { best = shift; bestDiff = diff; }
    }
    return best.id;
  }

  function shiftNameForEntry(dow, entry) {
    const segments = entrySegments(entry);
    if (segments.length > 1) {
      return segments.map((seg, index) => segmentShiftName(dow, seg, index)).join(' + ');
    }
    const shift = findShift(dow, segments[0]?.id ? segments[0].id : inferShiftId(dow, entry));
    return shift?.label || (dow === 6 ? SHIFT_LABELS.saturday : 'Trabalho');
  }

  /* =========================================================
     Dados iniciais e persistência
     ========================================================= */
  function makeWorkShift(id, label, start, end, minStaff) {
    return { ...makeShift(id, label, start, end, minStaff), breakMinutes: 0 };
  }

  function weekdayPair(morningStart, morningEnd, morningMin, afternoonStart, afternoonEnd, afternoonMin) {
    const shifts = [
      makeWorkShift('morning', SHIFT_LABELS.morning, morningStart, morningEnd, morningMin),
      makeWorkShift('afternoon', SHIFT_LABELS.afternoon, afternoonStart, afternoonEnd, afternoonMin)
    ];
    return {
      open: true,
      start: morningStart,
      end: afternoonEnd,
      minStaff: morningMin + afternoonMin,
      shifts
    };
  }

  function defaultWeekdays() {
    return {
      0: { open: false, start: '09:00', end: '13:00', minStaff: 0, shifts: [] },
      1: weekdayPair('07:30', '12:00', 3, '13:30', '18:00', 3),
      2: weekdayPair('07:30', '12:00', 3, '13:30', '18:00', 3),
      3: weekdayPair('07:30', '12:00', 3, '13:30', '18:00', 3),
      4: weekdayPair('07:30', '12:00', 3, '13:30', '18:00', 3),
      5: weekdayPair('07:30', '12:00', 3, '13:30', '18:00', 3),
      6: { open: true, start: '08:00', end: '12:00', minStaff: 4, shifts: [makeShift('saturday', SHIFT_LABELS.saturday, '08:00', '12:00', 4)] }
    };
  }

  function shiftDefaultsFromConfig(shifts) {
    const defaults = {
      morning: { start: '07:30', end: '12:00', breakMinutes: 0 },
      afternoon: { start: '13:30', end: '18:00', breakMinutes: 0 }
    };
    for (const shift of Array.isArray(shifts) ? shifts : []) {
      if (!defaults[shift?.id] || !isValidTime(shift.start) || !isValidTime(shift.end)) continue;
      if (timeToMinutes(shift.end) <= timeToMinutes(shift.start)) continue;
      defaults[shift.id] = {
        start: shift.start,
        end: shift.end,
        breakMinutes: clamp(Math.round(Number(shift.breakMinutes) || 0), 0, 240)
      };
    }
    return defaults;
  }

  function employeeShiftDefaults() {
    return shiftDefaultsFromConfig(state?.settings?.weekdays?.['1']?.shifts);
  }

  function cloneShiftDefaults(defaults) {
    return {
      morning: { ...defaults.morning },
      afternoon: { ...defaults.afternoon }
    };
  }

  function createDefaultState() {
    const now = new Date().toISOString();
    const shiftDefaults = shiftDefaultsFromConfig(defaultWeekdays()['1'].shifts);
    const employees = SEED_EMPLOYEES.map((seed, index) => ({
      id: `emp_${index + 1}`,
      name: seed.name,
      role: seed.role,
      weeklyHours: LEGAL.weeklyMinutes / 60,
      preferredOff: seed.preferredOff,
      preferredShifts: Array.isArray(seed.preferredShifts) ? seed.preferredShifts.slice() : [],
      defaultShifts: cloneShiftDefaults(shiftDefaults),
      defaultStart: shiftDefaults.morning.start,
      defaultEnd: shiftDefaults.morning.end,
      breakMinutes: shiftDefaults.morning.breakMinutes,
      active: true,
      color: COLORS[index % COLORS.length],
      order: index,
      createdAt: now
    }));
    return {
      version: 1,
      company: { name: 'Kinhos Barber', unit: 'Unidade principal' },
      settings: {
        weekdays: defaultWeekdays(),
        auto: { honorPreferences: true }
      },
      employees,
      weeks: {},
      meta: { initialized: false, createdAt: now, updatedAt: now }
    };
  }

  function normalizeState(source) {
    const raw = source && typeof source === 'object' ? source : {};
    const data = raw.data && typeof raw.data === 'object' ? raw.data : raw;
    const base = createDefaultState();
    const weekdays = defaultWeekdays();
    const sourceWeekdays = data.settings && data.settings.weekdays && typeof data.settings.weekdays === 'object' ? data.settings.weekdays : {};
    const isLegacyPair = (shifts) => {
      const list = Array.isArray(shifts) ? shifts : [];
      const morning = list.find((shift) => shift?.id === 'morning');
      const afternoon = list.find((shift) => shift?.id === 'afternoon');
      return morning?.start === '09:00' && morning?.end === '13:00' && afternoon?.start === '14:00' && afternoon?.end === '19:00';
    };
    const migrateHours = data.meta?.hours2026Migrated !== true
      && [1, 2, 3, 4, 5].some((day) => isLegacyPair(sourceWeekdays[String(day)]?.shifts));
    const migrateWeeklyHours = data.meta?.weeklyHours2026Migrated !== true;
    for (let day = 0; day <= 6; day++) {
      const item = sourceWeekdays[String(day)];
      if (!item || typeof item !== 'object') continue;
      const fallback = weekdays[String(day)];
      const sourceShifts = migrateHours && day >= 1 && day <= 5 ? fallback.shifts : (Array.isArray(item.shifts) ? item.shifts : []);
      const normalizedShifts = sourceShifts
        .filter((shift) => shift && typeof shift === 'object' && isValidTime(shift.start) && isValidTime(shift.end) && timeToMinutes(shift.end) > timeToMinutes(shift.start))
        .map((shift, index) => {
          const id = SHIFT_IDS.includes(String(shift.id))
            ? String(shift.id)
            : (day === 6 ? 'saturday' : index === 0 ? 'morning' : 'afternoon');
          return {
            id,
            label: String(shift.label || SHIFT_LABELS[id] || 'Turno').slice(0, 20),
            start: shift.start,
            end: shift.end,
            minStaff: clamp(Math.round(Number(shift.minStaff) || 0), 0, 99),
            breakMinutes: clamp(Math.round(Number(shift.breakMinutes) || 0), 0, 240)
          };
        });

      if (!normalizedShifts.length && day !== 0 && item.open !== false) {
        if (day === 6) {
          normalizedShifts.push(makeShift(
            'saturday', SHIFT_LABELS.saturday,
            isValidTime(item.start) ? item.start : fallback.start,
            isValidTime(item.end) ? item.end : fallback.end,
            clamp(Number(item.minStaff) || 0, 0, 99)
          ));
        } else {
          const legacyStart = isValidTime(item.start) ? item.start : fallback.start;
          const legacyEnd = isValidTime(item.end) ? item.end : fallback.end;
          const legacyMin = clamp(Number(item.minStaff) || 0, 0, 99);
          const morningEnd = timeToMinutes(legacyStart) < 12 * 60 ? '12:00' : legacyStart;
          const afternoonStart = timeToMinutes(legacyEnd) > 13.5 * 60 ? '13:30' : legacyEnd;
          normalizedShifts.push(makeWorkShift('morning', SHIFT_LABELS.morning, legacyStart, morningEnd, Math.ceil(legacyMin / 2)));
          normalizedShifts.push(makeWorkShift('afternoon', SHIFT_LABELS.afternoon, afternoonStart, legacyEnd, Math.floor(legacyMin / 2)));
        }
      }

      const normalized = {
        open: day === 0 ? false : Boolean(item.open),
        start: isValidTime(item.start) ? item.start : fallback.start,
        end: isValidTime(item.end) ? item.end : fallback.end,
        minStaff: clamp(Number(item.minStaff) || 0, 0, 99),
        shifts: day === 0 ? [] : normalizedShifts
      };
      if (normalized.shifts.length) {
        normalized.start = normalized.shifts.reduce((min, shift) => (timeToMinutes(shift.start) < timeToMinutes(min) ? shift.start : min), normalized.shifts[0].start);
        normalized.end = normalized.shifts.reduce((max, shift) => (timeToMinutes(shift.end) > timeToMinutes(max) ? shift.end : max), normalized.shifts[0].end);
        normalized.minStaff = normalized.shifts.reduce((sum, shift) => sum + shift.minStaff, 0);
      }
      weekdays[String(day)] = normalized;
    }

    const employees = (Array.isArray(data.employees) ? data.employees : [])
      .filter((emp) => emp && typeof emp === 'object')
      .slice(0, 100)
      .map((emp, index) => {
        let id = String(emp.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id) id = `emp_${index + 1}`;
        const rawWeeklyHours = Number(emp.weeklyHours);
        const weeklyHours = clamp(
          Math.round((migrateWeeklyHours && rawWeeklyHours === 24 ? LEGAL.weeklyMinutes / 60 : (rawWeeklyHours || LEGAL.weeklyMinutes / 60)) * 2) / 2,
          1, LEGAL.weeklyMinutes / 60
        );
        const legacyShift = ['morning', 'afternoon'].includes(String(emp.preferredShift)) ? String(emp.preferredShift) : '';
        const preferredShifts = Array.isArray(emp.preferredShifts)
          ? emp.preferredShifts.map(String).filter((value) => ['morning', 'afternoon'].includes(value))
          : (legacyShift ? [legacyShift] : []);
        const baseDefaults = shiftDefaultsFromConfig(weekdays['1']?.shifts);
        const rawDefaults = emp.defaultShifts && typeof emp.defaultShifts === 'object' ? emp.defaultShifts : {};
        const defaultShifts = {};
        for (const shiftId of ['morning', 'afternoon']) {
          const raw = rawDefaults[shiftId];
          const base = baseDefaults[shiftId];
          const legacyDefault = shiftId === 'morning'
            ? raw?.start === '09:00' && raw?.end === '13:00'
            : raw?.start === '14:00' && raw?.end === '19:00';
          const effectiveRaw = migrateHours && legacyDefault ? null : raw;
          const candidate = {
            start: isValidTime(effectiveRaw?.start) ? effectiveRaw.start : base.start,
            end: isValidTime(effectiveRaw?.end) ? effectiveRaw.end : base.end,
            breakMinutes: clamp(Math.round(Number(effectiveRaw?.breakMinutes ?? base.breakMinutes) || 0), 0, 240)
          };
          defaultShifts[shiftId] = timeToMinutes(candidate.end) > timeToMinutes(candidate.start) ? candidate : { ...base };
        }
        if (!rawDefaults.morning && !rawDefaults.afternoon && isValidTime(emp.defaultStart) && isValidTime(emp.defaultEnd)) {
          const legacyStart = emp.defaultStart;
          const legacyEnd = emp.defaultEnd;
          if (timeToMinutes(legacyEnd) > timeToMinutes(legacyStart)) {
            const target = preferredShifts.includes('morning') ? 'morning'
              : preferredShifts.includes('afternoon') ? 'afternoon'
              : (timeToMinutes(legacyStart) >= 13 * 60 ? 'afternoon' : 'morning');
            defaultShifts[target] = {
              start: legacyStart,
              end: legacyEnd,
              breakMinutes: clamp(Math.round(Number(emp.breakMinutes) || 0), 0, 240)
            };
          }
        }
        return {
          id,
          name: String(emp.name || `Colaborador ${index + 1}`).slice(0, 80),
          role: String(emp.role || '').slice(0, 60),
          weeklyHours,
          preferredOff: ['1', '2', '3', '4', '5', '6'].includes(String(emp.preferredOff)) ? String(emp.preferredOff) : '',
          preferredShifts,
          defaultShifts,
          defaultStart: defaultShifts.morning.start,
          defaultEnd: defaultShifts.morning.end,
          breakMinutes: defaultShifts.morning.breakMinutes,
          active: emp.active !== false,
          color: safeColor(emp.color, COLORS[index % COLORS.length]),
          order: Number.isFinite(Number(emp.order)) ? Number(emp.order) : index,
          createdAt: emp.createdAt || new Date().toISOString()
        };
      });

    const weeks = {};
    const sourceWeeks = data.weeks && typeof data.weeks === 'object' ? data.weeks : {};
    for (const [weekStart, week] of Object.entries(sourceWeeks)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !week || typeof week !== 'object') continue;
      const days = {};
      for (const [date, entries] of Object.entries(week.days || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entries || typeof entries !== 'object') continue;
        const dayEntries = {};
        for (const [empId, entry] of Object.entries(entries)) {
          if (!entry || !['work', 'off'].includes(entry.status)) continue;
          if (entry.status === 'work') {
            const segments = Array.isArray(entry.segments) ? entry.segments : [];
            if (segments.length) {
              const cleanSegments = segments
                .filter((seg) => seg && isValidTime(seg.start) && isValidTime(seg.end) && timeToMinutes(seg.end) > timeToMinutes(seg.start))
                .slice(0, 4)
                .map((seg) => ({
                  ...(SHIFT_IDS.includes(String(seg.id)) ? { id: String(seg.id) } : {}),
                  start: seg.start,
                  end: seg.end,
                  breakMinutes: clamp(Math.round(Number(seg.breakMinutes) || 0), 0, 240)
                }));
              if (!cleanSegments.length) continue;
              dayEntries[empId] = {
                status: 'work',
                segments: cleanSegments,
                shift: cleanSegments.length > 1 ? 'full' : (cleanSegments[0].id || ''),
                manual: Boolean(entry.manual)
              };
              continue;
            }
            if (!isValidTime(entry.start) || !isValidTime(entry.end)) continue;
            const shiftId = SHIFT_IDS.includes(String(entry.shift)) ? String(entry.shift) : '';
            dayEntries[empId] = {
              status: 'work',
              start: entry.start,
              end: entry.end,
              breakMinutes: clamp(Number(entry.breakMinutes) || 0, 0, 240),
              ...(shiftId ? { shift: shiftId } : {}),
              manual: Boolean(entry.manual)
            };
          } else {
            dayEntries[empId] = { status: 'off', manual: Boolean(entry.manual) };
          }
        }
        days[date] = dayEntries;
      }
      weeks[weekStart] = {
        weekStart,
        days,
        generatedAt: week.generatedAt || null,
        updatedAt: week.updatedAt || null
      };
    }

    // Regra fixa: quem tem sábado como folga preferida nunca entra na grade de sábado.
    // A limpeza também corrige backups antigos e dados já salvos no navegador.
    const saturdayOffIds = new Set(employees.filter(prefersSaturdayOff).map((emp) => emp.id));
    for (const week of Object.values(weeks)) {
      for (const [date, entries] of Object.entries(week.days || {})) {
        if (dayOfWeekISO(date) !== 6) continue;
        for (const empId of saturdayOffIds) {
          const entry = entries[empId];
          if (entry?.status === 'work') entries[empId] = { status: 'off', manual: Boolean(entry.manual) };
        }
      }
    }

    return {
      version: 1,
      company: {
        name: String(data.company?.name || base.company.name).slice(0, 80),
        unit: String(data.company?.unit || base.company.unit).slice(0, 80)
      },
      settings: {
        weekdays,
        auto: { honorPreferences: data.settings?.auto?.honorPreferences !== false }
      },
      employees,
      weeks,
      meta: {
        ...base.meta,
        ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
        initialized: true,
        hours2026Migrated: true,
        weeklyHours2026Migrated: true
      }
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return createDefaultState();
    }
  }

  function saveState() {
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (!storageWarningShown) {
        storageWarningShown = true;
        window.setTimeout(() => showToast('Não foi possível salvar neste navegador. Exporte um backup.', 'error'), 400);
      }
    }
  }

  /* =========================================================
     Acesso aos dados
     ========================================================= */
  function activeEmployees() {
    return state.employees.filter((emp) => emp.active).sort((a, b) => a.order - b.order);
  }
  function allEmployeesSorted() {
    return state.employees.slice().sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.order - b.order;
    });
  }
  function findEmployee(id) { return state.employees.find((emp) => emp.id === id) || null; }
  function ensureWeekObject(weekStart) {
    if (!state.weeks[weekStart]) {
      state.weeks[weekStart] = { weekStart, days: {}, generatedAt: null, updatedAt: null };
    }
    return state.weeks[weekStart];
  }
  function getEntry(weekStart, date, empId) {
    return state.weeks[weekStart]?.days?.[date]?.[empId] || null;
  }
  function getEntryByDate(date, empId) {
    return getEntry(startOfWeekISO(date), date, empId);
  }
  function setEntry(date, empId, entry) {
    const weekStart = startOfWeekISO(date);
    const week = ensureWeekObject(weekStart);
    if (!week.days[date]) week.days[date] = {};
    week.days[date][empId] = { ...entry, manual: true };
    week.updatedAt = new Date().toISOString();
    saveState();
  }
  function clearSaturdayAssignments(empId, { clearManual = true } = {}) {
    let changed = 0;
    for (const [weekStart, week] of Object.entries(state.weeks)) {
      for (const date of getWeekDates(weekStart)) {
        if (dayOfWeekISO(date) !== 6) continue;
        const entry = week?.days?.[date]?.[empId];
        if (entry?.status === 'work') {
          week.days[date][empId] = {
            status: 'off',
            manual: clearManual ? false : Boolean(entry.manual)
          };
          changed++;
        }
      }
    }
    return changed;
  }
  function hasAutomaticWeekdayOff(weekStart, empId) {
    const days = state.weeks[weekStart]?.days || {};
    return getWeekDates(weekStart).some((date) => {
      const dow = dayOfWeekISO(date);
      const entry = days[date]?.[empId];
      return dow >= 1 && dow <= 5 && entry?.status === 'off' && !entry.manual;
    });
  }
  function enforceSaturdayPreferences() {
    let changed = 0;
    const affectedWeeks = new Set();
    for (const emp of activeEmployees()) {
      if (!prefersSaturdayOff(emp)) continue;
      changed += clearSaturdayAssignments(emp.id);
      // Sábado + domingo já são as duas folgas. Não pode sobrar a folga
      // compensatória de dia útil que era dada a quem trabalhava no sábado.
      for (const weekStart of Object.keys(state.weeks)) {
        if (hasAutomaticWeekdayOff(weekStart, emp.id)) affectedWeeks.add(weekStart);
      }
    }
    for (const weekStart of affectedWeeks) {
      generateWeek(weekStart, { preserve: true, persist: false });
    }
    return changed + affectedWeeks.size;
  }
  function entrySegments(entry) {
    if (!entry || entry.status !== 'work') return [];
    const source = Array.isArray(entry.segments) && entry.segments.length
      ? entry.segments
      : [{ ...entry, id: entry.shift || '' }];
    return source
      .filter((seg) => seg && isValidTime(seg.start) && isValidTime(seg.end) && timeToMinutes(seg.end) > timeToMinutes(seg.start))
      .map((seg) => ({
        id: SHIFT_IDS.includes(String(seg.id)) ? String(seg.id) : '',
        start: seg.start,
        end: seg.end,
        breakMinutes: clamp(Math.round(Number(seg.breakMinutes) || 0), 0, 240)
      }));
  }
  function segmentSpanMinutes(seg) {
    const start = timeToMinutes(seg?.start);
    const end = timeToMinutes(seg?.end);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0;
  }
  function segmentNetMinutes(seg) {
    return Math.max(0, segmentSpanMinutes(seg) - (Number(seg?.breakMinutes) || 0));
  }
  function segmentShiftId(dow, seg, index = 0) {
    if (seg?.id && dayShifts(dow).some((shift) => shift.id === seg.id)) return seg.id;
    return inferShiftId(dow, { status: 'work', start: seg?.start });
  }
  function segmentShiftName(dow, seg, index = 0) {
    const shift = findShift(dow, segmentShiftId(dow, seg, index));
    return shift?.label || (dow === 6 ? SHIFT_LABELS.saturday : SHIFT_LABELS[index === 0 ? 'morning' : 'afternoon']);
  }
  function entryNetMinutes(entry) {
    return entrySegments(entry).reduce((sum, seg) => sum + segmentNetMinutes(seg), 0);
  }
  function entrySpanMinutes(entry) {
    return entrySegments(entry).reduce((sum, seg) => sum + segmentSpanMinutes(seg), 0);
  }
  function entryFirstStart(entry) {
    return entrySegments(entry)[0]?.start || '';
  }
  function entryLastEnd(entry) {
    const segments = entrySegments(entry);
    return segments[segments.length - 1]?.end || '';
  }
  function getEmployeeWeekStats(empId, weekStart) {
    const dates = getWeekDates(weekStart);
    let minutes = 0;
    let workDays = 0;
    let offDays = 0;
    let saturdayWorked = false;
    const entries = dates.map((date) => {
      const entry = getEntry(weekStart, date, empId);
      if (entry && entry.status === 'work') {
        minutes += entryNetMinutes(entry);
        workDays++;
        if (dayOfWeekISO(date) === 6) saturdayWorked = true;
      } else {
        offDays++;
      }
      return { date, entry: entry || { status: 'off' } };
    });
    return { minutes, workDays, offDays, saturdayWorked, entries, dates };
  }

  /* =========================================================
     Geração automática 5x2
     ========================================================= */
  function countShiftAssignments() {
    const counts = new Map();
    for (const emp of activeEmployees()) counts.set(emp.id, { morning: 0, afternoon: 0, saturday: 0, full: 0 });
    for (const week of Object.values(state.weeks)) {
      for (const [date, entries] of Object.entries(week.days || {})) {
        const dow = dayOfWeekISO(date);
        for (const [empId, entry] of Object.entries(entries)) {
          if (entry?.status !== 'work') continue;
          const bucket = counts.get(empId);
          if (!bucket) continue;
          const segments = entrySegments(entry);
          if (segments.length) {
            segments.forEach((seg, index) => {
              const id = segmentShiftId(dow, seg, index);
              if (bucket[id] !== undefined) bucket[id]++;
            });
          } else {
            const shiftId = inferShiftId(dow, entry);
            if (bucket[shiftId] !== undefined) bucket[shiftId]++;
          }
        }
      }
    }
    return counts;
  }

  function shiftPriority(employee, shift, date, counts) {
    let score = (counts?.get(employee.id)?.[shift.id] || 0) * 12;
    if (state.settings.auto?.honorPreferences !== false) {
      const preferred = Array.isArray(employee.preferredShifts) ? employee.preferredShifts : [];
      if (preferred.includes(shift.id)) score -= 60;
      else if (preferred.length) score += 24;
    }
    return score + (hashString(`${employee.id}|${shift.id}|${date}`) % 16);
  }

  function buildAutoShift(employee, dow, shift = null) {
    const chosen = shift || findShift(dow, null);
    if (!chosen) return { status: 'off', manual: false };
    const windowStart = timeToMinutes(chosen.start);
    const windowEnd = timeToMinutes(chosen.end);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return { status: 'off', manual: false };
    const windowSpan = windowEnd - windowStart;
    const personal = employee?.defaultShifts?.[chosen.id]
      || (chosen.id === 'saturday' ? employee?.defaultShifts?.morning : null);
    let start = windowStart;
    let span = windowSpan;
    let breakMinutes = Number.isFinite(Number(chosen.breakMinutes))
      ? clamp(Number(chosen.breakMinutes), 0, 240)
      : defaultShiftBreak(chosen.start, chosen.end);

    if (personal && isValidTime(personal.start) && isValidTime(personal.end)) {
      const personalStart = timeToMinutes(personal.start);
      const personalSpan = timeToMinutes(personal.end) - personalStart;
      if (personalSpan > 0) {
        span = Math.min(personalSpan, windowSpan);
        start = clamp(personalStart, windowStart, Math.max(windowStart, windowEnd - span));
        const personalBreak = Number(personal.breakMinutes);
        if (Number.isFinite(personalBreak)) breakMinutes = clamp(personalBreak, 0, 240);
      }
    }
    if (breakMinutes >= span) breakMinutes = 0;
    return {
      status: 'work',
      start: minutesToTime(start),
      end: minutesToTime(start + span),
      breakMinutes,
      shift: chosen.id,
      manual: false
    };
  }

  function buildAutoDay(employee, dow, shifts, date) {
    const segments = shifts
      .map((shift) => buildAutoShift(employee, dow, shift))
      .filter((entry) => entry.status === 'work')
      .map((entry) => ({
        id: entry.shift,
        start: entry.start,
        end: entry.end,
        breakMinutes: entry.breakMinutes
      }));
    if (!segments.length) return { status: 'off', manual: false };
    const entry = {
      status: 'work',
      segments,
      shift: segments.length > 1 ? 'full' : segments[0].id,
      manual: false
    };
    return balanceDailyEntry(entry, employee.id, date);
  }

  function countSaturdaysWorked(empId, excludeWeek) {
    let count = 0;
    for (const [weekStart, week] of Object.entries(state.weeks)) {
      if (weekStart === excludeWeek) continue;
      const saturday = addDaysISO(weekStart, 5);
      if (week?.days?.[saturday]?.[empId]?.status === 'work') count++;
    }
    return count;
  }

  function saturdayScore(employee, count, weekStart) {
    let preferenceBias = 0;
    if (state.settings.auto?.honorPreferences !== false
      && ['1', '2', '3', '4', '5'].includes(employee.preferredOff)) preferenceBias = -18;
    return count * 100 + preferenceBias + (hashString(`${employee.id}|${weekStart}`) % 7);
  }

  function dailyCapMinutes() {
    return Math.floor(LEGAL.weeklyMinutes / 5);
  }

  function applyEntrySegments(entry, segments) {
    const clean = segments.filter((seg) => seg && isValidTime(seg.start) && isValidTime(seg.end) && timeToMinutes(seg.end) > timeToMinutes(seg.start));
    if (!clean.length) {
      entry.status = 'off';
      delete entry.segments;
      return;
    }
    entry.status = 'work';
    entry.segments = clean.map((seg) => ({
      ...(seg.id ? { id: seg.id } : {}),
      start: seg.start,
      end: seg.end,
      breakMinutes: clamp(Math.round(Number(seg.breakMinutes) || 0), 0, 240)
    }));
    entry.shift = clean.length > 1 ? 'full' : (clean[0].id || entry.shift || '');
  }

  function trimEntryNet(entry, cut) {
    let remaining = Math.max(0, Math.round(cut));
    const minNet = 60;
    const segments = entrySegments(entry);
    if (!segments.length || remaining <= 0) return;
    for (const seg of segments.slice().reverse()) {
      if (remaining <= 0) break;
      const room = Math.max(0, segmentNetMinutes(seg) - minNet);
      if (!room) continue;
      const amount = Math.min(room, remaining);
      seg.end = minutesToTime(timeToMinutes(seg.end) - amount);
      remaining -= amount;
    }
    for (const seg of segments) {
      if (remaining <= 0) break;
      const room = Math.max(0, segmentNetMinutes(seg) - minNet);
      if (!room) continue;
      const amount = Math.min(room, remaining);
      seg.start = minutesToTime(timeToMinutes(seg.start) + amount);
      remaining -= amount;
    }
    applyEntrySegments(entry, segments);
  }

  function setEntryNetMinutes(entry, targetNet) {
    trimEntryNet(entry, entryNetMinutes(entry) - Math.round(targetNet));
  }

  function balanceDailyEntry(entry, employeeId, date) {
    const segments = entrySegments(entry);
    if (segments.length < 2) return entry;
    const target = dailyCapMinutes();
    let excess = segments.reduce((sum, seg) => sum + segmentNetMinutes(seg), 0) - target;
    if (excess <= 0) return entry;
    const minNet = 60;
    const trimAtEnd = hashString(`${employeeId}|${date}|trim`) % 2 === 0;

    const cutFromEnd = (seg) => {
      const room = Math.max(0, segmentNetMinutes(seg) - minNet);
      const amount = Math.min(room, excess);
      if (amount > 0) seg.end = minutesToTime(timeToMinutes(seg.end) - amount);
      excess -= amount;
    };
    const cutFromStart = (seg) => {
      const room = Math.max(0, segmentNetMinutes(seg) - minNet);
      const amount = Math.min(room, excess);
      if (amount > 0) seg.start = minutesToTime(timeToMinutes(seg.start) + amount);
      excess -= amount;
    };

    if (trimAtEnd) {
      cutFromEnd(segments[segments.length - 1]);
      if (excess > 0) cutFromStart(segments[0]);
    } else {
      cutFromStart(segments[0]);
      if (excess > 0) cutFromEnd(segments[segments.length - 1]);
    }
    if (excess > 0) {
      for (const seg of segments) cutFromEnd(seg);
    }
    applyEntrySegments(entry, segments);
    return entry;
  }

  function capGeneratedWeek(days, dates, employees) {
    const minDailyNet = 60;
    for (const emp of employees) {
      const weekEntries = dates
        .map((date) => ({ date, entry: days[date]?.[emp.id] }))
        .filter(({ entry }) => entry?.status === 'work');
      if (!weekEntries.length) continue;
      const total = weekEntries.reduce((sum, { entry }) => sum + entryNetMinutes(entry), 0);
      if (total <= LEGAL.weeklyMinutes) continue;

      // Edições manuais são preservadas: o ajuste incide só sobre dias automáticos.
      const adjustable = weekEntries.filter(({ entry }) => !entry.manual && entryNetMinutes(entry) > minDailyNet);
      if (!adjustable.length) continue;
      const room = ({ entry }) => Math.max(0, entryNetMinutes(entry) - minDailyNet);
      const totalRoom = adjustable.reduce((sum, item) => sum + room(item), 0);
      let excess = Math.min(total - LEGAL.weeklyMinutes, totalRoom);

      for (const item of adjustable) {
        const cut = Math.min(room(item), Math.round(excess * room(item) / totalRoom));
        if (cut > 0) setEntryNetMinutes(item.entry, entryNetMinutes(item.entry) - cut);
      }

      let current = weekEntries.reduce((sum, { entry }) => sum + entryNetMinutes(entry), 0);
      let guard = 0;
      while (current > LEGAL.weeklyMinutes && guard++ < 50) {
        adjustable.sort((a, b) => entryNetMinutes(b.entry) - entryNetMinutes(a.entry));
        let changed = false;
        for (const item of adjustable) {
          if (!room(item)) continue;
          const cut = Math.min(room(item), current - LEGAL.weeklyMinutes);
          setEntryNetMinutes(item.entry, entryNetMinutes(item.entry) - cut);
          current -= cut;
          changed = true;
          if (current <= LEGAL.weeklyMinutes) break;
        }
        if (!changed) break;
      }
    }
  }

  function generateWeek(weekStart, options = {}) {
    const preserve = options.preserve !== false;
    const employees = activeEmployees();
    const dates = getWeekDates(weekStart);
    const settings = state.settings.weekdays;
    const existing = state.weeks[weekStart];
    const manualEntries = new Map();

    if (preserve && existing?.days) {
      for (const date of dates) {
        for (const emp of employees) {
          const entry = existing.days[date]?.[emp.id];
          if (entry?.manual) manualEntries.set(`${date}::${emp.id}`, { ...entry, manual: true });
        }
      }
    }

    const shiftCounts = countShiftAssignments();
    const saturdayConfig = settings['6'];
    const saturdayMin = saturdayConfig?.open ? Math.max(0, Number(saturdayConfig.minStaff) || 0) : 0;
    // Tolerância de uma pessoa: com mínimo 4, a grade nunca fica com menos de 3.
    const saturdayFloor = Math.max(0, saturdayMin - 1);
    const saturdayDate = addDaysISO(weekStart, 5);
    // Quem marcou sábado como folga preferida fica fora do sorteado em qualquer semana.
    const saturdayEligible = employees.filter((emp) => !prefersSaturdayOff(emp));
    const manualSaturdayOff = new Set();
    const manualSaturdayWork = new Set();
    for (const emp of saturdayEligible) {
      const manual = manualEntries.get(`${saturdayDate}::${emp.id}`);
      if (manual?.status === 'off') manualSaturdayOff.add(emp.id);
      else if (manual?.status === 'work') manualSaturdayWork.add(emp.id);
    }
    const saturdayCounts = new Map(saturdayEligible.map((emp) => [emp.id, countSaturdaysWorked(emp.id, weekStart)]));
    const orderedForSaturday = saturdayEligible.slice().sort((a, b) => {
      const manualDiff = (manualSaturdayWork.has(b.id) ? 1 : 0) - (manualSaturdayWork.has(a.id) ? 1 : 0);
      if (manualDiff !== 0) return manualDiff;
      const diff = saturdayScore(a, saturdayCounts.get(a.id) || 0, weekStart) - saturdayScore(b, saturdayCounts.get(b.id) || 0, weekStart);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    const chosenForSaturday = orderedForSaturday
      .filter((emp) => !manualSaturdayOff.has(emp.id))
      .slice(0, saturdayMin);
    // Folgas manuais no sábado são preservadas, mas não podem derrubar a cobertura
    // abaixo do piso (mínimo - 1). Se faltar gente, uma delas é desconsiderada.
    const overriddenSaturdayOff = new Set();
    for (const emp of orderedForSaturday) {
      if (chosenForSaturday.length >= saturdayFloor) break;
      if (chosenForSaturday.some((item) => item.id === emp.id)) continue;
      chosenForSaturday.push(emp);
      if (manualSaturdayOff.has(emp.id)) overriddenSaturdayOff.add(emp.id);
    }
    const saturdayWorkers = new Set(chosenForSaturday.map((emp) => emp.id));
    const targetSaturday = saturdayWorkers.size;
    const weekdayOffs = new Map();

    if (targetSaturday > 0) {
      const activeCount = employees.length;
      const offCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const saturdayEmployees = employees
        .filter((emp) => saturdayWorkers.has(emp.id))
        .sort((a, b) => {
          const prefA = ['1', '2', '3', '4', '5'].includes(a.preferredOff) ? 0 : 1;
          const prefB = ['1', '2', '3', '4', '5'].includes(b.preferredOff) ? 0 : 1;
          return prefA - prefB;
        });

      for (const emp of saturdayEmployees) {
        const preferred = Number(emp.preferredOff);
        const hasCapacity = (day) => {
          const conf = settings[String(day)];
          if (!conf?.open) return false;
          const capacity = Math.max(1, activeCount - (Number(conf.minStaff) || 0));
          return offCounts[day] < capacity;
        };
        let chosen = null;
        if (preferred >= 1 && preferred <= 5 && hasCapacity(preferred)) chosen = preferred;
        if (chosen === null) {
          const pool = [1, 2, 3, 4, 5].filter(hasCapacity);
          if (pool.length) chosen = pool.sort((a, b) => offCounts[a] - offCounts[b] || a - b)[0];
        }
        if (chosen === null) {
          const openDays = [1, 2, 3, 4, 5].filter((d) => settings[String(d)]?.open);
          const pool = openDays.length ? openDays : [1, 2, 3, 4, 5];
          chosen = pool.sort((a, b) => offCounts[a] - offCounts[b] || a - b)[0];
        }
        offCounts[chosen] = (offCounts[chosen] || 0) + 1;
        weekdayOffs.set(emp.id, chosen);
      }
    }

    const days = {};
    for (const date of dates) {
      const dow = dayOfWeekISO(date);
      const conf = settings[String(dow)];
      const closed = !conf?.open || dow === 0;
      const shiftDefs = closed ? [] : dayShifts(dow);
      const working = new Set();

      if (!closed) {
        const pool = employees.filter((emp) => {
          if (dow === 6) return saturdayWorkers.has(emp.id);
          return !(saturdayWorkers.has(emp.id) && weekdayOffs.get(emp.id) === dow);
        });
        if (dow === 6 && shiftDefs[0]) {
          // Sábado usa a equipe já selecionada (mínimo ou, no pior caso, mínimo - 1).
          const need = Math.min(pool.length, saturdayMin);
          pool.slice()
            .sort((a, b) => shiftPriority(a, shiftDefs[0], date, shiftCounts) - shiftPriority(b, shiftDefs[0], date, shiftCounts) || a.name.localeCompare(b.name, 'pt-BR'))
            .slice(0, need)
            .forEach((emp) => working.add(emp.id));
        } else {
          // De segunda a sexta cada pessoa disponível cobre manhã e tarde no mesmo dia.
          pool.forEach((emp) => working.add(emp.id));
        }
      }

      days[date] = {};
      for (const emp of employees) {
        const manual = manualEntries.get(`${date}::${emp.id}`);
        if (manual) {
          if (dow === 6 && prefersSaturdayOff(emp)) {
            days[date][emp.id] = { status: 'off', manual: true };
          } else if (dow === 6 && overriddenSaturdayOff.has(emp.id)) {
            days[date][emp.id] = shiftDefs.length > 1
              ? buildAutoDay(emp, dow, shiftDefs, date)
              : buildAutoShift(emp, dow, shiftDefs[0]);
          } else {
            days[date][emp.id] = manual;
          }
          continue;
        }
        if (closed || !working.has(emp.id)) {
          days[date][emp.id] = { status: 'off', manual: false };
          continue;
        }
        days[date][emp.id] = shiftDefs.length > 1
          ? buildAutoDay(emp, dow, shiftDefs, date)
          : buildAutoShift(emp, dow, shiftDefs[0]);
      }
    }

    capGeneratedWeek(days, dates, employees);

    state.weeks[weekStart] = {
      weekStart,
      days,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (options.persist !== false) saveState();
    return state.weeks[weekStart];
  }

  function ensureWeekScheduled(weekStart, options = {}) {
    if (!state.weeks[weekStart] && activeEmployees().length) {
      generateWeek(weekStart, { preserve: options.preserve !== false, persist: options.persist !== false });
      return true;
    }
    return false;
  }

  function ensureMonthScheduled(month, options = {}) {
    // Reaplica a regra antes de gerar: cobre dados em memória vindos de versões antigas.
    let changed = enforceSaturdayPreferences() > 0;
    for (const weekStart of weeksForMonth(month)) {
      if (options.force || !state.weeks[weekStart]) {
        generateWeek(weekStart, { preserve: options.preserve !== false, persist: false });
        changed = true;
      }
    }
    if (changed && options.persist !== false) saveState();
    return changed;
  }

  /* =========================================================
     Análise da escala e conformidade
     ========================================================= */
  function analyzeWeek(weekStart) {
    const dates = getWeekDates(weekStart);
    const employees = activeEmployees();
    const issues = [];
    const employeeStats = new Map();
    const dayCounts = dates.map((date) => {
      const dow = dayOfWeekISO(date);
      const conf = state.settings.weekdays[String(dow)];
      const shifts = dayShifts(dow).map((shift) => ({ ...shift, count: 0, minutes: 0 }));
      let count = 0;
      let minutes = 0;
      for (const emp of employees) {
        const entry = getEntry(weekStart, date, emp.id);
        if (entry?.status === 'work') {
          const net = entryNetMinutes(entry);
          count++;
          minutes += net;
          entrySegments(entry).forEach((seg, index) => {
            const shift = shifts.find((item) => item.id === segmentShiftId(dow, seg, index));
            if (shift) {
              shift.count++;
              shift.minutes += segmentNetMinutes(seg);
            }
          });
        }
      }
      return { date, dow, open: Boolean(conf?.open), minStaff: Number(conf?.minStaff) || 0, count, minutes, shifts };
    });

    let totalMinutes = 0;
    for (const emp of employees) {
      const stats = getEmployeeWeekStats(emp.id, weekStart);
      totalMinutes += stats.minutes;
      employeeStats.set(emp.id, stats);

      if (stats.minutes > LEGAL.weeklyMinutes) {
        issues.push({
          severity: 'error', check: 'limit', employeeId: emp.id,
          title: 'Jornada semanal acima de 42h',
          detail: `${emp.name} está com ${formatDuration(stats.minutes)} na semana, ${formatDuration(stats.minutes - LEGAL.weeklyMinutes)} acima do limite legal.`
        });
      }
      if (stats.offDays < 2) {
        issues.push({
          severity: 'error', check: 'folgas', employeeId: emp.id,
          title: 'Menos de 2 folgas na semana',
          detail: `${emp.name} tem ${pluralize(stats.offDays, 'folga', 'folgas')}. A escala 5x2 exige 2 dias de descanso por semana.`
        });
      } else if (stats.workDays > 5) {
        issues.push({
          severity: 'warn', check: 'folgas', employeeId: emp.id,
          title: 'Mais de 5 dias trabalhados',
          detail: `${emp.name} está escalado em ${stats.workDays} dias nesta semana.`
        });
      }
      if (stats.workDays === 0) {
        issues.push({
          severity: 'warn', check: 'folgas', employeeId: emp.id,
          title: 'Sem jornada nesta semana',
          detail: `${emp.name} não tem nenhum dia de trabalho escalado.`
        });
      }

      for (const item of stats.entries) {
        const entry = item.entry;
        if (entry.status !== 'work') continue;
        const dow = dayOfWeekISO(item.date);
        if (dow === 6 && prefersSaturdayOff(emp)) {
          issues.push({
            severity: 'error', check: 'folgas', employeeId: emp.id, date: item.date,
            title: 'Sábado marcado como folga preferida',
            detail: `${emp.name} tem sábado como folga preferida e não pode ser escalado em ${formatDateBR(item.date)}.`
          });
        }
        const conf = state.settings.weekdays[String(dow)];
        const segments = entrySegments(entry);
        const dailyNet = entryNetMinutes(entry);

        if (!segments.length) {
          issues.push({
            severity: 'error', check: 'rest', employeeId: emp.id, date: item.date,
            title: 'Horário inválido',
            detail: `${emp.name}: a saída precisa ser posterior à entrada.`
          });
          continue;
        }
        if (dailyNet > dailyCapMinutes()) {
          issues.push({
            severity: 'warn', check: 'limit', employeeId: emp.id, date: item.date,
            title: `Jornada diária acima de ${formatDuration(dailyCapMinutes())}`,
            detail: `${emp.name} tem ${formatDuration(dailyNet)} em ${formatDateBR(item.date)}. O teto diário é 42h ÷ 5 dias.`
          });
        }
        if (dailyNet > LEGAL.maxDailyMinutes) {
          issues.push({
            severity: 'error', check: 'limit', employeeId: emp.id, date: item.date,
            title: 'Acima de 10h no dia',
            detail: `${emp.name} tem ${formatDuration(dailyNet)} líquidas em ${formatDateBR(item.date)}.`
          });
        }

        const totalBreak = segments.reduce((sum, seg) => sum + seg.breakMinutes, 0);
        const gapBetweenShifts = segments.slice(1).reduce((sum, seg, index) => {
          const previousEnd = timeToMinutes(segments[index].end);
          const currentStart = timeToMinutes(seg.start);
          return sum + (Number.isFinite(previousEnd) && Number.isFinite(currentStart) ? Math.max(0, currentStart - previousEnd) : 0);
        }, 0);
        const totalRest = totalBreak + gapBetweenShifts;
        if (entrySpanMinutes(entry) > 360 && totalRest < 60) {
          issues.push({
            severity: 'warn', check: 'rest', employeeId: emp.id, date: item.date,
            title: 'Intervalo abaixo de 1h',
            detail: `${emp.name}: ${formatBreak(totalRest) || 'sem intervalo'} em uma jornada de ${formatDuration(entrySpanMinutes(entry))}. O mínimo é 1h, salvo acordo coletivo.`
          });
        }

        segments.forEach((seg, index) => {
          const start = timeToMinutes(seg.start);
          const end = timeToMinutes(seg.end);
          const brk = seg.breakMinutes;
          const span = segmentSpanMinutes(seg);
          const shift = findShift(dow, segmentShiftId(dow, seg, index));

          if (brk >= span) {
            issues.push({
              severity: 'error', check: 'rest', employeeId: emp.id, date: item.date,
              title: 'Intervalo incompatível',
              detail: `${emp.name}: o intervalo do turno ${shift?.label || ''} é maior ou igual à jornada.`
            });
          }
          if (segments.length === 1) {
            if (span > 360 && brk < 60) {
              issues.push({
                severity: 'warn', check: 'rest', employeeId: emp.id, date: item.date,
                title: 'Intervalo abaixo de 1h',
                detail: `${emp.name}: ${formatBreak(brk) || 'sem intervalo'} em ${formatDuration(span)} de presença. O mínimo é 1h, salvo acordo coletivo.`
              });
            } else if (span > 240 && span <= 360 && brk < 15) {
              issues.push({
                severity: 'warn', check: 'rest', employeeId: emp.id, date: item.date,
                title: 'Intervalo insuficiente',
                detail: `${emp.name}: jornada de ${formatDuration(span)} com menos de 15min de intervalo.`
              });
            }
          }
          if (!conf?.open) {
            issues.push({
              severity: 'warn', check: 'coverage', employeeId: emp.id, date: item.date,
              title: 'Trabalho em dia fechado',
              detail: `${DAY_FULL[dow]} está marcado como fechado nas regras.`
            });
          } else {
            const opStart = shift ? timeToMinutes(shift.start) : timeToMinutes(conf.start);
            const opEnd = shift ? timeToMinutes(shift.end) : timeToMinutes(conf.end);
            if (Number.isFinite(opStart) && Number.isFinite(opEnd) && (start < opStart || end > opEnd)) {
              issues.push({
                severity: 'warn', check: 'coverage', employeeId: emp.id, date: item.date,
                title: 'Fora do horário do turno',
                detail: `${emp.name} · ${shift?.label || 'funcionamento'}: ${formatTimeRange(seg.start, seg.end)} em ${formatDateBR(item.date)}, fora de ${formatTimeRange(shift?.start || conf.start, shift?.end || conf.end)}.`
              });
            }
          }
        });

        const previousDate = addDaysISO(item.date, -1);
        const previous = getEntryByDate(previousDate, emp.id);
        const previousEnd = timeToMinutes(entryLastEnd(previous));
        const currentStart = timeToMinutes(entryFirstStart(entry));
        if (Number.isFinite(previousEnd) && Number.isFinite(currentStart)) {
          const rest = 1440 - previousEnd + currentStart;
          if (rest < LEGAL.minInterShiftMinutes) {
            issues.push({
              severity: 'error', check: 'rest', employeeId: emp.id, date: item.date,
              title: 'Descanso entre turnos abaixo de 11h',
              detail: `${emp.name} tem ${formatDuration(rest)} entre ${formatDateBR(previousDate)} e ${formatDateBR(item.date)}.`
            });
          }
        }
      }
    }

    for (const day of dayCounts) {
      if (!day.open) {
        if (day.count > 0) {
          issues.push({
            severity: 'warn', check: 'coverage', date: day.date,
            title: 'Dia fechado com equipe escalada',
            detail: `${DAY_FULL[day.dow]}, ${formatDateBR(day.date)}: ${pluralize(day.count, 'pessoa escalada', 'pessoas escaladas')}.`
          });
        }
      } else if (day.shifts.length) {
        for (const shift of day.shifts) {
          const target = Number(shift.minStaff) || 0;
          // No sábado é aceita uma pessoa abaixo do mínimo configurado.
          const accepted = day.dow === 6 ? Math.max(0, target - 1) : target;
          if (shift.count >= accepted) continue;
          issues.push({
            severity: 'warn', check: 'coverage', date: day.date,
            title: `Cobertura ${shift.label.toLowerCase()} abaixo do mínimo aceito`,
            detail: `${DAY_FULL[day.dow]}, ${formatDateBR(day.date)} · ${shift.label}: ${shift.count} de ${target} ${pluralize(target, 'pessoa', 'pessoas')}.`
              + (day.dow === 6 ? ` Neste dia o mínimo aceito é ${accepted}.` : '')
          });
        }
      } else if (day.count < day.minStaff) {
        issues.push({
          severity: 'warn', check: 'coverage', date: day.date,
          title: 'Cobertura abaixo do mínimo',
          detail: `${DAY_FULL[day.dow]}, ${formatDateBR(day.date)}: ${day.count} de ${day.minStaff} pessoas necessárias.`
        });
      }
    }

    const errors = issues.filter((item) => item.severity === 'error').length;
    const warnings = issues.filter((item) => item.severity === 'warn').length;
    const score = Math.max(0, Math.round(100 - errors * 14 - warnings * 4));
    const saturday = dayCounts[5];
    const satTarget = saturday?.open ? Math.max(0, saturday.minStaff - 1) : 0;
    const checks = buildChecks(issues);
    const status = errors ? 'danger' : warnings ? 'warn' : 'ok';

    return {
      weekStart, dates, employees, issues, employeeStats, dayCounts,
      totalMinutes, avgMinutes: employees.length ? totalMinutes / employees.length : 0,
      errors, warnings, score, checks, status,
      saturdayScheduled: saturday?.count || 0,
      saturdayTarget: satTarget
    };
  }

  function buildChecks(issues) {
    const definitions = [
      { id: 'limit', label: 'Limite 42h / 8h24', ok: 'Nenhuma jornada acima dos tetos' },
      { id: 'folgas', label: 'Folgas 5x2', ok: 'Todos com 5 dias e 2 folgas' },
      { id: 'rest', label: 'Intervalos e descanso', ok: 'Intervalos e 11h em dia' },
      { id: 'coverage', label: 'Cobertura da operação', ok: 'Manhã, tarde e sábado cobertos' }
    ];
    return definitions.map((def) => {
      const relevant = issues.filter((item) => item.check === def.id);
      const errors = relevant.filter((item) => item.severity === 'error').length;
      const warnings = relevant.filter((item) => item.severity === 'warn').length;
      const status = errors ? 'danger' : warnings ? 'warn' : 'ok';
      let detail = def.ok;
      if (relevant.length) {
        if (def.id === 'limit') detail = `${pluralize(relevant.length, 'ponto', 'pontos')} de atenção`;
        else if (def.id === 'folgas') detail = `${pluralize(new Set(relevant.map((item) => item.employeeId)).size, 'pessoa', 'pessoas')} fora do 5x2`;
        else if (def.id === 'rest') detail = `${pluralize(relevant.length, 'ajuste', 'ajustes')} de intervalo/descanso`;
        else detail = `${pluralize(new Set(relevant.map((item) => item.date).filter(Boolean)).size, 'dia', 'dias')} com pendência`;
      }
      return { ...def, status, detail, issues: relevant };
    });
  }

  function analyzeMonth(month) {
    const issues = [];
    for (const weekStart of weeksForMonth(month)) {
      const week = analyzeWeek(weekStart);
      for (const issue of week.issues) {
        if (issue.date && !issue.date.startsWith(month)) continue;
        issues.push({ ...issue, weekStart });
      }
    }
    const errors = issues.filter((item) => item.severity === 'error').length;
    const warnings = issues.filter((item) => item.severity === 'warn').length;
    return { issues, errors, warnings, status: errors ? 'danger' : warnings ? 'warn' : 'ok' };
  }

  function getEmployeeMonthStats(emp, month, weeks, monthAnalysis) {
    let total = 0;
    let offDays = 0;
    let saturdays = 0;
    const weekMinutes = weeks.map((weekStart) => {
      let minutes = 0;
      for (const date of getWeekDates(weekStart)) {
        if (!date.startsWith(month)) continue;
        const entry = getEntry(weekStart, date, emp.id);
        if (entry?.status === 'work') {
          minutes += entryNetMinutes(entry);
          if (dayOfWeekISO(date) === 6) saturdays++;
        } else {
          offDays++;
        }
      }
      total += minutes;
      return minutes;
    });
    const reference = emp.weeklyHours * 60 * 52 / 12;
    const employeeIssues = monthAnalysis.issues.filter((item) => item.employeeId === emp.id);
    const errors = employeeIssues.filter((item) => item.severity === 'error').length;
    const warnings = employeeIssues.filter((item) => item.severity === 'warn').length;
    return {
      total, offDays, saturdays, weekMinutes, reference,
      balance: total - reference,
      status: errors ? 'danger' : warnings ? 'warn' : 'ok',
      errors, warnings
    };
  }

  /* =========================================================
     Renderização: shell e escala
     ========================================================= */
  function renderShell() {
    const brand = document.getElementById('brand-company');
    if (brand) brand.textContent = state.company.name || 'Minha equipe';
    document.querySelectorAll('[data-nav-view]').forEach((button) => {
      const active = button.dataset.navView === ui.view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach((view) => {
      view.hidden = view.id !== `view-${ui.view}`;
    });
    document.title = `${state.company.name || 'Escala 5x2'} · Escala 5x2`;
  }

  function statCard({ iconName, label, value, sub, tone = '' }) {
    return `
      <article class="stat-card ${tone}">
        <div class="stat-top">
          <span class="stat-icon">${icon(iconName)}</span>
          <span class="stat-label">${escapeHTML(label)}</span>
        </div>
        <div class="stat-value">${value}</div>
        <p class="stat-sub">${sub}</p>
      </article>`;
  }

  function renderSchedule() {
    const weekStart = ui.weekStart;
    ensureWeekScheduled(weekStart);
    const dates = getWeekDates(weekStart);
    const analysis = analyzeWeek(weekStart);
    const employees = activeEmployees();
    const today = todayISO();

    document.getElementById('week-range').textContent = formatWeekRange(weekStart);
    document.getElementById('schedule-subtitle').textContent = employees.length
      ? `${pluralize(employees.length, 'colaborador', 'colaboradores')} · ${formatDuration(analysis.totalMinutes)} escaladas na semana`
      : 'Nenhum colaborador ativo';

    document.getElementById('week-stats').innerHTML = [
      statCard({
        iconName: 'clock', label: 'Horas da semana', value: formatDuration(analysis.totalMinutes),
        sub: employees.length ? `média de ${formatDuration(analysis.avgMinutes)} por pessoa` : 'cadastre sua equipe', tone: 'is-copper'
      }),
      statCard({
        iconName: 'users', label: 'Média por pessoa', value: formatDuration(analysis.avgMinutes),
        sub: employees.length ? 'horas líquidas escaladas' : 'sem dados', tone: ''
      }),
      statCard({
        iconName: 'calendar', label: 'Sábado coberto', value: `${analysis.saturdayScheduled}<small class="tight">/${analysis.saturdayTarget}</small>`,
        sub: analysis.saturdayTarget ? `mínimo aceito de ${analysis.saturdayTarget} pessoas (configurado: ${analysis.dayCounts[5].minStaff})` : 'sábado fechado', tone: analysis.saturdayScheduled < analysis.saturdayTarget ? 'is-warn' : 'is-good'
      }),
      statCard({
        iconName: analysis.errors ? 'alert' : analysis.warnings ? 'info' : 'check',
        label: 'Conformidade', value: analysis.errors ? 'Revisar' : analysis.warnings ? 'Atenção' : 'Conforme',
        sub: `${analysis.errors} erros · ${analysis.warnings} avisos`,
        tone: analysis.errors ? 'is-danger' : analysis.warnings ? 'is-warn' : 'is-good'
      })
    ].join('');

    const issueKeys = new Set(analysis.issues.filter((item) => item.employeeId && item.date).map((item) => `${item.employeeId}::${item.date}`));
    const issueTone = new Map();
    analysis.issues.filter((item) => item.employeeId && item.date).forEach((item) => {
      const key = `${item.employeeId}::${item.date}`;
      if (item.severity === 'error' || !issueTone.has(key)) issueTone.set(key, item.severity);
    });

    const headerCells = dates.map((date) => {
      const dow = dayOfWeekISO(date);
      const conf = state.settings.weekdays[String(dow)];
      const day = analysis.dayCounts.find((item) => item.date === date);
      const isToday = date === today;
      const coverageLabel = conf?.open ? `${day.count}/${day.minStaff}` : '—';
      const low = conf?.open && day.shifts?.some((shift) => shift.count < (Number(shift.minStaff) || 0));
      const shiftDetail = day?.shifts?.length
        ? day.shifts.map((shift) => `${shift.label}: ${shift.count}/${shift.minStaff}`).join(' · ')
        : (conf?.open ? `Equipe: ${day.count}/${day.minStaff}` : 'Fechado');
      return `
        <th scope="col" class="day-head ${dow === 6 ? 'is-saturday' : ''} ${dow === 0 ? 'is-sunday' : ''}" title="${escapeHTML(`${DAY_FULL[dow]} · ${shiftDetail}`)}">
          <div class="day-head-inner">
            <span class="day-head-name">${DAY_SHORT[dow]}</span>
            <span class="day-head-date ${isToday ? 'is-today' : ''}">${fromISO(date).getDate()}</span>
            <span class="day-head-coverage ${low ? 'is-low' : ''}">${coverageLabel}</span>
          </div>
        </th>`;
    }).join('');

    let rows = '';
    if (employees.length) {
      rows = employees.map((emp) => {
        const stats = getEmployeeWeekStats(emp.id, weekStart);
        const cells = dates.map((date) => {
          const dow = dayOfWeekISO(date);
          const entry = getEntry(weekStart, date, emp.id);
          const key = `${emp.id}::${date}`;
          const tone = issueTone.get(key);
          const warningDot = issueKeys.has(key) ? `<span class="shift-warning ${tone === 'error' ? 'is-danger' : ''}" title="Ver pendência"></span>` : '';
          const cellClass = `shift-cell ${date === today ? 'is-today' : ''}`;
          if (!entry || entry.status !== 'work') {
            return `
              <td>
                <button type="button" class="${cellClass} is-off" style="--emp:${emp.color}" data-action="edit-shift" data-emp="${escapeHTML(emp.id)}" data-date="${date}" aria-label="Editar folga de ${escapeHTML(emp.name)} em ${formatDateBR(date)}">
                  ${warningDot}
                  <span class="off-icon">${icon(dow === 0 ? 'lock' : 'moon')}</span>
                  <span class="off-label">${dow === 0 ? 'Fechado' : 'Folga'}</span>
                  <span class="off-sub">${dow === 0 ? 'domingo' : 'semanal'}</span>
                </button>
              </td>`;
          }
          const net = entryNetMinutes(entry);
          const shiftLabel = shiftNameForEntry(dow, entry);
          const segments = entrySegments(entry);
          const totalBreak = segments.reduce((sum, seg) => sum + seg.breakMinutes, 0);
          const timesHTML = segments.length > 1
            ? `<div class="shift-rows">${segments.map((seg, index) => `
                <span class="shift-row">
                  <span class="shift-row-label">${escapeHTML(segmentShiftName(dow, seg, index))}</span>
                  <span class="shift-time">${seg.start}<span class="dash">–</span>${seg.end}</span>
                </span>`).join('')}</div>`
            : `<span class="shift-badge">${escapeHTML(shiftLabel)}</span>
               <span class="shift-time">${segments[0]?.start || entry.start}<span class="dash">–</span>${segments[0]?.end || entry.end}</span>`;
          return `
            <td>
              <button type="button" class="${cellClass}" style="--emp:${emp.color}" data-action="edit-shift" data-emp="${escapeHTML(emp.id)}" data-date="${date}" aria-label="Editar jornada de ${escapeHTML(emp.name)} em ${formatDateBR(date)}, ${escapeHTML(shiftLabel)}">
                ${warningDot}
                ${timesHTML}
                <span class="shift-meta">${icon('clock')}${formatDuration(net)}${totalBreak ? `<span class="dot"></span>${icon('coffee')}${formatBreakShort(totalBreak)}` : ''}</span>
              </button>
            </td>`;
        }).join('');

        const target = Math.round((Number(emp.weeklyHours) || LEGAL.weeklyMinutes / 60) * 60);
        const progress = clamp((stats.minutes / Math.max(target, 1)) * 100, 0, 100);
        const employeeIssues = analysis.issues.filter((item) => item.employeeId === emp.id);
        const hasError = employeeIssues.some((item) => item.severity === 'error');
        const overLimit = stats.minutes > LEGAL.weeklyMinutes;
        const overTarget = stats.minutes > target;
        const statusClass = overLimit || hasError ? 'is-danger' : overTarget || stats.offDays < 2 ? 'is-warn' : '';
        const statusLabel = overLimit ? 'Acima de 42h' : hasError ? 'Revisar' : overTarget ? 'Acima da meta' : stats.offDays < 2 ? 'Folgas insuficientes' : 'Dentro da lei';

        return `
          <tr>
            <td class="employee-cell">
              <div class="employee-info">
                <span class="avatar" style="background:${emp.color}18;color:${emp.color}">${initials(emp.name)}</span>
                <span class="employee-meta">
                  <span class="employee-name" title="${escapeHTML(emp.name)}">${escapeHTML(emp.name)}</span>
                  <span class="employee-role">${escapeHTML(emp.role || 'Equipe')}</span>
                </span>
              </div>
            </td>
            ${cells}
            <td class="total-cell">
              <div class="total-top"><span class="total-value">${formatDuration(stats.minutes)}</span><span class="total-target">/ ${emp.weeklyHours}h</span></div>
              <div class="total-progress"><span class="${overLimit ? 'is-over' : ''}" style="width:${progress}%"></span></div>
              <div class="total-status ${statusClass}">${statusLabel}</div>
            </td>
          </tr>`;
      }).join('');
    } else {
      rows = `
        <tr>
          <td colspan="9" class="employee-cell" style="position:static;box-shadow:none;padding:34px 20px!important;text-align:center">
            <div class="empty-state" style="border:0;background:transparent;min-height:0;padding:10px">
              <div class="empty-icon">${icon('users')}</div>
              <h3>Cadastre sua equipe</h3>
              <p>Adicione colaboradores para gerar a primeira escala 5x2.</p>
              <button class="btn btn-primary" type="button" data-action="add-employee">${icon('plus')} Adicionar colaborador</button>
            </div>
          </td>
        </tr>`;
    }

    const footerCells = dates.map((date) => {
      const day = analysis.dayCounts.find((item) => item.date === date);
      return `<td>${day.open ? `${formatDuration(day.minutes)}<br><span style="opacity:.65">${day.count} pessoas</span>` : 'Fechado'}</td>`;
    }).join('');

    document.getElementById('schedule-table').innerHTML = `
      <thead>
        <tr>
          <th class="employee-head" scope="col">Equipe</th>
          ${headerCells}
          <th class="total-head" scope="col">Semana</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td>Total do dia</td>
          ${footerCells}
          <td class="total-cell">${formatDuration(analysis.totalMinutes)}</td>
        </tr>
      </tfoot>`;

    renderWeekAside(analysis);
  }

  function renderWeekAside(analysis) {
    const ringTone = analysis.status === 'danger' ? 'is-danger' : analysis.status === 'warn' ? 'is-warn' : '';
    const checkItems = analysis.checks.map((check) => `
      <li class="check-item ${check.status === 'danger' ? 'is-danger' : check.status === 'warn' ? 'is-warn' : ''}">
        <span class="check-icon">${icon(check.status === 'ok' ? 'check' : 'alert')}</span>
        <span class="check-copy"><strong>${escapeHTML(check.label)}</strong><span>${escapeHTML(check.detail)}</span></span>
      </li>`).join('');

    const coverageRows = analysis.dayCounts.map((day) => {
      if (!day.open) {
        return `
          <div class="coverage-row">
            <span class="coverage-day">${DAY_SHORT[day.dow]}</span>
            <div class="coverage-track"><span class="is-closed" style="width:0"></span></div>
            <span class="coverage-value">fechado</span>
          </div>`;
      }
      const ratio = clamp((day.count / Math.max(1, analysis.employees.length)) * 100, 0, 100);
      const low = day.count < day.minStaff;
      return `
        <div class="coverage-row">
          <span class="coverage-day">${DAY_SHORT[day.dow]}</span>
          <div class="coverage-track" title="${day.count} escalados, mínimo ${day.minStaff}"><span class="${low ? 'is-low' : ''}" style="width:${ratio}%"></span></div>
          <span class="coverage-value ${low ? 'is-low' : ''}"><strong>${day.count}</strong>/${day.minStaff}</span>
        </div>`;
    }).join('');

    const saturday = state.settings.weekdays['6'];
    const satDuration = Math.max(0, (timeToMinutes(saturday.end) || 0) - (timeToMinutes(saturday.start) || 0));
    const tipText = saturday.open
      ? `No sábado, a equipe trabalha das <strong>${saturday.start} às ${saturday.end}</strong>. Quem é escalado cumpre <strong>${formatDuration(satDuration)}</strong> e recebe uma folga na semana para fechar a escala 5x2.`
      : 'O sábado está fechado nas regras atuais. Você pode ativá-lo em <strong>Regras</strong> quando precisar.';

    document.getElementById('week-aside').innerHTML = `
      <section class="panel compliance-panel">
        <div class="panel-head">
          <div><h3>Conformidade</h3><p>Checagem automática da semana</p></div>
          <div class="score-ring ${ringTone}" style="--score:${analysis.score}%">
            <span class="score-ring-content"><strong>${analysis.score}</strong><small>%</small></span>
          </div>
        </div>
        <ul class="check-list">${checkItems}</ul>
        <div class="compliance-footer">
          <span class="issue-count"><strong>${analysis.issues.length}</strong> ${analysis.issues.length === 1 ? 'pendência' : 'pendências'}</span>
          <button class="btn-link" type="button" data-action="show-issues">Ver detalhes</button>
        </div>
      </section>
      <section class="panel coverage-panel">
        <div class="panel-head"><div><h3>Cobertura por dia</h3><p>Escalados / mínimo necessário</p></div></div>
        <div class="coverage-list">${coverageRows}</div>
      </section>
      <section class="panel tip-panel">
        <div class="tip-kicker">${icon('calendar')} Regra da casa</div>
        <h3>Sábado de manhã</h3>
        <p>${tipText}</p>
      </section>`;
  }

  /* =========================================================
     Renderização: equipe
     ========================================================= */
  function renderTeam() {
    const employees = allEmployeesSorted();
    const active = employees.filter((emp) => emp.active);
    const month = currentMonthKey();
    const monthWeeks = weeksForMonth(month);
    const preferences = active.filter((emp) => emp.preferredOff).length;
    const avgTarget = active.length ? active.reduce((sum, emp) => sum + Number(emp.weeklyHours || 0), 0) / active.length : 0;
    let saturdayCount = 0;
    for (const weekStart of monthWeeks) {
      for (const date of getWeekDates(weekStart)) {
        if (!date.startsWith(month) || dayOfWeekISO(date) !== 6) continue;
        if (active.some((emp) => getEntry(weekStart, date, emp.id)?.status === 'work')) saturdayCount++;
      }
    }

    const cards = employees.map((emp) => {
      const stats = getEmployeeWeekStats(emp.id, ui.weekStart);
      let saturdays = 0;
      for (const weekStart of monthWeeks) {
        for (const date of getWeekDates(weekStart)) {
          if (date.startsWith(month) && dayOfWeekISO(date) === 6 && getEntry(weekStart, date, emp.id)?.status === 'work') saturdays++;
        }
      }
      const preferred = emp.preferredOff ? DAY_FULL[Number(emp.preferredOff)] : 'Sem preferência';
      const preferredShiftLabel = emp.preferredShifts?.length
        ? emp.preferredShifts.map((id) => (id === 'morning' ? 'Manhã' : 'Tarde')).join(' + ')
        : 'Sem preferência';
      return `
        <article class="employee-card ${emp.active ? '' : 'is-inactive'}">
          <div class="employee-card-top">
            <div class="employee-card-person">
              <span class="avatar avatar-lg" style="background:${emp.color}18;color:${emp.color}">${initials(emp.name)}</span>
              <div>
                <div class="employee-card-name">${escapeHTML(emp.name)}</div>
                <div class="employee-card-role">${escapeHTML(emp.role || 'Equipe')}</div>
              </div>
            </div>
            <div class="employee-card-actions">
              ${emp.active ? '' : '<span class="badge is-off">Inativo</span>'}
              <button class="mini-btn" type="button" data-action="edit-employee" data-id="${escapeHTML(emp.id)}" aria-label="Editar ${escapeHTML(emp.name)}">${icon('edit')}</button>
            </div>
          </div>
          <div class="employee-card-stats">
            <div class="employee-stat"><span>Carga semanal</span><strong>${emp.weeklyHours}h</strong></div>
            <div class="employee-stat"><span>Folga preferida</span><strong class="${emp.preferredOff ? '' : 'is-muted'}">${escapeHTML(preferred)}</strong></div>
            <div class="employee-stat"><span>Nesta semana</span><strong>${formatDuration(stats.minutes)}</strong></div>
            <div class="employee-stat"><span>Sábados no mês</span><strong>${saturdays}</strong></div>
          </div>
          <div class="employee-card-bottom">
            <span class="preference-chip">${icon('clock')} ${escapeHTML(preferredShiftLabel)}</span>
            <span class="preference-chip">${icon('calendar-off')} ${emp.preferredOff ? 'Folga pedida' : 'Livre para escala'}</span>
            <span class="week-hours">Meta semanal<strong>${emp.weeklyHours}h</strong></span>
          </div>
        </article>`;
    }).join('');

    document.getElementById('team-content').innerHTML = `
      <div class="team-banner">
        <div>
          <h2>${pluralize(active.length, 'pessoa ativa', 'pessoas ativas')}</h2>
          <p>Domingo é fechado. Cada pessoa trabalha 5 dias e descansa 2. O sábado é revezado conforme a preferência de folga e a cobertura mínima, exceto por quem pediu sábado de folga.</p>
        </div>
        <div class="team-banner-stats">
          <div class="team-banner-stat"><strong>${formatDuration(avgTarget * 60)}</strong><span>Carga média</span></div>
          <div class="team-banner-stat"><strong>${preferences}/${active.length}</strong><span>Preferências</span></div>
          <div class="team-banner-stat"><strong>${saturdayCount}</strong><span>Sábados no mês</span></div>
        </div>
      </div>
      <div class="team-grid">
        ${cards}
        <button class="add-employee-card" type="button" data-action="add-employee">
          <span class="add-employee-icon">${icon('plus')}</span>
          <strong>Adicionar colaborador</strong>
          <span>Inclua mais uma pessoa na escala e nas preferências de folga.</span>
        </button>
      </div>
      <div class="team-note">
        ${icon('info')}
        <span><strong>Como a folga é escolhida:</strong> a geração automática tenta respeitar a preferência de segunda a sexta, mas prioriza a cobertura mínima dos dias. Quem tem <strong>sábado como folga preferida nunca é escalado em nenhum sábado</strong> e não ganha folga compensatória em dia útil: suas folgas são sábado e domingo.</span>
      </div>`;
  }

  /* =========================================================
     Renderização: relatório
     ========================================================= */
  function renderReport() {
    const month = ui.reportMonth;
    ensureMonthScheduled(month, { preserve: true });
    const weeks = weeksForMonth(month);
    const employees = activeEmployees();
    const analysis = analyzeMonth(month);
    const rowsData = employees.map((emp) => ({ emp, stats: getEmployeeMonthStats(emp, month, weeks, analysis) }));
    const totalMinutes = rowsData.reduce((sum, row) => sum + row.stats.total, 0);
    const totalReference = rowsData.reduce((sum, row) => sum + row.stats.reference, 0);
    const totalSaturdays = rowsData.reduce((sum, row) => sum + row.stats.saturdays, 0);
    const totalOffDays = rowsData.reduce((sum, row) => sum + row.stats.offDays, 0);
    const avgMinutes = employees.length ? totalMinutes / employees.length : 0;

    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    let saturdayDays = 0;
    let coveredSaturdays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${pad2(day)}`;
      if (dayOfWeekISO(date) !== 6) continue;
      saturdayDays++;
      if (employees.some((emp) => getEntryByDate(date, emp.id)?.status === 'work')) coveredSaturdays++;
    }

    document.getElementById('report-month-label').textContent = monthLabel(month);

    const statusLabel = analysis.errors ? 'Revisar' : analysis.warnings ? 'Atenção' : 'Conforme';
    const statsHTML = [
      statCard({
        iconName: 'clock', label: 'Horas no mês', value: formatDuration(totalMinutes),
        sub: `${pluralize(employees.length, 'pessoa ativa', 'pessoas ativas')} · horas líquidas`, tone: 'is-copper'
      }),
      statCard({
        iconName: 'users', label: 'Média por pessoa', value: formatDuration(avgMinutes),
        sub: `referência média de ${formatDuration(employees.reduce((sum, emp) => sum + emp.weeklyHours * 60, 0) / Math.max(employees.length, 1) * 52 / 12)}`,
        tone: ''
      }),
      statCard({
        iconName: 'calendar-off', label: 'Sábados cobertos', value: `${coveredSaturdays}<small class="tight">/${saturdayDays}</small>`,
        sub: `${pluralize(totalSaturdays, 'escala de sábado', 'escalas de sábado')} no mês`,
        tone: coveredSaturdays < saturdayDays ? 'is-warn' : 'is-good'
      }),
      statCard({
        iconName: analysis.errors ? 'alert' : analysis.warnings ? 'info' : 'check',
        label: 'Situação legal', value: statusLabel, sub: `${analysis.errors} erros · ${analysis.warnings} avisos`,
        tone: analysis.errors ? 'is-danger' : analysis.warnings ? 'is-warn' : 'is-good'
      })
    ].join('');

    const weekColumns = weeks.map((weekStart, index) => {
      return `<th class="week-col" scope="col"><strong>Sem ${index + 1}</strong><small>${formatShortDate(weekStart)}</small></th>`;
    }).join('');

    const tableRows = rowsData.map(({ emp, stats }) => {
      const weekCells = stats.weekMinutes.map((minutes) => `
        <td class="week-hours-cell ${minutes ? '' : 'is-empty'}">${minutes ? formatDuration(minutes) : '—'}</td>`).join('');
      const statusClass = stats.status === 'danger' ? 'is-danger' : stats.status === 'warn' ? 'is-warn' : '';
      const statusText = stats.status === 'danger' ? 'Revisar' : stats.status === 'warn' ? 'Verificar' : 'OK';
      return `
        <tr>
          <td>
            <div class="report-person">
              <span class="avatar" style="background:${emp.color}18;color:${emp.color}">${initials(emp.name)}</span>
              <div><strong>${escapeHTML(emp.name)}</strong><span>${escapeHTML(emp.role || 'Equipe')}</span></div>
            </div>
          </td>
          ${weekCells}
          <td class="total-month">${formatDuration(stats.total)}</td>
          <td class="reference-cell">${formatDuration(stats.reference)}</td>
          <td class="balance-cell ${stats.balance < 0 ? 'is-negative' : 'is-positive'}">${formatSignedDuration(stats.balance)}</td>
          <td>${stats.offDays}</td>
          <td>${stats.saturdays}</td>
          <td><span class="report-status ${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');

    const footerWeeks = weeks.map((weekStart) => {
      const minutes = rowsData.reduce((sum, row) => {
        const index = weeks.indexOf(weekStart);
        return sum + (row.stats.weekMinutes[index] || 0);
      }, 0);
      return `<td>${minutes ? formatDuration(minutes) : '—'}</td>`;
    }).join('');

    const alertHTML = analysis.errors || analysis.warnings
      ? `<div class="alert-strip ${analysis.errors ? 'is-danger' : ''}">
          ${icon(analysis.errors ? 'alert' : 'info')}
          <span><strong>${analysis.errors ? pluralize(analysis.errors, 'erro', 'erros') : pluralize(analysis.warnings, 'aviso', 'avisos')}</strong> no mês. ${analysis.errors ? 'Revise as jornadas sinalizadas antes de publicar.' : 'Há pontos de atenção que merecem conferência.'}</span>
        </div>`
      : '';

    const weekBarsData = weeks.map((weekStart, index) => {
      const minutes = rowsData.reduce((sum, row) => sum + (row.stats.weekMinutes[index] || 0), 0);
      const datesInMonth = getWeekDates(weekStart).filter((date) => date.startsWith(month)).length;
      return { weekStart, minutes, partial: datesInMonth < 7 };
    });
    const maxWeek = Math.max(...weekBarsData.map((item) => item.minutes), 1);
    const bars = weekBarsData.map((item, index) => `
      <div class="week-bar-group">
        <span class="week-bar-value">${formatDuration(item.minutes)}</span>
        <div class="week-bar-area"><span class="week-bar ${item.partial ? 'is-partial' : ''}" style="height:${Math.max(4, (item.minutes / maxWeek) * 100)}%"></span></div>
        <span class="week-bar-label">Sem ${index + 1}<br>${formatShortDate(item.weekStart)}</span>
      </div>`).join('');

    let content = '';
    if (!employees.length) {
      content = `
        <div class="empty-state">
          <div class="empty-icon">${icon('users')}</div>
          <h3>Sem dados para o relatório</h3>
          <p>Adicione colaboradores e gere a escala para acompanhar as horas mensais.</p>
          <button class="btn btn-primary" type="button" data-action="add-employee">${icon('plus')} Adicionar colaborador</button>
        </div>`;
    } else {
      content = `
        <div class="stat-grid">${statsHTML}</div>
        ${alertHTML}
        <section class="panel report-table-panel" aria-labelledby="report-table-title">
          <div class="panel-head">
            <div><h2 id="report-table-title">Horas por colaborador</h2><p>Recorte de ${monthLabel(month)} · ${pluralize(totalOffDays, 'folga registrada', 'folgas registradas')} no mês</p></div>
            <span class="badge ${analysis.errors ? 'is-warn' : ''}">${escapeHTML(state.company.name)}</span>
          </div>
          <div class="table-scroll">
            <table class="report-table">
              <thead>
                <tr>
                  <th scope="col">Colaborador</th>
                  ${weekColumns}
                  <th scope="col">Total</th>
                  <th scope="col">Referência</th>
                  <th scope="col">Diferença</th>
                  <th scope="col">Folgas</th>
                  <th scope="col">Sábados</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>
                <tr>
                  <td>Total da equipe</td>
                  ${footerWeeks}
                  <td class="total-month">${formatDuration(totalMinutes)}</td>
                  <td>${formatDuration(totalReference)}</td>
                  <td>${formatSignedDuration(totalMinutes - totalReference)}</td>
                  <td>${totalOffDays}</td>
                  <td>${totalSaturdays}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="table-scroll-hint">${icon('arrow-right')} Deslize a tabela para ver todas as colunas.</p>
        </section>
        <div class="report-lower">
          <section class="panel report-chart">
            <div class="report-chart-head"><h3>Ritmo do mês</h3><span>horas da equipe por semana</span></div>
            <div class="week-bars">${bars}</div>
          </section>
          <section class="panel report-note-card">
            <h3>Como ler este relatório</h3>
            <ul>
              <li>${icon('clock')}<span>As horas são líquidas: o intervalo de cada turno é descontado e manhã e tarde são somados no mesmo dia.</span></li>
              <li>${icon('calendar')}<span>A referência mensal usa a carga semanal cadastrada × 52 ÷ 12 (42h para a meta legal). Quem folga no sábado fica um pouco abaixo dela.</span></li>
              <li>${icon('scale')}<span>O status legal olha para 42h semanais, ${formatDuration(dailyCapMinutes())} por dia, 2 folgas e intervalos. A diferença para a referência é informativa.</span></li>
            </ul>
          </section>
        </div>
        <p class="report-footnote">Apenas os dias dentro de ${monthLabel(month)} entram nos totais. Semanas que cruzam dois meses aparecem proporcionais nas colunas. Referência legal: 42h semanais e ${formatDuration(dailyCapMinutes())} por dia na geração (${escapeHTML(LEGAL.source)}, ${LEGAL.effectiveDate}). A carga cadastrada para cada pessoa é editável em Equipe.</p>`;
    }

    document.getElementById('report-content').innerHTML = content;
  }

  /* =========================================================
     Renderização: regras
     ========================================================= */
  function renderRules() {
    const defaults = defaultWeekdays();
    const weekdayRows = [1, 2, 3, 4, 5].map((day) => {
      const conf = state.settings.weekdays[String(day)] || defaults[String(day)];
      const shifts = (conf.shifts?.length ? conf.shifts : defaults[String(day)].shifts);
      const groups = shifts.map((shift) => `
        <div class="shift-config-group">
          <span class="shift-config-label">${escapeHTML(shift.label)}</span>
          <div class="shift-config-fields">
            <input type="time" data-shift-start="${day}" data-shift-id="${escapeHTML(shift.id)}" value="${escapeHTML(shift.start)}" ${conf.open ? '' : 'disabled'} aria-label="Entrada do turno ${escapeHTML(shift.label)} de ${DAY_FULL[day]}">
            <input type="time" data-shift-end="${day}" data-shift-id="${escapeHTML(shift.id)}" value="${escapeHTML(shift.end)}" ${conf.open ? '' : 'disabled'} aria-label="Saída do turno ${escapeHTML(shift.label)} de ${DAY_FULL[day]}">
            <input type="number" data-shift-min="${day}" data-shift-id="${escapeHTML(shift.id)}" min="0" max="99" value="${Number(shift.minStaff) || 0}" ${conf.open ? '' : 'disabled'} aria-label="Equipe mínima do turno ${escapeHTML(shift.label)} de ${DAY_FULL[day]}">
          </div>
        </div>`).join('');
      return `
        <div class="weekday-config-row is-shift-row">
          <label class="weekday-name">
            <input class="weekday-open" type="checkbox" data-day-open="${day}" ${conf.open ? 'checked' : ''}>
            ${DAY_FULL[day].replace('-feira', '')}
          </label>
          ${groups}
        </div>`;
    }).join('');

    const sat = state.settings.weekdays['6'] || defaults['6'];
    const singleRows = `
      <div class="weekday-config-row">
        <label class="weekday-name">
          <input class="weekday-open" type="checkbox" data-day-open="6" ${sat.open ? 'checked' : ''}>
          Sábado
        </label>
        <input type="time" data-day-start="6" value="${escapeHTML(sat.start)}" ${sat.open ? '' : 'disabled'} aria-label="Abertura de sábado">
        <input type="time" data-day-end="6" value="${escapeHTML(sat.end)}" ${sat.open ? '' : 'disabled'} aria-label="Fechamento de sábado">
        <input type="number" data-day-min="6" min="0" max="99" value="${Number(sat.minStaff) || 0}" ${sat.open ? '' : 'disabled'} aria-label="Equipe mínima de sábado">
      </div>
      <div class="weekday-config-row">
        <span class="weekday-name">${icon('lock')} Domingo</span>
        <span class="weekday-lock">Fechado</span>
        <span class="weekday-lock">Descanso</span>
        <span class="weekday-lock">—</span>
      </div>`;

    document.getElementById('rules-content').innerHTML = `
      <form id="settings-form" novalidate>
        <div class="rules-grid">
          <div class="rules-col">
            <section class="panel rules-panel">
              <div class="rules-panel-head">
                <div><h2>Identidade</h2><p>Como sua operação aparece no sistema.</p></div>
                ${icon('building')}
              </div>
              <div class="form-grid">
                <label class="field"><span>Nome da empresa</span><input type="text" name="companyName" maxlength="80" value="${escapeHTML(state.company.name || '')}" required></label>
                <label class="field"><span>Unidade</span><input type="text" name="companyUnit" maxlength="80" value="${escapeHTML(state.company.unit || '')}" placeholder="Unidade principal"></label>
              </div>
            </section>

            <section class="panel rules-panel">
              <div class="rules-panel-head">
                <div><h2>Funcionamento</h2><p>Segunda a sexta com dois turnos: manhã e tarde. Sábado pela manhã; domingo é descanso.</p></div>
                ${icon('clock')}
              </div>
              <div class="weekday-config">
                <div class="weekday-config-head is-shift-head"><span>Dia</span><span>Manhã · entrada / saída / mín.</span><span>Tarde · entrada / saída / mín.</span></div>
                ${weekdayRows}
              </div>
              <div class="weekday-config weekday-config-single">
                <div class="weekday-config-head"><span>Dia</span><span>Abre</span><span>Fecha</span><span>Mín.</span></div>
                ${singleRows}
              </div>
              <div class="form-note">${icon('info')} De segunda a sexta cada pessoa disponível trabalha manhã e tarde no mesmo dia. As mínimas dos dois turnos são checadas separadamente. Alterações valem para a próxima geração.</div>
            </section>

            <section class="panel rules-panel">
              <div class="rules-panel-head">
                <div><h2>Geração automática</h2><p>Critérios usados ao montar uma nova escala.</p></div>
                ${icon('sparkles')}
              </div>
              <label class="switch-row">
                <input type="checkbox" name="honorPreferences" ${state.settings.auto?.honorPreferences !== false ? 'checked' : ''}>
                <span class="switch-copy"><strong>Considerar folgas preferidas</strong><span>Tenta encaixar a folga pedida de segunda a sexta antes de fechar a cobertura. Quem pede sábado de folga fica de fora de todos os sábados, com ou sem esta opção.</span></span>
              </label>
              <div class="form-note">${icon('refresh')} A geração distribui 5 dias de trabalho e 2 folgas, escala manhã e tarde de segunda a sexta, ajusta os horários para não passar de ${formatDuration(dailyCapMinutes())} por dia (42h ÷ 5) e limita a semana a 42h. Para cobrir a abertura e o fechamento da loja, parte da equipe sai antes e outra entra depois. Edições manuais são preservadas quando você marcar essa opção ao gerar.</div>
              <div class="save-bar" style="margin-top:16px">
                <p>As regras são salvas neste navegador.</p>
                <button class="btn btn-primary" type="submit">${icon('check')} Salvar regras</button>
              </div>
            </section>
          </div>

          <div class="rules-col">
            <section class="panel rules-panel">
              <div class="rules-panel-head">
                <div><h2>Limites legais</h2><p>Referências usadas pelo checklist.</p></div>
                ${icon('scale')}
              </div>
              <ul class="legal-list">
                <li><span class="legal-number">42h</span><div><strong>Jornada semanal</strong><p>${escapeHTML(LEGAL.source)}, com vigência em ${LEGAL.effectiveDate}: jornada máxima de 42 horas e duas folgas por semana no 5x2.</p></div></li>
                <li><span class="legal-number">${formatDuration(dailyCapMinutes())}</span><div><strong>Teto diário gerado</strong><p>42h ÷ 5 dias de trabalho. A geração escalona entradas e saídas para manter a cobertura da loja sem ultrapassar esse teto.</p></div></li>
                <li><span class="legal-number">8h</span><div><strong>Jornada diária</strong><p>Até 8h normais, com possibilidade de até 2h extras mediante acordo.</p></div></li>
                <li><span class="legal-number">1h</span><div><strong>Intervalo</strong><p>Jornadas acima de 6h pedem pelo menos 1h de intervalo, salvo previsão coletiva.</p></div></li>
                <li><span class="legal-number">11h</span><div><strong>Entre turnos</strong><p>Descanso mínimo de 11 horas entre o fim de um turno e o início do próximo.</p></div></li>
              </ul>
              <p class="legal-disclaimer">Regra aplicada: ${escapeHTML(LEGAL.source)} (${LEGAL.effectiveDate}) — 5 dias de trabalho, 2 folgas semanais e jornada máxima de 42h (${formatDuration(dailyCapMinutes())} por dia). A geração já limita as jornadas automáticas a esse teto e escalona os horários da grade. Convenções coletivas, acordos individuais e particularidades da categoria podem alterar limites. Confirme com contador ou advogado trabalhista.</p>
            </section>

            <section class="panel rules-panel">
              <div class="rules-panel-head">
                <div><h2>Dados</h2><p>Backup, restauração e limpeza.</p></div>
                ${icon('lock')}
              </div>
              <div class="data-actions">
                <button class="btn btn-ghost" type="button" data-action="export-backup">${icon('download')} Backup</button>
                <button class="btn btn-ghost" type="button" data-action="import-backup">${icon('upload')} Restaurar</button>
              </div>
              <div class="data-actions" style="margin-top:8px">
                <button class="btn btn-quiet" type="button" data-action="reset-data">${icon('refresh')} Restaurar exemplo</button>
              </div>
              <p class="data-status"><strong>${state.employees.length}</strong> colaboradores e <strong>${Object.keys(state.weeks).length}</strong> semanas salvas. Seus dados não saem deste navegador.</p>
              <input type="file" accept=".json,application/json" data-import-input hidden>
            </section>
          </div>
        </div>
      </form>`;
  }

  /* =========================================================
     Modal base e confirmação
     ========================================================= */
  function openModal({ title, eyebrow = '', subtitle = '', body = '', footer = '', size = '', onMount = null }) {
    closeModal({ restoreFocus: false });
    const root = document.getElementById('modal-root');
    const previousFocus = document.activeElement;
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-head">
            <div class="modal-head-copy">
              ${eyebrow ? `<div class="modal-eyebrow">${escapeHTML(eyebrow)}</div>` : ''}
              <h2 id="modal-title">${escapeHTML(title)}</h2>
              ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ''}
            </div>
            <button class="icon-btn modal-close" type="button" data-close-modal aria-label="Fechar">${icon('close')}</button>
          </div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>`;
    document.body.classList.add('modal-open');
    const backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeModal();
    });
    activeModal = { root, previousFocus };
    if (typeof onMount === 'function') onMount(root.querySelector('.modal'), root);
    window.setTimeout(() => {
      const preferred = root.querySelector('[data-autofocus]') || root.querySelector('.modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea');
      const fallback = root.querySelector('.modal-footer .btn-primary');
      if (preferred) preferred.focus();
      else if (fallback) fallback.focus();
    }, 30);
  }

  function closeModal(options = {}) {
    if (!activeModal) return;
    const { root, previousFocus } = activeModal;
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    activeModal = null;
    if (options.restoreFocus !== false && previousFocus && document.contains(previousFocus)) {
      try { previousFocus.focus(); } catch (error) { /* noop */ }
    }
  }

  function openConfirm({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
    openModal({
      eyebrow: danger ? 'Atenção' : 'Confirmar',
      title,
      body: `
        <div class="confirm-icon">${icon(danger ? 'alert' : 'info')}</div>
        <p class="confirm-copy">${escapeHTML(message)}</p>`,
      footer: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" id="confirm-action">${escapeHTML(confirmLabel)}</button>`,
      onMount(modal) {
        modal.querySelector('#confirm-action')?.addEventListener('click', () => {
          closeModal();
          if (typeof onConfirm === 'function') onConfirm();
        });
      }
    });
  }

  function showToast(message, tone = 'success') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tone === 'error' ? 'is-error' : tone === 'warn' ? 'is-warn' : ''}`;
    toast.innerHTML = `${icon(tone === 'error' ? 'alert' : tone === 'warn' ? 'info' : 'check')}<span>${escapeHTML(message)}</span>`;
    root.appendChild(toast);
    while (root.children.length > 3) root.removeChild(root.firstElementChild);
    window.setTimeout(() => {
      toast.classList.add('is-out');
      window.setTimeout(() => toast.remove(), 240);
    }, 4200);
  }

  /* =========================================================
     Modal de edição do dia
     ========================================================= */
  function composeOperationShift(dow, shift) {
    if (!shift) return null;
    const start = timeToMinutes(shift.start);
    const end = timeToMinutes(shift.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    let breakMinutes = Number.isFinite(Number(shift.breakMinutes))
      ? Number(shift.breakMinutes)
      : defaultShiftBreak(shift.start, shift.end);
    if (breakMinutes >= end - start) breakMinutes = 0;
    return { start: shift.start, end: shift.end, breakMinutes };
  }

  function buildShiftPresets(emp, dow) {
    const list = [];
    const add = (label, shiftId, start, end, breakMinutes) => {
      if (!isValidTime(start) || !isValidTime(end)) return;
      if (timeToMinutes(end) <= timeToMinutes(start)) return;
      const signature = `${start}|${end}|${breakMinutes}`;
      if (list.some((item) => item.signature === signature)) return;
      list.push({ label, shiftId, start, end, breakMinutes, signature });
    };
    for (const shiftId of ['morning', 'afternoon']) {
      const def = emp.defaultShifts?.[shiftId];
      if (!def || !dayShifts(dow).some((shift) => shift.id === shiftId)) continue;
      let breakMinutes = clamp(Number(def.breakMinutes) || 0, 0, 240);
      if (breakMinutes >= timeToMinutes(def.end) - timeToMinutes(def.start)) breakMinutes = 0;
      add(`Meu padrão · ${SHIFT_LABELS[shiftId]}`, shiftId, def.start, def.end, breakMinutes);
    }
    const saturdayConfig = dayShifts(dow).find((shift) => shift.id === 'saturday');
    const morningPersonal = emp.defaultShifts?.morning;
    if (saturdayConfig && morningPersonal && isValidTime(morningPersonal.start) && isValidTime(morningPersonal.end)) {
      let breakMinutes = clamp(Number(morningPersonal.breakMinutes) || 0, 0, 240);
      if (breakMinutes >= timeToMinutes(morningPersonal.end) - timeToMinutes(morningPersonal.start)) breakMinutes = 0;
      add('Meu padrão · Manhã', 'saturday', morningPersonal.start, morningPersonal.end, breakMinutes);
    }
    for (const shift of dayShifts(dow)) {
      const composed = composeOperationShift(dow, shift);
      if (composed) add(shift.label, shift.id, composed.start, composed.end, composed.breakMinutes);
    }
    add('Padrão da equipe', 'custom', emp.defaultStart, emp.defaultEnd, emp.breakMinutes);
    return list;
  }

  function openShiftModal(empId, date) {
    const emp = findEmployee(empId);
    if (!emp) return;
    const dow = dayOfWeekISO(date);
    const weekStart = startOfWeekISO(date);
    const existing = getEntry(weekStart, date, emp.id);
    const saturdayBlocked = dow === 6 && prefersSaturdayOff(emp);
    const isWork = existing?.status === 'work' && !saturdayBlocked;
    const shifts = dayShifts(dow);
    const entrySegmentsList = entrySegments(existing);
    const multiMode = entrySegmentsList.length > 1 || (dow >= 1 && dow <= 5 && shifts.length > 1);
    const autoSegments = multiMode ? shifts.map((shift) => {
      const auto = buildAutoShift(emp, dow, shift);
      return { id: shift.id, start: auto.start, end: auto.end, breakMinutes: auto.breakMinutes };
    }) : [];
    let initialSegments = entrySegmentsList;
    if (multiMode) {
      const byId = new Map(entrySegmentsList.filter((seg) => seg.id).map((seg) => [seg.id, seg]));
      initialSegments = autoSegments.map((seg) => byId.get(seg.id) || seg);
      if (entrySegmentsList.length === 1 && !entrySegmentsList[0].id && initialSegments.length) {
        initialSegments[0] = entrySegmentsList[0];
      }
    }
    const preferredId = emp.preferredShifts?.[0] || '';
    const preferredConfig = preferredId && findShift(dow, preferredId);
    const personalMorning = emp.defaultShifts?.morning;
    const hint = preferredConfig
      ? { status: 'work', start: preferredConfig.start, end: preferredConfig.end }
      : { status: 'work', start: personalMorning?.start || emp.defaultStart, end: personalMorning?.end || emp.defaultEnd };
    const initialShiftId = inferShiftId(dow, isWork ? existing : hint) || 'custom';
    const chosenShift = findShift(dow, initialShiftId);
    const fallback = chosenShift ? composeOperationShift(dow, chosenShift) : null;
    const personalDefault = emp.defaultShifts?.[initialShiftId];
    const start = isWork && !multiMode ? existing.start : fallback?.start || personalDefault?.start || emp.defaultStart;
    const end = isWork && !multiMode ? existing.end : fallback?.end || personalDefault?.end || emp.defaultEnd;
    const breakMinutes = isWork && !multiMode ? existing.breakMinutes : fallback?.breakMinutes ?? personalDefault?.breakMinutes ?? emp.breakMinutes;
    const segmentEditors = multiMode ? `
      <div class="form-note">${icon('info')} Neste dia o colaborador cobre manhã e tarde. Ajuste cada turno separadamente; a jornada somada não pode passar de ${formatDuration(dailyCapMinutes())}.</div>
      <div data-segment-editors>
        ${initialSegments.map((seg, index) => `
          <div class="segment-editor" data-segment-editor data-segment-id="${escapeHTML(seg.id || String(index))}">
            <div class="segment-editor-head">
              <strong>${escapeHTML(segmentShiftName(dow, seg, index))}</strong>
              <span>${escapeHTML(seg.start)} – ${escapeHTML(seg.end)}</span>
            </div>
            <div class="form-grid three">
              <label class="field"><span>Entrada</span><input type="time" value="${escapeHTML(seg.start)}" data-seg-start ${index === 0 ? 'data-autofocus' : ''}></label>
              <label class="field"><span>Saída</span><input type="time" value="${escapeHTML(seg.end)}" data-seg-end></label>
              <label class="field"><span>Intervalo (min)</span><input type="number" min="0" max="240" step="5" value="${Number(seg.breakMinutes) || 0}" data-seg-break></label>
            </div>
          </div>`).join('')}
      </div>` : '';
    const presets = buildShiftPresets(emp, dow);
    const presetHTML = presets.map((preset) => `
      <button class="preset-chip" type="button" data-preset-shift="${escapeHTML(preset.shiftId)}" data-preset-start="${preset.start}" data-preset-end="${preset.end}" data-preset-break="${preset.breakMinutes}">${escapeHTML(preset.label)} · ${preset.start}–${preset.end}</button>`).join('');
    const shiftOptions = shifts.length
      ? `<div class="field shift-option-field"><span>Turno</span>
           <div class="segmented shift-options" role="group" aria-label="Turno">
             ${shifts.map((shift) => `<button type="button" data-shift-option="${escapeHTML(shift.id)}" class="${shift.id === initialShiftId ? 'is-active' : ''}">${escapeHTML(shift.label)}<small>${shift.start}–${shift.end}</small></button>`).join('')}
             <button type="button" data-shift-option="custom" class="${initialShiftId === 'custom' ? 'is-active' : ''}">Personalizado</button>
           </div>
         </div>`
      : '';

    openModal({
      eyebrow: `${DAY_FULL[dow]} · ${formatDateBR(date)}`,
      title: 'Ajustar jornada',
      subtitle: 'A alteração vale apenas para este dia e será preservada nas próximas gerações.',
      body: `
        <div class="shift-person">
          <span class="avatar avatar-lg" style="background:${emp.color}18;color:${emp.color}">${initials(emp.name)}</span>
          <div class="shift-person-copy"><strong>${escapeHTML(emp.name)}</strong><span>${escapeHTML(emp.role || 'Equipe')} · ${DAY_FULL[dow]}, ${formatDateLong(date)}</span></div>
          <span class="shift-day-badge">${DAY_SHORT[dow]} ${fromISO(date).getDate()}</span>
        </div>
        ${saturdayBlocked ? `<div class="inline-alert is-warn">${icon('info')} ${escapeHTML(emp.name)} tem sábado marcado como folga preferida e não pode ser escalado em nenhum sábado. Este dia só pode ser salvo como folga.</div>` : ''}
        <form id="shift-form" novalidate data-emp-id="${escapeHTML(emp.id)}" data-date="${date}">
          <div class="segmented" role="group" aria-label="Tipo do dia">
            <button type="button" data-shift-status="work" class="${isWork ? 'is-active' : ''}" ${saturdayBlocked ? 'disabled title="Folga preferida aos sábados"' : ''}>${icon('clock')} Trabalho</button>
            <button type="button" data-shift-status="off" class="${!isWork ? 'is-active' : ''}">${icon('moon')} Folga</button>
          </div>
          <input type="hidden" name="status" value="${isWork ? 'work' : 'off'}">
          <input type="hidden" name="shift" value="${escapeHTML(initialShiftId)}">
          <div data-work-panel ${isWork ? '' : 'hidden'}>
            ${multiMode ? segmentEditors : `
              ${shiftOptions}
              <div class="preset-row">${presetHTML}</div>
              <div class="form-grid three">
                <label class="field"><span>Entrada</span><input type="time" name="start" value="${start}" data-autofocus></label>
                <label class="field"><span>Saída</span><input type="time" name="end" value="${end}"></label>
                <label class="field"><span>Intervalo (min)</span><input type="number" name="break" min="0" max="240" step="5" value="${Number(breakMinutes) || 0}"></label>
              </div>`}
            <div data-shift-live></div>
          </div>
          <div data-off-panel ${isWork ? 'hidden' : ''}></div>
          <div class="form-error" data-form-error></div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" type="submit" form="shift-form">Salvar dia</button>`,
      onMount(modal) {
        setupShiftModal(modal, emp, date);
      }
    });
  }

  function setupShiftModal(modal, emp, date) {
    const form = modal.querySelector('#shift-form');
    const workPanel = modal.querySelector('[data-work-panel]');
    const offPanel = modal.querySelector('[data-off-panel]');
    const statusInput = form.querySelector('[name="status"]');
    const startInput = form.querySelector('[name="start"]');
    const endInput = form.querySelector('[name="end"]');
    const breakInput = form.querySelector('[name="break"]');
    const shiftInput = form.querySelector('[name="shift"]');
    const live = modal.querySelector('[data-shift-live]');
    const errorBox = modal.querySelector('[data-form-error]');
    const segmentEditors = Array.from(modal.querySelectorAll('[data-segment-editor]'));
    const multiMode = segmentEditors.length > 1;
    const dow = dayOfWeekISO(date);
    const saturdayBlocked = dow === 6 && prefersSaturdayOff(emp);
    if (saturdayBlocked) {
      statusInput.value = 'off';
      modal.querySelectorAll('[data-shift-status="work"]').forEach((button) => { button.disabled = true; });
    }

    const getFormSegments = () => segmentEditors.map((node, index) => {
      const id = String(node.dataset.segmentId || '');
      return {
        id: SHIFT_IDS.includes(id) ? id : '',
        start: node.querySelector('[data-seg-start]')?.value || '',
        end: node.querySelector('[data-seg-end]')?.value || '',
        breakMinutes: clamp(Number(node.querySelector('[data-seg-break]')?.value) || 0, 0, 240)
      };
    });

    const setShiftButtons = (id) => {
      if (shiftInput) shiftInput.value = id;
      modal.querySelectorAll('[data-shift-option]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.shiftOption === id);
      });
    };

    const applyShift = (id) => {
      setShiftButtons(id);
      if (id !== 'custom') {
        const composed = composeOperationShift(dow, findShift(dow, id));
        if (composed) {
          if (startInput) startInput.value = composed.start;
          if (endInput) endInput.value = composed.end;
          if (breakInput) breakInput.value = composed.breakMinutes;
        }
      }
      update();
    };

    const setStatus = (status) => {
      const nextStatus = saturdayBlocked ? 'off' : status;
      statusInput.value = nextStatus;
      modal.querySelectorAll('[data-shift-status]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.shiftStatus === nextStatus);
      });
      if (workPanel) workPanel.hidden = nextStatus !== 'work';
      if (offPanel) offPanel.hidden = nextStatus !== 'off';
      if (errorBox) errorBox.classList.remove('is-visible');
      update();
    };

    const getPreview = () => {
      const status = statusInput.value;
      const weekStart = startOfWeekISO(date);
      let otherMinutes = 0;
      let otherOffDays = 0;
      for (const day of getWeekDates(weekStart)) {
        if (day === date) continue;
        const entry = getEntry(weekStart, day, emp.id);
        if (entry?.status === 'work') otherMinutes += entryNetMinutes(entry);
        else otherOffDays++;
      }
      return { status, otherMinutes, otherOffDays, weekStart };
    };

    const update = () => {
      const preview = getPreview();
      if (preview.status === 'off') {
        const offAfter = preview.otherOffDays + 1;
        const alerts = offAfter < 2
          ? `<div class="inline-alert is-danger">${icon('alert')} A semana ficaria com ${pluralize(offAfter, 'folga', 'folgas')}. O 5x2 exige 2.</div>`
          : `<div class="inline-alert is-ok">${icon('check')} ${pluralize(offAfter, 'folga', 'folgas')} na semana. Escala 5x2 preservada.</div>`;
        if (offPanel) {
          offPanel.innerHTML = `
            <div class="off-note">
              <span class="off-note-icon">${icon('moon')}</span>
              <div class="off-note-copy"><strong>Dia de folga</strong><p>${escapeHTML(emp.name)} não trabalha em ${DAY_FULL[dayOfWeekISO(date)]}. Use para folga semanal, compensação ou descanso.</p></div>
            </div>
            <div class="live-card is-good" style="margin-top:12px">
              <div class="live-card-head"><span class="live-card-label">Semana após a folga</span><span class="live-card-value">${formatDuration(preview.otherMinutes)}</span></div>
              <p class="live-card-sub">${pluralize(offAfter, 'folga', 'folgas')} · meta de ${emp.weeklyHours}h</p>
              <div class="inline-alerts">${alerts}</div>
            </div>`;
        }
        return;
      }

      const segments = multiMode ? getFormSegments() : [{
        id: shiftInput?.value || '',
        start: startInput?.value || '',
        end: endInput?.value || '',
        breakMinutes: clamp(Number(breakInput?.value) || 0, 0, 240)
      }];
      const dailyNet = segments.reduce((sum, seg) => sum + segmentNetMinutes(seg), 0);
      const dailySpan = segments.reduce((sum, seg) => sum + segmentSpanMinutes(seg), 0);
      const dailyBreak = segments.reduce((sum, seg) => sum + seg.breakMinutes, 0);
      const weekAfter = preview.otherMinutes + dailyNet;
      const conf = state.settings.weekdays[String(dow)];
      const alerts = [];
      let tone = 'is-good';
      const hasInvalid = segments.some((seg) => segmentSpanMinutes(seg) <= 0);

      if (hasInvalid) {
        alerts.push({ tone: 'is-danger', text: 'A saída precisa ser posterior à entrada em todos os turnos.' });
        tone = 'is-danger';
      } else if (segments.some((seg) => seg.breakMinutes >= segmentSpanMinutes(seg))) {
        alerts.push({ tone: 'is-danger', text: 'O intervalo não pode ser maior ou igual à jornada do turno.' });
        tone = 'is-danger';
      } else {
        if (dailyNet > dailyCapMinutes()) {
          alerts.push({ tone: 'is-warn', text: `Jornada de ${formatDuration(dailyNet)} no dia: acima de ${formatDuration(dailyCapMinutes())} (42h ÷ 5).` });
          if (tone !== 'is-danger') tone = 'is-warn';
        }
        if (dailyNet > LEGAL.maxDailyMinutes) {
          alerts.push({ tone: 'is-danger', text: `Jornada de ${formatDuration(dailyNet)}: acima do limite diário de 10h.` });
          tone = 'is-danger';
        }
        const totalRest = dailyBreak + segments.slice(1).reduce((sum, seg, index) => {
          const previousEnd = timeToMinutes(segments[index].end);
          const currentStart = timeToMinutes(seg.start);
          return sum + (Number.isFinite(previousEnd) && Number.isFinite(currentStart) ? Math.max(0, currentStart - previousEnd) : 0);
        }, 0);
        if (dailySpan > 360 && totalRest < 60) {
          alerts.push({ tone: 'is-warn', text: `Intervalo de ${totalRest}min para ${formatDuration(dailySpan)} de presença. O mínimo é 1h, salvo acordo coletivo.` });
          if (tone !== 'is-danger') tone = 'is-warn';
        }
        segments.forEach((seg, index) => {
          const span = segmentSpanMinutes(seg);
          const shift = findShift(dow, segmentShiftId(dow, seg, index));
          if (conf?.open) {
            const opStart = shift ? timeToMinutes(shift.start) : timeToMinutes(conf.start);
            const opEnd = shift ? timeToMinutes(shift.end) : timeToMinutes(conf.end);
            if (Number.isFinite(opStart) && Number.isFinite(opEnd) && (timeToMinutes(seg.start) < opStart || timeToMinutes(seg.end) > opEnd)) {
              alerts.push({ tone: 'is-warn', text: `${shift?.label || 'Turno'} fora do horário configurado (${shift?.start || conf.start}–${shift?.end || conf.end}).` });
              if (tone !== 'is-danger') tone = 'is-warn';
            }
          }
        });
        if (weekAfter > LEGAL.weeklyMinutes) {
          alerts.push({ tone: 'is-danger', text: `A semana chegaria a ${formatDuration(weekAfter)}, acima do limite de 42h.` });
          tone = 'is-danger';
        } else if (weekAfter > emp.weeklyHours * 60) {
          alerts.push({ tone: 'is-warn', text: `Semana de ${formatDuration(weekAfter)}: acima da meta de ${emp.weeklyHours}h.` });
          if (tone !== 'is-danger') tone = 'is-warn';
        }
        if (!conf?.open) {
          alerts.push({ tone: 'is-warn', text: `${DAY_FULL[dow]} está fechado nas regras de funcionamento.` });
          if (tone !== 'is-danger') tone = 'is-warn';
        }
        if (!alerts.length) alerts.push({ tone: 'is-ok', text: 'Jornada dentro dos limites legais e da cobertura.' });
      }

      if (live) {
        const times = segments.map((seg, index) => `${segmentShiftName(dow, seg, index)} ${seg.start}–${seg.end}`).join(' · ');
        live.innerHTML = `
          <div class="live-card ${tone}">
            <div class="live-card-head"><span class="live-card-label">Jornada líquida do dia</span><span class="live-card-value">${dailyNet ? formatDuration(dailyNet) : '—'}</span></div>
            <p class="live-card-sub">${escapeHTML(times)} · presença de <strong>${dailySpan ? formatDuration(dailySpan) : '—'}</strong> · intervalo de <strong>${dailyBreak}min</strong> · total semanal após salvar: <strong>${formatDuration(weekAfter)}</strong> de 42h</p>
            <div class="inline-alerts">${alerts.map((alert) => `<div class="inline-alert ${alert.tone}">${icon(alert.tone === 'is-ok' ? 'check' : 'alert')} ${escapeHTML(alert.text)}</div>`).join('')}</div>
          </div>`;
      }
    };

    modal.querySelectorAll('[data-shift-status]').forEach((button) => {
      button.addEventListener('click', () => setStatus(button.dataset.shiftStatus));
    });
    modal.querySelectorAll('[data-shift-option]').forEach((button) => {
      button.addEventListener('click', () => {
        if (statusInput.value !== 'work') setStatus('work');
        applyShift(button.dataset.shiftOption);
      });
    });
    modal.querySelectorAll('[data-preset-start]').forEach((button) => {
      button.addEventListener('click', () => {
        if (statusInput.value !== 'work') setStatus('work');
        if (startInput) startInput.value = button.dataset.presetStart;
        if (endInput) endInput.value = button.dataset.presetEnd;
        if (breakInput) breakInput.value = button.dataset.presetBreak;
        setShiftButtons(button.dataset.presetShift || 'custom');
        update();
      });
    });
    [startInput, endInput, breakInput].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        if (shiftInput && shiftInput.value !== 'custom') setShiftButtons('custom');
        update();
      });
    });
    segmentEditors.forEach((node) => {
      node.querySelectorAll('input').forEach((input) => input.addEventListener('input', update));
    });
    form.addEventListener('input', () => errorBox?.classList.remove('is-visible'));
    update();
  }

  function saveShiftFromForm(form) {
    const empId = form.dataset.empId;
    const date = form.dataset.date;
    const emp = findEmployee(empId);
    if (!emp || !date) return;
    if (dayOfWeekISO(date) === 6 && prefersSaturdayOff(emp)) {
      setEntry(date, emp.id, { status: 'off' });
      closeModal();
      renderAll();
      showToast(`${emp.name.split(' ')[0]} tem sábado como folga preferida: o dia foi mantido como folga.`, 'error');
      return;
    }
    const errorBox = form.querySelector('[data-form-error]');
    const status = form.querySelector('[name="status"]')?.value || 'off';
    if (status === 'off') {
      setEntry(date, emp.id, { status: 'off' });
      closeModal();
      renderAll();
      showToast(`Folga de ${emp.name.split(' ')[0]} atualizada.`);
      return;
    }
    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.classList.add('is-visible');
    };
    const editorNodes = Array.from(form.querySelectorAll('[data-segment-editor]'));
    if (editorNodes.length > 1) {
      const segments = editorNodes.map((node, index) => {
        const id = String(node.dataset.segmentId || '');
        return {
          id: SHIFT_IDS.includes(id) ? id : '',
          start: node.querySelector('[data-seg-start]')?.value || '',
          end: node.querySelector('[data-seg-end]')?.value || '',
          breakMinutes: clamp(Number(node.querySelector('[data-seg-break]')?.value) || 0, 0, 240)
        };
      });
      if (segments.some((seg) => segmentSpanMinutes(seg) <= 0)) {
        showError('Informe entrada e saída válidas em todos os turnos.');
        return;
      }
      if (segments.some((seg) => seg.breakMinutes >= segmentSpanMinutes(seg))) {
        showError('O intervalo precisa ser menor que a jornada do turno.');
        return;
      }
      setEntry(date, emp.id, { status: 'work', segments, shift: 'full' });
      closeModal();
      renderAll();
      showToast(`Jornada de ${emp.name.split(' ')[0]} atualizada nos dois turnos.`);
      return;
    }
    const start = form.querySelector('[name="start"]')?.value;
    const end = form.querySelector('[name="end"]')?.value;
    const breakMinutes = clamp(Number(form.querySelector('[name="break"]')?.value) || 0, 0, 240);
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      showError('Informe uma entrada e uma saída válidas. A saída precisa ser depois da entrada.');
      return;
    }
    if (breakMinutes >= endMin - startMin) {
      showError('O intervalo precisa ser menor que a jornada.');
      return;
    }
    const shift = String(form.querySelector('[name="shift"]')?.value || '') || inferShiftId(dayOfWeekISO(date), { status: 'work', start, end });
    setEntry(date, emp.id, { status: 'work', start, end, breakMinutes, shift });
    closeModal();
    renderAll();
    showToast(`Jornada de ${emp.name.split(' ')[0]} atualizada.`);
  }

  /* =========================================================
     Modal de colaborador
     ========================================================= */
  function openEmployeeModal(empId = null) {
    const editing = empId ? findEmployee(empId) : null;
    const configDefaults = employeeShiftDefaults();
    const emp = editing || {
      name: '', role: 'Barbeiro(a)', weeklyHours: LEGAL.weeklyMinutes / 60, preferredOff: '',
      preferredShifts: [], defaultShifts: cloneShiftDefaults(configDefaults), active: true
    };
    const personalDefaults = {
      morning: { ...configDefaults.morning, ...(emp.defaultShifts?.morning || {}) },
      afternoon: { ...configDefaults.afternoon, ...(emp.defaultShifts?.afternoon || {}) }
    };
    const preferred = Array.isArray(emp.preferredShifts) ? emp.preferredShifts : [];
    const offOptions = [
      ['', 'Sem preferência'],
      ['1', 'Segunda-feira'], ['2', 'Terça-feira'], ['3', 'Quarta-feira'],
      ['4', 'Quinta-feira'], ['5', 'Sexta-feira'], ['6', 'Sábado (nunca escalado)']
    ].map(([value, label]) => `<option value="${value}" ${emp.preferredOff === value ? 'selected' : ''}>${label}</option>`).join('');
    const shiftPreferences = [
      ['morning', 'Manhã', 'Prioridade para o turno da manhã'],
      ['afternoon', 'Tarde', 'Prioridade para o turno da tarde']
    ].map(([value, label, hint]) => `
      <label class="check-row">
        <input type="checkbox" name="preferredShifts" value="${value}" ${preferred.includes(value) ? 'checked' : ''}>
        <span><strong>${label}</strong><span>${hint}</span></span>
      </label>`).join('');
    const shiftGroup = (id, label, hint) => {
      const def = personalDefaults[id];
      return `
        <div class="employee-shift-group">
          <div class="employee-shift-group-head">
            <span class="shift-dot is-${id}"></span>
            <div><strong>${label}</strong><small>${hint}</small></div>
          </div>
          <div class="employee-shift-grid">
            <label class="field"><span>Entrada</span><input type="time" name="${id}Start" value="${escapeHTML(def.start)}"></label>
            <label class="field"><span>Saída</span><input type="time" name="${id}End" value="${escapeHTML(def.end)}"></label>
            <label class="field"><span>Intervalo</span><div class="input-suffix"><input type="number" name="${id}Break" min="0" max="240" step="5" value="${Number(def.breakMinutes) || 0}"><span>min</span></div></label>
          </div>
        </div>`;
    };

    openModal({
      eyebrow: editing ? 'Editar colaborador' : 'Nova pessoa na equipe',
      title: editing ? 'Dados do colaborador' : 'Adicionar colaborador',
      subtitle: 'A carga semanal, as preferências e os padrões de cada turno alimentam a geração automática.',
      size: 'lg',
      body: `
        <form id="employee-form" novalidate data-id="${editing ? escapeHTML(editing.id) : ''}">
          <div class="form-grid">
            <label class="field span-2"><span>Nome completo</span><input type="text" name="name" maxlength="80" value="${escapeHTML(emp.name)}" placeholder="Ex.: Ana Martins" required data-autofocus></label>
            <label class="field"><span>Cargo</span><input type="text" name="role" maxlength="60" value="${escapeHTML(emp.role || '')}" placeholder="Barbeiro(a)"></label>
            <label class="field"><span>Carga semanal</span><div class="input-suffix"><input type="number" name="weeklyHours" min="1" max="${LEGAL.weeklyMinutes / 60}" step="0.5" value="${Number(emp.weeklyHours) || 24}"><span>h</span></div></label>
            <label class="field"><span>Folga preferida</span><select name="preferredOff">${offOptions}</select></label>
          </div>
          <div class="field shift-preference-field">
            <span>Turnos preferidos</span>
            <div class="shift-pref-grid">${shiftPreferences}</div>
            <span class="field-hint">É possível marcar os dois turnos. A preferência é usada na geração e como atalho na edição do dia.</span>
          </div>
          <div class="employee-shift-defaults">
            <div class="employee-shift-defaults-head">
              <strong>Padrões por turno</strong>
              <span>Horários e intervalo usados como ponto de partida para esta pessoa.</span>
            </div>
            <div class="employee-shift-groups">
              ${shiftGroup('morning', 'Turno da manhã', 'Segunda a sexta e sábado')}
              ${shiftGroup('afternoon', 'Turno da tarde', 'Segunda a sexta')}
            </div>
          </div>
          <label class="switch-row" style="margin-top:14px"><input type="checkbox" name="active" ${emp.active !== false ? 'checked' : ''}><span class="switch-copy"><strong>Colaborador ativo</strong><span>Pessoas inativas não entram na escala nem nos relatórios, mas seus dados são preservados.</span></span></label>
          <div class="form-note">${icon('info')} A carga semanal máxima permitida é 42h. Quem marca <strong>sábado</strong> como folga preferida fica fora de todos os sábados, não ganha folga compensatória em dia útil (descansa sábado e domingo) e a grade é recalculada ao salvar. Nos demais dias, folga e turnos preferidos são prioridades, não garantias: a cobertura mínima da loja vem primeiro.</div>
          <div class="form-error" data-form-error></div>
        </form>`,
      footer: `
        ${editing ? `<div class="footer-left"><button class="btn btn-quiet" type="button" data-action="delete-employee" data-id="${escapeHTML(editing.id)}">${icon('trash')} Excluir</button></div>` : ''}
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" type="submit" form="employee-form">${editing ? 'Salvar alterações' : 'Adicionar à equipe'}</button>`
    });
  }

  function saveEmployeeFromForm(form) {
    const errorBox = form.querySelector('[data-form-error]');
    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.classList.add('is-visible');
    };
    const name = String(form.querySelector('[name="name"]')?.value || '').trim();
    const role = String(form.querySelector('[name="role"]')?.value || '').trim();
    const weeklyHours = Number(form.querySelector('[name="weeklyHours"]')?.value);
    const preferredOff = String(form.querySelector('[name="preferredOff"]')?.value || '');
    const preferredShifts = [...form.querySelectorAll('[name="preferredShifts"]:checked')]
      .map((input) => String(input.value))
      .filter((value) => ['morning', 'afternoon'].includes(value));
    const active = Boolean(form.querySelector('[name="active"]')?.checked);
    const defaultShifts = {};

    if (!name) return showError('Informe o nome do colaborador.');
    if (!Number.isFinite(weeklyHours) || weeklyHours < 1 || weeklyHours > LEGAL.weeklyMinutes / 60) {
      return showError('A carga semanal deve ficar entre 1h e 42h.');
    }
    for (const shiftId of ['morning', 'afternoon']) {
      const label = SHIFT_LABELS[shiftId];
      const start = String(form.querySelector(`[name="${shiftId}Start"]`)?.value || '');
      const end = String(form.querySelector(`[name="${shiftId}End"]`)?.value || '');
      const breakMinutes = clamp(Number(form.querySelector(`[name="${shiftId}Break"]`)?.value) || 0, 0, 240);
      if (!isValidTime(start) || !isValidTime(end) || timeToMinutes(end) <= timeToMinutes(start)) {
        return showError(`No turno da ${label.toLowerCase()}, a saída precisa ser posterior à entrada.`);
      }
      if (breakMinutes >= timeToMinutes(end) - timeToMinutes(start)) {
        return showError(`No turno da ${label.toLowerCase()}, o intervalo não pode ser maior ou igual à jornada.`);
      }
      defaultShifts[shiftId] = { start, end, breakMinutes };
    }

    const editingId = form.dataset.id;
    const editing = editingId ? findEmployee(editingId) : null;
    const data = {
      name, role, weeklyHours: Math.round(weeklyHours * 2) / 2, preferredOff,
      preferredShifts, defaultShifts,
      // Campos legados mantidos para compatibilidade com backups antigos.
      defaultStart: defaultShifts.morning.start,
      defaultEnd: defaultShifts.morning.end,
      breakMinutes: defaultShifts.morning.breakMinutes,
      active
    };

    if (editing) {
      const wasActive = editing.active;
      Object.assign(editing, data);
      let clearedSaturdays = 0;
      if (prefersSaturdayOff(editing)) {
        clearedSaturdays = clearSaturdayAssignments(editing.id);
        // Recalcula as semanas existentes para devolver um dia útil de trabalho
        // a quem deixou de trabalhar aos sábados, preservando edições manuais.
        for (const weekStart of Object.keys(state.weeks)) {
          generateWeek(weekStart, { preserve: true, persist: false });
        }
      }
      if (!wasActive && active) {
        ensureMonthScheduled(monthKey(ui.weekStart), { force: true, preserve: true, persist: false });
      }
      saveState();
      closeModal();
      renderAll();
      showToast(clearedSaturdays
        ? `Dados atualizados. ${pluralize(clearedSaturdays, 'sábado removido', 'sábados removidos')} da grade.`
        : 'Dados do colaborador atualizados.');
      return;
    }

    const newEmployee = {
      id: uid('emp'),
      ...data,
      color: COLORS[state.employees.length % COLORS.length],
      order: state.employees.length ? Math.max(...state.employees.map((item) => item.order || 0)) + 1 : 0,
      createdAt: new Date().toISOString()
    };
    state.employees.push(newEmployee);
    ensureMonthScheduled(monthKey(ui.weekStart), { force: true, preserve: true, persist: false });
    saveState();
    closeModal();
    renderAll();
    showToast('Colaborador adicionado e escala do mês atualizada.');
  }

  function deleteEmployee(empId) {
    const emp = findEmployee(empId);
    if (!emp) return;
    openConfirm({
      title: 'Excluir colaborador?',
      message: `${emp.name} será removido da equipe e de todas as semanas. Essa ação não pode ser desfeita. Se quiser apenas tirar da escala, desative o cadastro.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm() {
        state.employees = state.employees.filter((item) => item.id !== empId);
        for (const week of Object.values(state.weeks)) {
          for (const entries of Object.values(week.days || {})) delete entries[empId];
        }
        ensureMonthScheduled(monthKey(ui.weekStart), { force: true, preserve: true, persist: false });
        saveState();
        renderAll();
        showToast('Colaborador excluído.');
      }
    });
  }

  /* =========================================================
     Modal de geração
     ========================================================= */
  function openGenerateModal() {
    const weekScope = formatWeekRange(ui.weekStart);
    const targetMonth = ui.view === 'reports' ? ui.reportMonth : monthKey(ui.weekStart);
    const monthScope = monthLabel(targetMonth);
    openModal({
      eyebrow: 'Montagem automática',
      title: 'Gerar escala 5x2',
      subtitle: 'A rotina distribui 5 dias de trabalho e 2 folgas, escala manhã e tarde, limita a jornada a 42h semanais e ajusta os horários da grade.',
      body: `
        <form id="generate-form" novalidate data-month="${targetMonth}">
          <div class="generate-scope">
            <label class="scope-option">
              <input type="radio" name="scope" value="week" checked>
              <span class="scope-copy"><strong>Esta semana</strong><span>${escapeHTML(weekScope)}</span></span>
            </label>
            <label class="scope-option">
              <input type="radio" name="scope" value="month">
              <span class="scope-copy"><strong>Todo o mês</strong><span>${escapeHTML(monthScope)} · semanas ainda não geradas também serão criadas</span></span>
            </label>
          </div>
          <label class="check-row">
            <input type="checkbox" name="preserve" checked>
            <span><strong>Preservar edições manuais</strong><span>Dias ajustados individualmente continuam como estão.</span></span>
          </label>
          <div class="form-note">${icon('info')} A geração substitui apenas os dias automáticos. No sábado, a cobertura nunca fica abaixo do mínimo configurado menos uma pessoa (ex.: mínimo 4 → pelo menos 3); se faltarem pessoas, o checklist aponta o que não foi possível cobrir. Depois de gerar, ele também mostra conflitos de horas e folgas.</div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" type="submit" form="generate-form">${icon('sparkles')} Gerar escala</button>`
    });
  }

  function runGeneration(form) {
    const scope = form.querySelector('[name="scope"]:checked')?.value || 'week';
    const preserve = Boolean(form.querySelector('[name="preserve"]')?.checked);
    const targetMonth = form.dataset.month || monthKey(ui.weekStart);
    enforceSaturdayPreferences();
    if (scope === 'week') {
      generateWeek(ui.weekStart, { preserve });
      saveState();
      closeModal();
      renderAll();
      showToast('Escala gerada com 5 dias, 2 folgas e jornada limitada a 42h.');
    } else {
      ensureMonthScheduled(targetMonth, { force: true, preserve, persist: false });
      saveState();
      closeModal();
      renderAll();
      showToast(`Escala de ${monthLabel(targetMonth)} gerada.`);
    }
  }

  /* =========================================================
     Exportação e pendências
     ========================================================= */
  function openExportModal() {
    openModal({
      eyebrow: 'Arquivos e impressão',
      title: 'Exportar',
      subtitle: 'Leve a escala para o Excel, compartilhe com a equipe ou guarde um backup.',
      body: `
        <div class="export-list">
          <button class="export-option" type="button" data-action="export-week-csv">
            <span class="export-option-icon">${icon('calendar')}</span>
            <span class="export-option-copy"><strong>Escala da semana</strong><span>CSV detalhado · ${escapeHTML(formatWeekRange(ui.weekStart))}</span></span>
            ${icon('download')}
          </button>
          <button class="export-option" type="button" data-action="export-month-csv">
            <span class="export-option-icon">${icon('chart')}</span>
            <span class="export-option-copy"><strong>Relatório mensal</strong><span>CSV com horas, folgas e sábados · ${escapeHTML(monthLabel(ui.reportMonth))}</span></span>
            ${icon('download')}
          </button>
          <button class="export-option" type="button" data-action="export-backup">
            <span class="export-option-icon">${icon('lock')}</span>
            <span class="export-option-copy"><strong>Backup completo</strong><span>JSON com equipe, regras e todas as semanas</span></span>
            ${icon('download')}
          </button>
          <button class="export-option" type="button" data-action="print-report">
            <span class="export-option-icon">${icon('printer')}</span>
            <span class="export-option-copy"><strong>Imprimir relatório mensal</strong><span>Versão em PDF pela impressão do navegador</span></span>
            ${icon('arrow-right')}
          </button>
        </div>`
    });
  }

  function openIssuesModal() {
    const analysis = analyzeWeek(ui.weekStart);
    const issues = analysis.issues.slice().sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return 0;
    });
    const renderIssue = (issue) => `
      <div class="issue-item ${issue.severity === 'error' ? 'is-error' : 'is-warn'}">
        <span class="issue-icon">${icon('alert')}</span>
        <div class="issue-copy"><strong>${escapeHTML(issue.title)}</strong><p>${escapeHTML(issue.detail)}</p></div>
        <span class="issue-tag">${issue.severity === 'error' ? 'Erro' : 'Aviso'}</span>
      </div>`;
    const errors = issues.filter((item) => item.severity === 'error');
    const warnings = issues.filter((item) => item.severity === 'warn');
    let content = '';
    if (!issues.length) {
      content = `
        <div class="empty-state" style="min-height:220px">
          <div class="empty-icon" style="color:var(--ok);background:var(--ok-soft)">${icon('check')}</div>
          <h3>Sem pendências nesta semana</h3>
          <p>Limite de 42h semanais e ${formatDuration(dailyCapMinutes())} diárias, intervalos, 2 folgas, descanso de 11h e cobertura estão em conformidade.</p>
        </div>`;
    } else {
      content = `
        ${errors.length ? `<div class="issue-group-title">Corrigir agora</div><div class="issue-list">${errors.map(renderIssue).join('')}</div>` : ''}
        ${warnings.length ? `<div class="issue-group-title">Conferir</div><div class="issue-list">${warnings.map(renderIssue).join('')}</div>` : ''}`;
    }
    openModal({
      eyebrow: `Semana de ${formatWeekRange(ui.weekStart)}`,
      title: issues.length ? 'Pendências da escala' : 'Tudo em ordem',
      subtitle: issues.length ? 'Clique em um dia na grade para corrigir os pontos abaixo.' : 'Nenhum conflito legal ou operacional foi encontrado.',
      size: 'lg',
      body: content,
      footer: `<button class="btn btn-primary" type="button" data-close-modal>Entendi</button>`
    });
  }

  function csvEscape(value) {
    let text = String(value ?? '');
    const numeric = typeof value === 'number' || /^-?\d+([.,]\d+)?$/.test(text);
    if (!numeric && /^[=+\-@]/.test(text)) text = `'${text}`;
    if (/[";\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function toCSV(rows) {
    return `\ufeff${rows.map((row) => row.map(csvEscape).join(';')).join('\r\n')}`;
  }

  function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportWeekCSV(weekStart) {
    ensureWeekScheduled(weekStart, { persist: false });
    const dates = getWeekDates(weekStart);
    const rows = [[
      'Colaborador', 'Cargo', 'Data', 'Dia', 'Status', 'Turno', 'Entrada', 'Saída',
      'Intervalo (min)', 'Horas líquidas', 'Horas decimais'
    ]];
    for (const emp of activeEmployees()) {
      for (const date of dates) {
        const entry = getEntry(weekStart, date, emp.id);
        const dow = dayOfWeekISO(date);
        const work = entry?.status === 'work';
        const segments = work ? entrySegments(entry) : [];
        if (!segments.length) {
          rows.push([
            emp.name, emp.role || '', formatDateBR(date), DAY_FULL[dow],
            'Folga', '', '', '', '', '0h', '0,00'
          ]);
          continue;
        }
        segments.forEach((seg, index) => {
          const minutes = segmentNetMinutes(seg);
          rows.push([
            emp.name, emp.role || '', formatDateBR(date), DAY_FULL[dow],
            'Trabalho', segmentShiftName(dow, seg, index), seg.start, seg.end,
            seg.breakMinutes, formatDuration(minutes), formatDecimalHours(minutes)
          ]);
        });
      }
    }
    rows.push([]);
    rows.push(['Resumo da semana']);
    rows.push(['Colaborador', 'Horas na semana', 'Meta semanal', 'Folgas', 'Sábado trabalhado']);
    for (const emp of activeEmployees()) {
      const stats = getEmployeeWeekStats(emp.id, weekStart);
      rows.push([emp.name, formatDuration(stats.minutes), `${emp.weeklyHours}h`, stats.offDays, stats.saturdayWorked ? 'Sim' : 'Não']);
    }
    rows.push([]);
    rows.push(['Limite legal semanal', '42h', 'Teto diário', formatDuration(dailyCapMinutes())]);
    rows.push(['Domingo', 'Fechado']);
    downloadFile(`escala-semana-${weekStart}.csv`, toCSV(rows));
    showToast('CSV da semana gerado.');
  }

  function exportMonthCSV(month) {
    ensureMonthScheduled(month, { preserve: true });
    const weeks = weeksForMonth(month);
    const analysis = analyzeMonth(month);
    const rows = [];
    const header = ['Colaborador', 'Cargo', 'Horas no mês (h)', 'Referência mensal (h)', 'Diferença (h)'];
    weeks.forEach((weekStart, index) => header.push(`Semana ${index + 1} (${formatShortDate(weekStart)})`));
    header.push('Folgas', 'Sábados trabalhados', 'Status');
    rows.push(header);
    for (const emp of activeEmployees()) {
      const stats = getEmployeeMonthStats(emp, month, weeks, analysis);
      const status = stats.status === 'danger' ? 'Revisar' : stats.status === 'warn' ? 'Verificar' : 'OK';
      const row = [
        emp.name, emp.role || '', formatDecimalHours(stats.total), formatDecimalHours(stats.reference),
        formatDecimalHours(stats.balance)
      ];
      stats.weekMinutes.forEach((minutes) => row.push(formatDecimalHours(minutes)));
      row.push(stats.offDays, stats.saturdays, status);
      rows.push(row);
    }
    rows.push([]);
    rows.push([`Relatório de ${monthLabel(month)}`]);
    rows.push(['Referência mensal = carga semanal × 52 ÷ 12. Horas líquidas, com intervalo descontado.']);
    rows.push(['Segunda a sexta: dois turnos (manhã e tarde). Sábado pela manhã. Domingo fechado. A escala 5x2 considera 5 dias de trabalho e 2 folgas por semana.']);
    downloadFile(`relatorio-mensal-${month}.csv`, toCSV(rows));
    showToast('Relatório mensal gerado.');
  }

  function exportBackup() {
    const payload = {
      app: 'Escala 5x2',
      exportedAt: new Date().toISOString(),
      data: state
    };
    downloadFile(`escala-5x2-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    showToast('Backup completo gerado.');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const candidate = parsed?.data || parsed;
        if (!candidate || !Array.isArray(candidate.employees) || !candidate.weeks || !candidate.settings) {
          throw new Error('Formato inválido');
        }
        openConfirm({
          title: 'Restaurar este backup?',
          message: `O arquivo tem ${candidate.employees.length} colaboradores e ${Object.keys(candidate.weeks).length} semanas salvas. Os dados atuais serão substituídos.`,
          confirmLabel: 'Restaurar',
          danger: true,
          onConfirm() {
            state = normalizeState(parsed);
            state.meta.initialized = true;
            enforceSaturdayPreferences();
            ui.weekStart = startOfWeekISO(todayISO());
            ui.reportMonth = currentMonthKey();
            ensureWeekScheduled(ui.weekStart, { persist: false });
            ensureMonthScheduled(ui.reportMonth, { persist: false });
            saveState();
            renderAll();
            showToast('Backup restaurado com sucesso.');
          }
        });
      } catch (error) {
        showToast('Arquivo inválido. Selecione um backup do Escala 5x2.', 'error');
      } finally {
        const input = document.querySelector('[data-import-input]');
        if (input) input.value = '';
      }
    };
    reader.readAsText(file);
  }

  /* =========================================================
     Navegação e renderização geral
     ========================================================= */
  function renderAll() {
    renderShell();
    if (ui.view === 'schedule') renderSchedule();
    else if (ui.view === 'team') renderTeam();
    else if (ui.view === 'reports') renderReport();
    else if (ui.view === 'rules') renderRules();
  }

  function setView(view) {
    if (!['schedule', 'team', 'reports', 'rules'].includes(view)) return;
    ui.view = view;
    if (view === 'schedule') ensureWeekScheduled(ui.weekStart);
    if (view === 'reports') ensureMonthScheduled(ui.reportMonth, { preserve: true });
    if (view === 'team') ensureMonthScheduled(currentMonthKey(), { preserve: true });
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetScheduleScroll() {
    const scroll = document.getElementById('schedule-scroll');
    if (scroll) scroll.scrollLeft = 0;
  }

  function changeWeek(amount) {
    ui.weekStart = addDaysISO(ui.weekStart, amount * 7);
    ensureWeekScheduled(ui.weekStart);
    renderAll();
    resetScheduleScroll();
  }

  function changeMonth(amount) {
    ui.reportMonth = addMonths(ui.reportMonth, amount);
    ensureMonthScheduled(ui.reportMonth, { preserve: true });
    renderAll();
  }

  function printReport() {
    if (ui.view !== 'reports') {
      ui.view = 'reports';
      ensureMonthScheduled(ui.reportMonth, { preserve: true });
      renderAll();
    }
    window.setTimeout(() => window.print(), 120);
  }

  function printSchedule() {
    if (ui.view !== 'schedule') {
      ui.view = 'schedule';
      renderAll();
    }
    ensureWeekScheduled(ui.weekStart);
    const company = document.getElementById('print-schedule-company');
    const range = document.getElementById('print-schedule-range');
    if (company) company.textContent = state.company?.name || 'Escala 5x2';
    if (range) range.textContent = formatWeekRange(ui.weekStart);
    document.body.classList.add('print-schedule');
    window.setTimeout(() => window.print(), 120);
  }

  function handleSettingsSubmit(form) {
    const name = String(form.querySelector('[name="companyName"]')?.value || '').trim();
    const unit = String(form.querySelector('[name="companyUnit"]')?.value || '').trim();
    if (!name) {
      showToast('Informe o nome da empresa.', 'error');
      return;
    }
    const weekdays = { ...state.settings.weekdays, 0: { ...state.settings.weekdays[0], open: false, shifts: [] } };
    const defaults = defaultWeekdays();
    const invalidHours = [];

    for (let day = 1; day <= 5; day++) {
      const open = Boolean(form.querySelector(`[data-day-open="${day}"]`)?.checked);
      const shiftDefs = weekdays[String(day)]?.shifts?.length ? weekdays[String(day)].shifts : defaults[String(day)].shifts;
      const shifts = shiftDefs.map((shift) => {
        const start = form.querySelector(`[data-shift-start="${day}"][data-shift-id="${shift.id}"]`)?.value || shift.start;
        const end = form.querySelector(`[data-shift-end="${day}"][data-shift-id="${shift.id}"]`)?.value || shift.end;
        const minStaff = clamp(Number(form.querySelector(`[data-shift-min="${day}"][data-shift-id="${shift.id}"]`)?.value) || 0, 0, 99);
        if (open && (!isValidTime(start) || !isValidTime(end) || timeToMinutes(end) <= timeToMinutes(start))) {
          invalidHours.push(`${DAY_FULL[day].replace('-feira', '')} · ${shift.label}`);
        }
        return { ...shift, start, end, minStaff, breakMinutes: defaultShiftBreak(start, end) };
      });
      weekdays[String(day)] = {
        open,
        start: shifts.reduce((min, shift) => (timeToMinutes(shift.start) < timeToMinutes(min) ? shift.start : min), shifts[0].start),
        end: shifts.reduce((max, shift) => (timeToMinutes(shift.end) > timeToMinutes(max) ? shift.end : max), shifts[0].end),
        minStaff: shifts.reduce((sum, shift) => sum + shift.minStaff, 0),
        shifts
      };
    }

    const saturdayOpen = Boolean(form.querySelector('[data-day-open="6"]')?.checked);
    const saturdayStart = form.querySelector('[data-day-start="6"]')?.value || '08:00';
    const saturdayEnd = form.querySelector('[data-day-end="6"]')?.value || '12:00';
    const saturdayMin = clamp(Number(form.querySelector('[data-day-min="6"]')?.value) || 0, 0, 99);
    if (saturdayOpen && (!isValidTime(saturdayStart) || !isValidTime(saturdayEnd) || timeToMinutes(saturdayEnd) <= timeToMinutes(saturdayStart))) {
      invalidHours.push('Sábado');
    }
    if (invalidHours.length) {
      showToast(`Confira o horário de ${invalidHours.join('; ')}.`, 'error');
      return;
    }
    weekdays['6'] = {
      open: saturdayOpen,
      start: saturdayStart,
      end: saturdayEnd,
      minStaff: saturdayOpen ? saturdayMin : 0,
      shifts: saturdayOpen ? [makeShift('saturday', SHIFT_LABELS.saturday, saturdayStart, saturdayEnd, saturdayMin)] : []
    };
    state.company = { name, unit };
    state.settings.weekdays = weekdays;
    state.settings.auto = {
      ...state.settings.auto,
      honorPreferences: Boolean(form.querySelector('[name="honorPreferences"]')?.checked)
    };
    saveState();
    renderAll();
    showToast('Regras salvas. Gere a escala novamente para aplicar os novos horários.');
  }

  function handleClick(event) {
    const nav = event.target.closest('[data-nav-view]');
    if (nav) {
      event.preventDefault();
      setView(nav.dataset.navView);
      return;
    }
    if (event.target.closest('[data-close-modal]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'go-schedule':
        event.preventDefault();
        setView('schedule');
        break;
      case 'prev-week':
        changeWeek(-1);
        break;
      case 'next-week':
        changeWeek(1);
        break;
      case 'this-week':
        ui.weekStart = startOfWeekISO(todayISO());
        ensureWeekScheduled(ui.weekStart);
        ui.view = 'schedule';
        renderAll();
        resetScheduleScroll();
        break;
      case 'print-schedule':
        printSchedule();
        break;
      case 'prev-month':
        changeMonth(-1);
        break;
      case 'next-month':
        changeMonth(1);
        break;
      case 'this-month':
        ui.reportMonth = currentMonthKey();
        ensureMonthScheduled(ui.reportMonth, { preserve: true });
        renderAll();
        break;
      case 'open-generate':
        openGenerateModal();
        break;
      case 'open-export':
        openExportModal();
        break;
      case 'add-employee':
        openEmployeeModal();
        break;
      case 'edit-employee':
        openEmployeeModal(actionEl.dataset.id);
        break;
      case 'edit-shift':
        openShiftModal(actionEl.dataset.emp, actionEl.dataset.date);
        break;
      case 'show-issues':
        openIssuesModal();
        break;
      case 'delete-employee':
        if (activeModal) closeModal({ restoreFocus: false });
        deleteEmployee(actionEl.dataset.id);
        break;
      case 'export-week-csv':
        closeModal();
        exportWeekCSV(ui.weekStart);
        break;
      case 'export-month-csv':
        closeModal();
        exportMonthCSV(ui.reportMonth);
        break;
      case 'export-backup':
        closeModal();
        exportBackup();
        break;
      case 'import-backup':
        document.querySelector('[data-import-input]')?.click();
        break;
      case 'print-report':
        closeModal();
        printReport();
        break;
      case 'reset-data':
        openConfirm({
          title: 'Restaurar dados de exemplo?',
          message: 'Todos os colaboradores, regras e escalas atuais serão substituídos pela equipe de exemplo com 8 pessoas. Exporte um backup antes se precisar guardar o que já existe.',
          confirmLabel: 'Restaurar exemplo',
          danger: true,
          onConfirm() {
            state = createDefaultState();
            state.meta.initialized = true;
            ui = { view: 'schedule', weekStart: startOfWeekISO(todayISO()), reportMonth: currentMonthKey() };
            ensureMonthScheduled(ui.reportMonth, { force: true, preserve: false, persist: false });
            ensureWeekScheduled(ui.weekStart, { preserve: false, persist: false });
            saveState();
            renderAll();
            showToast('Dados de exemplo restaurados.');
          }
        });
        break;
      default:
        break;
    }
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'shift-form') {
      event.preventDefault();
      saveShiftFromForm(form);
      return;
    }
    if (form.id === 'employee-form') {
      event.preventDefault();
      saveEmployeeFromForm(form);
      return;
    }
    if (form.id === 'generate-form') {
      event.preventDefault();
      runGeneration(form);
      return;
    }
    if (form.id === 'settings-form') {
      event.preventDefault();
      handleSettingsSubmit(form);
    }
  }

  function handleChange(event) {
    const toggle = event.target.closest('[data-day-open]');
    if (toggle) {
      const row = toggle.closest('.weekday-config-row');
      row?.querySelectorAll('input[type="time"], input[type="number"]').forEach((input) => {
        input.disabled = !toggle.checked;
      });
    }
    if (event.target.matches('[data-import-input]')) {
      const file = event.target.files?.[0];
      if (file) importBackup(file);
    }
  }

  function handleKeydown(event) {
    if (!activeModal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = activeModal.root.querySelector('.modal');
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function bindEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('afterprint', () => document.body.classList.remove('print-schedule'));
  }

  /* =========================================================
     Inicialização
     ========================================================= */
  function init() {
    state = loadState();
    if (enforceSaturdayPreferences()) saveState();
    ui = { view: 'schedule', weekStart: startOfWeekISO(todayISO()), reportMonth: currentMonthKey() };
    if (!state.meta.initialized) {
      state.meta.initialized = true;
      ensureMonthScheduled(ui.reportMonth, { force: true, preserve: false, persist: false });
      ensureWeekScheduled(ui.weekStart, { preserve: false, persist: false });
      saveState();
    } else {
      ensureWeekScheduled(ui.weekStart);
    }
    bindEvents();
    renderAll();
    resetScheduleScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
