import { LOCATIONS } from '../../core/core.generated.js';
import type { Location } from '../../core/core.generated.js';
import { scopedViews } from '../../data/scope.ts';
import { persisted } from '../../data/persisted.ts';
import { liveViews, personById, ready } from '../../data/store.ts';
import { applyFilters, facet } from '../../lib/filters.ts';
import type { Field, Filters } from '../../lib/filters.ts';
import { WEEKDAY_SHORT, weekdayShort } from '../../lib/format.ts';
import { GROUP_BYS, STATUS_LABEL, shiftStatus } from '../../lib/groups.ts';
import type { ShiftView } from '../../lib/stats.ts';
import { signal } from '@preact/signals';
import { EmptyPeriod, FirstShiftEmpty } from '../../ui/EmptyState.tsx';
import { FilterMenu } from '../../ui/FilterMenu.tsx';
import type { Facet } from '../../ui/FilterMenu.tsx';
import { ColumnMenu } from '../../ui/ColumnMenu.tsx';
import { ScopeControl } from '../../ui/ScopeControl.tsx';
import { SheetSearch } from '../../ui/SheetSearch.tsx';
import { Switcher } from '../../ui/Switcher.tsx';
import { TableTabs } from '../../ui/TableTabs.tsx';
import { tierOf, useWidth } from '../../ui/useWidth.ts';
import { isDesktop } from '../../ui/viewport.ts';
import { MiniMonth } from '../../parts/MiniMonth.tsx';
import { overviewParts } from './views/OverviewView.tsx';
import { payParts } from './views/PayView.tsx';
import { weeksParts } from './views/WeeksView.tsx';
import { timeParts } from './views/TimeView.tsx';
import { staffingParts } from './views/StaffingView.tsx';
import { SHEET_COLUMNS, sheetHidden, sheetParts } from './views/SheetView.tsx';
import { SHIFT_TABS, bandFocus, groupBy, setGroupBy, setSheetHiddenRaw, setShiftsView, setWeekRollup, shiftsView, weekRollup } from './views.ts';
import type { SheetCtx } from './views.ts';
import styles from './ShiftTable.module.css';

/* Shifts: one period, one search, six views of the same rows. Overview scans a shift. Pay says where the money
 * came from. Weeks compares periods. Time puts every shift on one clock. Staffing names who was on. Sheet is every fact. */
const query = signal('');
const filters = signal<Filters>({});
const SIDE_MIN = 16, SIDE_MAX = 36, SIDE_DEFAULT = 26;
const sideOk = (v: unknown): v is number => typeof v === 'number' && v >= SIDE_MIN && v <= SIDE_MAX;
const [sideRem, setSideRem] = persisted('split-w', sideOk, SIDE_DEFAULT);

const crewNames = (v: ShiftView) => v.crew.map(c => personById(c.staff_id)?.name ?? c.name).filter((n): n is string => !!n);
const stationsOf = (v: ShiftView): Location[] => {
  const have = new Set(v.crew.map(c => c.location).filter((s): s is Location => !!s));
  return LOCATIONS.filter(s => have.has(s));
};

const FIELDS: Record<string, { label: string; get: Field<ShiftView>; labels?: Record<string, string> }> = {
  type: { label: 'Type', get: v => v.shift.shift_type, labels: { day: 'Day', night: 'Night' } },
  weekday: { label: 'Weekday', get: v => weekdayShort(v.shift.date) },
  party: { label: 'Party', get: v => (v.shift.party ? 'yes' : 'no'), labels: { yes: 'Party', no: 'No party' } },
  status: { label: 'Status', get: shiftStatus, labels: STATUS_LABEL },
  crew: { label: 'Crew', get: crewNames },
  station: { label: 'Station', get: v => stationsOf(v) }
};

