import { useEffect, useState } from 'preact/hooks';
import { byDate, monthGrid, rateScale } from '../lib/calendar.ts';
import { today as todayText } from '../lib/dates.ts';
import { MONTH_NAMES, WEEKDAY_LETTERS, clockShort, dollars, moneyWhole, perHour } from '../lib/format.ts';
import { isPending, shiftStatus } from '../lib/groups.ts';
import { levelScale } from '../lib/blocks.ts';
import { summarize } from '../lib/stats.ts';
import type { ShiftView } from '../lib/stats.ts';
import { go, openForm, openSheet, sheet } from '../router.ts';
import { Icon } from '../ui/Icon.tsx';
import styles from './MiniMonth.module.css';

/* The mini calendar: one month as a small block any page can set beside its own content (the Shifts, Crew and Income side
 * panels, the Dashboard, Insights). A day with a shift is shaded the way the Calendar page shades it — toward the primary
 * colour when its tips per hour beat the month's typical shift, toward amber when they fall short, deeper the further out —
 * with a dot for its type (day or night). A shift still waiting on its money is outlined, not shaded. Today has a ring;
 * the shift open in the drawer is filled. Tap a shift to open it, an empty day to start one there. Under the grid, the
 * month's shifts, tips and rate; the full Calendar is one link away.
 * `figures="tips"` is the small tips calendar: square cells, each day's tips written in it and shaded by quartile of the
 * month's days (so it reads as an amount, not a rate), a booked day showing its start time. */
