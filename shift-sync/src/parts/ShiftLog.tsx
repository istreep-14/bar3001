import { personById, removeShift, undoRemove } from '../data/store.ts';
import type { ComponentChildren } from 'preact';
import { DASH, clockTight, dollars, fullDate, hours, hoursBare, money } from '../lib/format.ts';
import { groupShifts, shiftStatus } from '../lib/groups.ts';
import { clockArc, lean, scaleColor, standing } from '../lib/meters.ts';
import type { GroupBy } from '../lib/groups.ts';
import type { ShiftView } from '../lib/stats.ts';
import { closeSheet, openForm, openSheet } from '../router.ts';
import { PartyIcon } from '../ui/Badges.tsx';
import { ColumnMenu } from '../ui/ColumnMenu.tsx';
import { DayCell } from '../ui/DayCell.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ClockDial, RankBar, StackBar } from '../ui/Meters.tsx';
import { toast } from '../ui/toast.tsx';
import { CrewPhotos } from './CrewPhotos.tsx';
import { ShiftDetails } from './ShiftDetails.tsx';
import styles from './ShiftLog.module.css';

/* The desktop Log. Rows are grouped by month or week: a heading names the group once (with a count, and the group's tips and
 * total lined up in their columns), and the rows under it only say the day. Opening a row turns it into a card in place
 * (?shift=<id>, so it is still a link and Back closes it), with the income mix bar and the same stacked lists as the drawer.
 * The drawer does not also open on this page.
 *   Tips lead. They are the figure that says how a shift went, so they are the strongest number in the row, and Rate is tips
 *   per hour alone, in a pill tinted off one scale from red through plain to green, with a slim bar stood on end after it
 *   that fills as far as it ranks among the shifts listed. Hours sit in a faint ring: the shift's stretch drawn round the
 *   figure as a thin arc on a 12-hour clock. Rate, Hours and Total all stand the same height.
 *   Wage (a flat rate times hours) and Other (usually nothing, and not about the shift) are quiet columns with no rate of
 *   their own; Total adds them up, a step quieter than Tips.
 *   The day leads with a calendar chip and carries the shift's times under it, small and quiet; its type and party are their
 *   own narrow icon columns.
 *   Every column but the day can be hidden (`hidden`; the Log's Columns menu, the Dashboard's narrower card).
 * A shift short of its numbers (not yet worked, or worked but not yet paid) reads muted (no separate layout), so the eye can
 * still scan straight down the columns. */
const CREW_SHOWN = 6;   // up to six people standing in the row as one group picture, then +N; hovering names everyone

export type LogCol = 'type' | 'party' | 'hours' | 'tips' | 'rate' | 'wage' | 'other' | 'total' | 'crew';
/** The Log's columns after the day, in order, with their widths. */
export const LOG_COLUMNS: { key: LogCol; head: string; width: string; align?: 'r' | 'c' }[] = [
  { key: 'type', head: 'Type', width: '2.5rem', align: 'c' },
  { key: 'party', head: 'Party', width: '2.75rem', align: 'c' },
  { key: 'hours', head: 'Hours', width: '3.75rem', align: 'r' },
  { key: 'tips', head: 'Tips', width: '4.5rem', align: 'r' },
  { key: 'rate', head: 'Rate', width: '6.5rem', align: 'r' },
  { key: 'wage', head: 'Wage', width: '4rem', align: 'r' },
  { key: 'other', head: 'Other', width: '4rem', align: 'r' },
  { key: 'total', head: 'Total', width: '4.5rem', align: 'r' },
  { key: 'crew', head: 'Crew', width: 'minmax(17rem, 1fr)' }
];