export function ShiftTable() {
  const [rem, widthRef] = useWidth<HTMLDivElement>();
  const tier = tierOf(rem);
  const view = shiftsView.value;
  const allShifts = liveViews.value;
  const views = scopedViews(allShifts);
  const q = query.value.trim().toLowerCase();
  const searched = q ? views.filter(v => [v.shift.notes, weekdayShort(v.shift.date), new Date(v.shift.date + 'T12:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' }), ...crewNames(v)]
    .some(t => t?.toLowerCase().includes(q))) : views;
  const fields = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.get]));
  const rows = applyFilters(searched, filters.value, fields);
  const facets: Facet[] = Object.entries(FIELDS).map(([key, f]) => ({
    key, label: f.label, options: facet(searched, f.get).map(o => ({ ...o, label: f.labels?.[o.value] }))
  }));
  facets.find(f => f.key === 'weekday')?.options.sort((a, b) => WEEKDAY_SHORT.indexOf(a.value) - WEEKDAY_SHORT.indexOf(b.value));

  const ctx: SheetCtx = { rows, all: views, by: groupBy.value, tier, rem };
  const parts = view === 'pay' ? payParts(ctx)
    : view === 'weeks' ? weeksParts(ctx)
    : view === 'time' ? timeParts(ctx)
    : view === 'staffing' ? staffingParts(ctx)
    : view === 'sheet' ? sheetParts(ctx)
    : overviewParts(ctx);

  const by = groupBy.value;
  const groupMark = by === 'month' ? 'Mo' : by === 'week' ? 'Wk' : undefined;
  const hidden = sheetHidden(tier);

  const body = !ready.value ? null
    : allShifts.length === 0
      ? <FirstShiftEmpty>Add the date, hours and tips. Everything saves on this device first, so it works with no signal.</FirstShiftEmpty>
      : views.length === 0
        ? <EmptyPeriod />
        : parts.table;

  return (
    <section class="panel fill" aria-label="Shifts">
      <div class="split" style={isDesktop.value && parts.side != null ? { gridTemplateColumns: `minmax(0, 1fr) ${sideRem.value}rem` } : undefined}>
        <div class="tabbed">
          <TableTabs label="Shifts view" value={view} onChange={setShiftsView} tabs={SHIFT_TABS}
            tools={<>
              <span class="sheet-count">{rows.length} of {views.length}</span>
              <SheetSearch id="shift-search" label="Search shifts" placeholder="Notes, crew, dates" value={query.value} onChange={v => { query.value = v; }} />
              <FilterMenu compact facets={facets} value={filters.value} onChange={f => { filters.value = f; }} />
              {view === 'sheet' && (
                <ColumnMenu icon options={SHEET_COLUMNS} hidden={hidden} onChange={next => setSheetHiddenRaw(next.length ? next.join(',') : '-')} />
              )}
              {view === 'weeks'
                ? <Switcher compact label="Roll up" icon="cards" value={weekRollup.value} choices={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} onChange={setWeekRollup} />
                : <Switcher compact label="Group" icon="cards" mark={groupMark} value={by} choices={GROUP_BYS.map(g => ({ value: g.id, label: g.id === 'none' ? 'None' : g.label }))} onChange={id => { bandFocus.value = null; setGroupBy(id); }} />}
              <ScopeControl compact />
            </>} />
          {tier === 'narrow' && parts.summary}
          <div ref={widthRef} class={`data-sheet ${styles.body} ${styles.sheet}`} data-view={view} data-tier={tier}>{body}</div>
        </div>
        {parts.side != null && (
          <aside class="panel-body side" aria-label="This period">
            {isDesktop.value && (
              <div class="split-resize" role="separator" aria-orientation="vertical" aria-label="Table width" aria-valuemin={SIDE_MIN} aria-valuemax={SIDE_MAX} aria-valuenow={sideRem.value} tabIndex={0}
                onPointerDown={e => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const x0 = e.clientX, w0 = sideRem.value;
                  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                  const move = (ev: PointerEvent) => setSideRem(Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w0 + (x0 - ev.clientX) / root)) * 4) / 4);
                  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
                  window.addEventListener('pointermove', move);
                  window.addEventListener('pointerup', up);
                }}
                onDblClick={() => setSideRem(SIDE_DEFAULT)}
                onKeyDown={e => {
                  const step = e.shiftKey ? 1 : 0.5;
                  if (e.key === 'ArrowLeft') setSideRem(Math.round(Math.min(SIDE_MAX, sideRem.value + step) * 2) / 2);
                  if (e.key === 'ArrowRight') setSideRem(Math.round(Math.max(SIDE_MIN, sideRem.value - step) * 2) / 2);
                  if (e.key === 'Home') setSideRem(SIDE_DEFAULT);
                }} />
            )}
            {parts.side}
            {isDesktop.value && views.length > 0 && <MiniMonth views={rows} title="Tips by day" figures="tips" />}
          </aside>
        )}
      </div>
    </section>
  );
}
