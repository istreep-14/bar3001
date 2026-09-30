import { personById, removeShift, undoRemove } from '../data/store.ts';
import type { ComponentChildren } from 'preact';
import { DASH, clockTight, dollars, fullDate, hoursBare } from '../lib/format.ts';
import { STATUS_LABEL, groupShifts, shiftStatus } from '../lib/groups.ts';
import type { GroupBy } from '../lib/groups.ts';
import { rateContext } from '../lib/stats.ts';
import type { RateContext, ShiftView } from '../lib/stats.ts';
import { closeSheet, openForm, openSheet } from '../router.ts';
import { OpenPill, PartyIcon } from '../ui/Badges.tsx';
import { ColumnMenu } from '../ui/ColumnMenu.tsx';
import { DayCell } from '../ui/DayCell.tsx';
import { Icon } from '../ui/Icon.tsx';
import { RateFigure } from '../ui/RateFigure.tsx';
import { toast } from '../ui/toast.tsx';
import { CrewPhotos } from './CrewPhotos.tsx';
import { ShiftDetails } from './ShiftDetails.tsx';
import styles from './ShiftLog.module.css';

/* The desktop Log, in the same one-line sheet as the Shift table. A band names the month or week once; the row says the
 * day, then the time on that same line. Tips, wage and other sit together and add up to Total; Rate follows, tips per hour
 * only. Opening a row turns it into the shift's lists in place (?shift=<id>, so Back closes it). The drawer stays shut here.
 * Every column but the day can be hidden. A shift short of its money reads muted, so the columns stay in line. */
const CREW_SHOWN = 6;   // up to six people standing in the row as one group picture, then +N; hovering names everyone

export type LogCol = 'type' | 'party' | 'hours' | 'tips' | 'rate' | 'wage' | 'other' | 'total' | 'crew';
/** The Log's columns after the day, in order, with their widths. */
export const LOG_COLUMNS: { key: LogCol; head: string; width: string; align?: 'r' | 'c' }[] = [
  { key: 'type', head: 'Type', width: '2.25rem', align: 'c' },
  { key: 'party', head: 'Party', width: '2.5rem', align: 'c' },
  { key: 'hours', head: 'Hours', width: '3.25rem', align: 'r' },
  { key: 'tips', head: 'Tips', width: '4.25rem', align: 'r' },
  { key: 'wage', head: 'Wage', width: '4rem', align: 'r' },
  { key: 'other', head: 'Other', width: '4rem', align: 'r' },
  { key: 'total', head: 'Total', width: '4.5rem', align: 'r' },
  { key: 'rate', head: 'Rate', width: '5.75rem', align: 'r' },
  { key: 'crew', head: 'Crew', width: 'minmax(8rem, 1fr)' }
];