export function MiniMonth({ views, title, start, link = true, figures, picked, onPick }: {
  /** Write each day's tips in its cell (square cells, shaded by amount) instead of a dot. */
  figures?: 'tips';
  views: ShiftView[];
  /** A heading above the month name (the block's job on that page), or none. */
  title?: string;
  /** 'YYYY-MM' to open on; by default this month, or the latest month with a shift when this month has none. */
  start?: string;
  /** Show the "Open calendar" link (off on the Calendar page itself). */
  link?: boolean;
  /** Shift id to mark. With `onPick`, a day selects that shift instead of opening the drawer. */
  picked?: string;
  onPick?: (list: ShiftView[]) => void;
}) {
  const today = todayText();
  // Months stepped from the opening month, not a fixed month: the opening month follows the data as it loads.
  // When `start` changes (Home follows the selected shift), the step resets so that month is the one on screen.
  const [offset, setOffset] = useState(0);
  const open0 = start ?? openingMonth(views, today);
  useEffect(() => { if (start) setOffset(0); }, [start]);
  const t0 = new Date(Date.UTC(+open0.slice(0, 4), +open0.slice(5, 7) - 1 + offset, 1));
  const month = { y: t0.getUTCFullYear(), m: t0.getUTCMonth() };
  const key = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  const inMonth = views.filter(v => v.shift.date.startsWith(key));
  const days = byDate(inMonth), cells = monthGrid(month.y, month.m);
  const scale = rateScale(inMonth.map(v => v.tph));
  const tipsLv = levelScale([...days.values()].map(l => summarize(l).shifts ? summarize(l).tips : null));
  const sum = summarize(inMonth);
  const open = picked ?? sheet.value;
  const step = (n: number) => setOffset(o => o + n);
  const name = `${MONTH_NAMES[month.m]} ${month.y}`;
  return (
    <section class={styles.block} data-figures={figures} aria-label={title ? `${title}: ${name}` : name}>
      {title && <h3 class="label">{title}</h3>}
      <header class={styles.head}>
        <h4 class={styles.name} aria-live="polite">{name}</h4>
        <span class={styles.nav}>
          <button type="button" class={styles.step} aria-label="Previous month" onClick={() => step(-1)}><Icon name="left" /></button>
          <button type="button" class={styles.step} aria-label="Next month" onClick={() => step(1)}><Icon name="chevron" /></button>
        </span>
      </header>
      <div class={styles.grid} role="group" aria-label={name}>
        {WEEKDAY_LETTERS.map((l, i) => <span class={styles.dow} key={i} aria-hidden="true">{l}</span>)}
        {cells.map(c => {
          const n = +c.date.slice(8), list = c.inMonth ? days.get(c.date) ?? [] : [];
          const isToday = c.date === today;
          if (!c.inMonth) return <span key={c.date} class={styles.day} data-out="">{n}</span>;
          if (!list.length) {
            return (
              <button type="button" key={c.date} class={styles.day} data-today={isToday ? '' : undefined}
                aria-label={`${c.date}: no shift. New shift`} title="New shift" onClick={() => openForm('new', c.date)}>{n}</button>
            );
          }
          const d = summarize(list), pending = list.every(isPending), h = pending ? null : scale?.at(d.tph);
          const kinds = new Set(list.map(v => shiftStatus(v)));
          const type = list.length > 1 && list.some(v => v.shift.shift_type !== list[0]!.shift.shift_type) ? 'both' : list[0]!.shift.shift_type;
          const says = !pending ? `${d.tph == null ? 'no rate yet' : perHour(d.tph)} · ${moneyWhole(d.total)}`
            : kinds.size === 1 && kinds.has('worked') ? 'awaiting tips'
            : kinds.size === 1 && kinds.has('scheduled') ? 'upcoming'
            : 'not finished';
          const first = list.find(v => v.shift.id === open) ?? list[0]!;
          return (
            <button type="button" key={c.date} class={styles.day} data-has="" data-pending={pending ? '' : undefined}
              data-side={figures ? undefined : h?.side} data-lv={figures && !pending ? tipsLv(d.tips) : undefined}
              data-today={isToday ? '' : undefined} aria-pressed={list.some(v => v.shift.id === open)}
              style={h && !figures ? { '--heat': String(h.mag) } : undefined}
              title={`${says} · ${list.length} shift${list.length === 1 ? '' : 's'}`} aria-label={`${c.date}: ${says}. ${onPick ? 'Select' : 'Open'}`}
              onClick={() => onPick ? onPick(list) : openSheet(first.shift.id)}>
              {figures ? (
                <><span class={styles.fn}>{n}</span>
                  <span class={styles.ff}>{!pending ? moneyWhole(d.tips) : shiftStatus(list[0]!) === 'scheduled' ? clockShort(list[0]!.shift.start) || '•' : '?'}</span></>
              ) : <>{n}<i class={styles.dot} data-type={type} aria-hidden="true" /></>}
            </button>
          );
        })}
      </div>
      <dl class={styles.foot}>
        <div><dt>Shifts</dt><dd>{inMonth.length || '—'}</dd></div>
        <div><dt>Tips</dt><dd>{sum.shifts ? dollars(sum.tips) : '—'}</dd></div>
        <div><dt>Rate</dt><dd>{sum.tph == null ? '—' : moneyWhole(sum.tph)}<span class={styles.unit}>{sum.tph == null ? '' : '/hr'}</span></dd></div>
      </dl>
      {(scale || link) && (
        <footer class={styles.key}>
          {scale && <span class={styles.scale} title={`Typical ${moneyWhole(scale.median)}/hr this month`}><i data-side="lo" />lower<i data-side="hi" />higher</span>}
          {link && <a class="linkbtn" href="#/calendar" onClick={e => { e.preventDefault(); go('calendar'); }}>Open calendar</a>}
        </footer>
      )}
    </section>
  );
}

/** This month, unless it has no shift and an earlier month does: then the latest month that has one. */
export function openingMonth(views: ShiftView[], today: string): string {
  const now = today.slice(0, 7);
  if (views.some(v => v.shift.date.startsWith(now))) return now;
  const past = views.map(v => v.shift.date.slice(0, 7)).filter(m => m <= now).sort();
  return past.at(-1) ?? now;
}