/** `inline` = rows open into a card in place (the Log). Off, a row opens the drawer instead (the Dashboard's short list). */
/** `onHidden` puts the Columns menu in the head's right corner, to show and hide columns. */
export function ShiftLog({ views, by, openId, inline = true, hidden = [], onHidden }: { views: ShiftView[]; by: GroupBy; openId: string | null; inline?: boolean; hidden?: LogCol[]; onHidden?: (h: LogCol[]) => void }) {
  const groups = groupShifts(views, by);
  const grouped = by !== 'none';
  const done = views.filter(v => shiftStatus(v) === 'done' && v.tph != null && v.hours);
  const worked = done.reduce((n, v) => n + v.hours!, 0);
  const ctx: Context = { rates: done.map(v => v.tph), avg: worked ? done.reduce((n, v) => n + (v.shift.tips ?? 0), 0) / worked : null };
  const cols = LOG_COLUMNS.filter(c => !hidden.includes(c.key));
  // Grid lines: the day is column 1, then the visible columns, then the chevron. The group heading's figures sit in theirs.
  const at = (k: LogCol) => { const i = cols.findIndex(c => c.key === k); return i < 0 ? null : i + 2; };
  const tipsAt = at('tips'), totalAt = at('total');
  const grid = { '--log-cols': `minmax(10rem, 1.4fr) ${cols.map(c => c.width).join(' ')} 2rem` };
  return (
    <div class={styles.log} style={grid} onKeyDown={moveFocus}>
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
            {g.views.map(v => <Row key={v.shift.id} v={v} open={inline && openId === v.shift.id} selected={openId === v.shift.id} ctx={ctx} cols={cols} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** What a row's rate is measured against: the listed shifts' rates, and their average (all their tips over all their hours,
 *  the same figure as the side panel's Rate). */
interface Context { rates: (number | null)[]; avg: number | null }

function Row({ v, open, selected, ctx, cols }: { v: ShiftView; open: boolean; selected: boolean; ctx: Context; cols: typeof LOG_COLUMNS }) {
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
  const time = sh.start != null && sh.end != null ? `${clockTight(sh.start)} → ${clockTight(sh.end)}`
    : sh.start != null ? `${clockTight(sh.start)} →` : sh.end != null ? `→ ${clockTight(sh.end)}` : null;
  const cell: Record<LogCol, () => ComponentChildren> = {
    type: () => sh.shift_type && <span class={styles.type} data-kind={sh.shift_type}><Icon name={sh.shift_type === 'day' ? 'sun' : 'moon'} label={sh.shift_type === 'day' ? 'Day shift' : 'Night shift'} /></span>,
    party: () => sh.party && <PartyIcon />,
    hours: () => <Hours v={v} />,
    tips: () => <span class={`num ${done ? styles.tips : ''}`}>{done ? dollars(sh.tips) : DASH}</span>,
    rate: () => (done && v.tph != null ? <Rate tph={v.tph} ctx={ctx} /> : DASH),
    wage: () => <span class={`num ${styles.quiet}`}>{done && v.wage != null ? dollars(v.wage) : ''}</span>,
    other: () => <span class={`num ${styles.quiet}`}>{done && v.extra ? dollars(v.extra) : ''}</span>,
    total: () => (done ? <Total v={v} /> : <span class="num">{DASH}</span>),
    crew: () => <>{v.crewCount > 0 && <CrewPhotos crew={shown} more={v.crewCount - shown.length} />}{crewSays && <span class="sr-only">{crewSays}</span>}</>
  };
  return (
    <div class={styles.item} data-open={open ? '' : undefined} data-selected={selected && !open ? '' : undefined} data-status={status} role="listitem">
      <button type="button" class={`${styles.grid} ${styles.row}`} data-row aria-expanded={open} onClick={() => openSheet(id)} title={fullDate(sh.date)}>
        <DayCell date={sh.date} chip sub={time && <span class={styles.times}>{time}</span>} />
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

/** Tips per hour in a pill tinted off the red-to-green scale, then a slim bar stood on end that fills 0-100% as far as the
 *  rate ranks among the listed shifts. Hovering says it in words: the share it beat, and how far from your average. */
function Rate({ tph, ctx }: { tph: number; ctx: Context }) {
  const at = standing(ctx.rates, tph);
  const l = at == null ? 0 : lean(at);
  const tone = scaleColor(l, 'var(--ink-2)', 75);
  const diff = ctx.avg == null ? null : tph - ctx.avg;
  const says = at == null || diff == null || ctx.avg == null ? undefined
    : `Better than ${Math.round(at * 100)}% of the shifts here\n${Math.abs(diff) < 0.005 ? 'Right on' : `${money(Math.abs(diff))}/hr ${diff > 0 ? 'above' : 'below'}`} your average ${money(ctx.avg)}/hr`;
  return (
    <span class={`${styles.rate} ${says ? 'tip' : ''}`} data-tip={says} style={{ '--tone': tone }}>
      <span class={`num ${styles.ratePill}`}>{money(tph)}</span>
      {at != null && <RankBar up at={at} color={scaleColor(l, 'var(--ink-4)', 80)} />}
      {says && <span class="sr-only">{says.replace('\n', '. ')}</span>}
    </span>
  );
}

/** The total, and under it (exactly its width) what it's made of: tips, wage and other side by side in their own colours,
 *  the same colours as the opened shift's mix bar. Hovering names the amounts. */
function Total({ v }: { v: ShiftView }) {
  const parts = [
    { key: 'tips', label: 'Tips', amount: v.shift.tips ?? 0, color: 'var(--cat-tips)' },
    { key: 'wage', label: 'Wage', amount: v.wage ?? 0, color: 'var(--cat-wage)' },
    { key: 'other', label: 'Other', amount: v.extra ?? 0, color: 'var(--cat-other)' }
  ];
  const says = parts.filter(p => p.amount > 0).map(p => `${p.label} ${dollars(p.amount)}`).join('\n');
  return (
    <span class={`figure num ${styles.total} ${says ? 'tip' : ''}`} data-tip={says || undefined}>
      {dollars(v.total)}
      <span class="figure-under"><StackBar parts={parts} /></span>
      {says && <span class="sr-only">{says.replace(/\n/g, ', ')}</span>}
    </span>
  );
}

const TYPE_INK = { day: 'var(--day-ink)', night: 'var(--night)' } as const;

/** Hours worked, in a ring: the shift's stretch drawn round the figure as an arc on a 12-hour clock (6p to 2a runs from
 *  the 6 round to the 2), in its day or night colour. No unit; the column says hours. Without both times, just the figure. */
function Hours({ v }: { v: ShiftView }) {
  const { start, end, shift_type } = v.shift;
  const arc = start != null && end != null ? clockArc(start, end) : null;
  const says = arc ? `${clockTight(start)} → ${clockTight(end)}${v.hours != null ? ` · ${hours(v.hours)} worked` : ''}` : undefined;
  const figure = <span class="num">{hoursBare(v.hours)}</span>;
  return (
    <span class={`${styles.hours} ${says ? 'tip' : ''}`} data-tip={says}>
      {arc ? <ClockDial from={arc.from} sweep={arc.sweep} color={shift_type ? TYPE_INK[shift_type] : undefined}>{figure}</ClockDial> : figure}
      {says && <span class="sr-only">{says}</span>}
    </span>
  );
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