/** `inline` = rows open into a card in place (the Log). Off, a row opens the drawer instead (the Dashboard's short list). */
/** `air` is the Log page's roomier sheet; the Dashboard's compact list leaves it off. */
/** `onHidden` puts the Columns menu in the head's right corner, to show and hide columns. */
export function ShiftLog({ views, by, openId, inline = true, hidden = [], onHidden, air, jumpDate }: { views: ShiftView[]; by: GroupBy; openId: string | null; inline?: boolean; hidden?: LogCol[]; onHidden?: (h: LogCol[]) => void; air?: boolean; jumpDate?: string | null }) {
  const groups = groupShifts(views, by);
  const grouped = by !== 'none';
  const ctx = rateContext(views);
  const cols = LOG_COLUMNS.filter(c => !hidden.includes(c.key));
  // Grid lines: the day is column 1, then the visible columns, then the chevron. The group heading's figures sit in theirs.
  const at = (k: LogCol) => { const i = cols.findIndex(c => c.key === k); return i < 0 ? null : i + 2; };
  const tipsAt = at('tips'), totalAt = at('total');
  const grid = { '--log-cols': `minmax(11rem, 1.4fr) ${cols.map(c => c.width).join(' ')} 1.5rem` };
  return (
    <div class={`${styles.log} ${air ? styles.air : ''}`} style={grid} onKeyDown={moveFocus}>
      <div class={`${styles.grid} ${styles.groups}`} aria-hidden="true">
        {columnBands(cols).map(b => <span key={b.label || 'end'} style={{ gridColumn: `span ${b.span}` }}>{b.label}</span>)}
      </div>
      <div class={`${styles.grid} ${styles.head}`}>
        <span aria-hidden="true">{grouped ? 'Day' : 'Shift'}</span>
        {cols.map(c => <span key={c.key} class={c.align} aria-hidden="true">{c.head}</span>)}
        <span class={styles.corner}>{onHidden && <ColumnMenu icon options={LOG_COLUMNS.map(c => ({ key: c.key, label: c.head }))} hidden={hidden} onChange={onHidden} />}</span>
      </div>
      {groups.map(g => (
        <div class={styles.group} key={g.key}>
          {grouped && (
            <div class={`${styles.grid} ${styles.band}`} role="heading" aria-level={3}>
              <span class={styles.bandLabel} style={{ gridColumn: `1 / ${tipsAt ?? totalAt ?? -1}` }}>
                <span class={styles.bandName}>{g.label}</span>
                <span class="chip num">{[g.done && `${g.done} ${g.done === 1 ? 'shift' : 'shifts'}`, g.worked && `${g.worked} awaiting tips`, g.scheduled && `${g.scheduled} upcoming`].filter(Boolean).join(' · ')}</span>
              </span>
              {tipsAt && <span class={`r num ${styles.bandTips}`} style={{ gridColumn: tipsAt }}>{g.done ? dollars(g.tips) : DASH}</span>}
              {totalAt && <span class={`r num ${styles.bandTotal}`} style={{ gridColumn: totalAt }}>{g.done ? dollars(g.total) : DASH}</span>}
            </div>
          )}
          <div class={styles.rows} role="list" aria-label={g.label || 'Shifts'}>
            {g.views.map(v => <Row key={v.shift.id} v={v} open={inline && openId === v.shift.id} selected={openId === v.shift.id} jump={jumpDate === v.shift.date} ctx={ctx} cols={cols} air={air} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ v, open, selected, jump, ctx, cols, air }: { v: ShiftView; open: boolean; selected: boolean; jump?: boolean; ctx: RateContext; cols: typeof LOG_COLUMNS; air?: boolean }) {
  const sh = v.shift, id = sh.id;
  const status = shiftStatus(v);
  const done = status === 'done';
  async function remove() {
    closeSheet();   // the card goes with the shift; Undo brings the row back closed
    const gone = await removeShift(id);
    if (gone) toast('Shift deleted', { label: 'Undo', run: () => void undoRemove(gone) });
  }
  const shown = v.crew.slice(0, CREW_SHOWN);
  const names = v.crew.map(c => personById(c.staff_id)?.name ?? c.name).filter(Boolean);
  const crewSays = names.length ? names.join(', ') + (v.crewCount > names.length ? ` and ${v.crewCount - names.length} more` : '') : undefined;
  const openShift = sh.start != null && sh.end == null;
  const time = sh.start != null && sh.end != null ? `${clockTight(sh.start)} → ${clockTight(sh.end)}`
    : sh.start != null ? clockTight(sh.start) : sh.end != null ? `→ ${clockTight(sh.end)}` : null;
  const timeLine = (time || openShift) ? (
    <span class={styles.times}>{time}{openShift && <OpenPill />}</span>
  ) : null;
  // The column heads are drawn for the eye only (the row is one button), so each figure carries its column's name for a
  // screen reader, and a shift short of its money says where it stands.
  const named = (label: string, figure: ComponentChildren) => <><span class="sr-only">{label} </span>{figure}</>;
  const cell: Record<LogCol, () => ComponentChildren> = {
    type: () => sh.shift_type && <span class={styles.type} data-kind={sh.shift_type}><Icon name={sh.shift_type === 'day' ? 'sun' : 'moon'} label={sh.shift_type === 'day' ? 'Day shift' : 'Night shift'} /></span>,
    party: () => sh.party && <PartyIcon />,
    hours: () => <span class={`num ${styles.hours} ${time ? 'tip' : ''}`} data-tip={time ? `${time}${v.hours != null ? ` · ${hoursBare(v.hours)}h worked` : ''}` : undefined}>{named('Hours', hoursBare(v.hours))}</span>,
    tips: () => <span class={`num ${done ? styles.tips : ''}`}>{done ? named('Tips', dollars(sh.tips)) : DASH}</span>,
    rate: () => (done && v.tph != null ? named('Rate', <RateFigure tph={v.tph} ctx={ctx} />) : DASH),
    wage: () => <span class={`num ${styles.quiet}`}>{done && v.wage != null ? named('Wage', dollars(v.wage)) : ''}</span>,
    other: () => <span class={`num ${styles.quiet}`}>{done && v.extra ? named('Other', dollars(v.extra)) : ''}</span>,
    total: () => (done ? named('Total', <Total v={v} />) : <span class="num">{DASH}</span>),
    crew: () => <>{v.crewCount > 0 && <CrewPhotos crew={shown} more={v.crewCount - shown.length} />}{crewSays && <span class="sr-only">{crewSays}</span>}</>
  };
  return (
    <div class={styles.item} data-open={open ? '' : undefined} data-selected={selected && !open ? '' : undefined} data-jump={jump ? '' : undefined} data-date={sh.date} data-status={status} role="listitem">
      <button type="button" class={`${styles.grid} ${styles.row}`} data-row aria-expanded={open} onClick={() => openSheet(id)} title={fullDate(sh.date)}>
        <span class={styles.when}>
          <DayCell date={sh.date} chip={air} sub={air ? timeLine : undefined} />
          {!air && timeLine}
          {!done && <span class="sr-only">, {STATUS_LABEL[status].toLowerCase()}</span>}
        </span>
        {cols.map(c => c.key === 'crew'
          ? <span key={c.key} class={`${styles.crew} ${crewSays ? 'tip' : ''}`} data-tip={crewSays}>{cell.crew()}</span>
          : <span key={c.key} class={c.align === 'c' ? styles.icon : c.align}>{cell[c.key]()}</span>)}
        <span class={styles.chev}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div class={styles.card}>
          <ShiftDetails v={v} layout="columns" onEdit={page => openForm(id, undefined, page)} />
          {sh._dirty && <p class={styles.sync}>Not synced yet. It will sync when you're online.</p>}
          <div class={styles.actions}>
            <button type="button" class="btn btn-primary" onClick={() => openForm(id)}><Icon name="edit" /> {status === 'worked' ? 'Add tips' : 'Edit shift'}</button>
            <span class={styles.spacer} />
            <button type="button" class="btn" onClick={() => void remove()}><Icon name="trash" /> Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tips, wage and other, named on hover. The opened row draws the mix; the closed row is the number. */
function Total({ v }: { v: ShiftView }) {
  const parts = [
    { label: 'Tips', amount: v.shift.tips ?? 0 },
    { label: 'Wage', amount: v.wage ?? 0 },
    { label: 'Other', amount: v.extra ?? 0 }
  ];
  const says = parts.filter(p => p.amount > 0).map(p => `${p.label} ${dollars(p.amount)}`).join('\n');
  return (
    <span class={`num ${styles.total} ${says ? 'tip' : ''}`} data-tip={says || undefined}>
      {dollars(v.total)}
      {says && <span class="sr-only">{says.replace(/\n/g, ', ')}</span>}
    </span>
  );
}

/** Category strip over the columns that are showing. Day is always first; the chevron is always last. */
function columnBands(cols: typeof LOG_COLUMNS): { label: string; span: number }[] {
  const groupOf = (k: string) => {
    if (k === 'day' || k === 'type' || k === 'party') return 'Shift';
    if (k === 'hours') return 'Time';
    if (k === 'tips' || k === 'wage' || k === 'other' || k === 'total') return 'Pay';
    if (k === 'rate') return 'Rate';
    if (k === 'crew') return 'Crew';
    return '';
  };
  const runs: { label: string; span: number }[] = [];
  for (const k of ['day', ...cols.map(c => c.key), 'chev']) {
    const label = groupOf(k);
    const last = runs[runs.length - 1];
    if (last && last.label === label) last.span++;
    else runs.push({ label, span: 1 });
  }
  return runs;
}

/** Up and Down walk the rows (buttons carrying data-row), across groups. */
function moveFocus(e: KeyboardEvent) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-row]')];
  const i = all.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  all[e.key === 'ArrowDown' ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
}
