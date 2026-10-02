import test from 'node:test';
import assert from 'node:assert/strict';
import type { Shift } from '../src/core/core.generated.js';
import { applyFilter, forecast, lastDays, pace, series, similarShifts, soFar, spread, versusSimilar, weekPace } from '../src/lib/home.ts';
import { toView } from '../src/lib/stats.ts';

const TODAY = '2026-10-02';   // a Friday
let n = 0;
const shift = (o: Partial<Shift> = {}): Shift => ({ id: 's' + n++, date: '2026-09-25', start: 1080, end: 120, tips: 300, notes: null, updated_at: 1, deleted: false, other: null, shift_type: 'night', party: false, ...o });
const v = (o: Partial<Shift>) => toView(shift(o), []);

test('the last 7 days against the 7 before, per figure', () => {
  const views = [
    v({ date: '2026-10-01', tips: 300 }), v({ date: '2026-09-26', tips: 100 }),   // in the last 7 (Sep 26 – Oct 2)
    v({ date: '2026-09-25', tips: 200 }),                                         // the 7 before (Sep 19 – 25)
    v({ date: '2026-10-02', tips: null, end: null })                              // tonight, booked: counts nothing
  ];
  const r = lastDays(views, TODAY);
  assert.equal(r.from, '2026-09-26');
  assert.equal(r.now.tips, 400);
  assert.equal(r.before.tips, 200);
  assert.equal(r.delta.tips, 100);
  assert.equal(r.delta.hours, 100);   // two 8-hour shifts against one
  assert.equal(r.now.shifts, 2);
});

test('a period so far compares with the same point of the one before', () => {
  const views = [v({ date: '2026-10-01', tips: 50 }), v({ date: '2026-09-01', tips: 80 }), v({ date: '2026-09-03', tips: 999 })];
  const m = soFar(views, TODAY, 'month');
  assert.deepEqual([m.from, m.prevFrom, m.prevTo], ['2026-10-01', '2026-09-01', '2026-09-02']);
  assert.equal(m.before.tips, 80);   // Sep 3 is past the same point
  const w = soFar(views, TODAY, 'week');
  assert.deepEqual([w.from, w.prevFrom, w.prevTo], ['2026-09-28', '2026-09-21', '2026-09-25']);
  const y = soFar(views, TODAY, 'year');
  assert.deepEqual([y.from, y.prevFrom, y.prevTo], ['2026-01-01', '2025-01-01', '2025-10-02']);
});

test('pace: full weeks only, a week off counted, as a month and a year', () => {
  const views = [v({ date: '2026-09-21', tips: 400 }), v({ date: '2026-09-14', tips: 400 }), v({ date: '2026-09-29', tips: 5000 })];
  const p = pace(views, TODAY, 4);   // weeks of Sep 7, 14, 21 and Aug 31; this week left out
  assert.equal(p.perWeek.tips, 200);
  assert.equal(p.year, 200 * 52);
  assert.equal(Math.round(p.month), Math.round((200 * 52) / 12));
});

test('the middle half of some values', () => {
  assert.deepEqual(spread([100, 200, 300, 400, 500]), { lo: 200, mid: 300, hi: 400 });
});

test('shifts like this one: weekday first, then type and party, then type alone', () => {
  const fri = (date: string, tips: number, party = false) => v({ date, tips, party });
  const fridays = [fri('2026-09-25', 300), fri('2026-09-18', 320), fri('2026-09-11', 280), fri('2026-09-04', 340)];
  const target = v({ date: '2026-10-02', tips: null, end: null });
  const a = similarShifts([...fridays, v({ date: '2026-09-23', tips: 100 }), target], target)!;
  assert.equal(a.label, 'Fri nights');
  assert.equal(a.views.length, 4);
  assert.equal(a.tips.mid, 310);

  // a party night with only a few party nights to go on: party nights of any weekday
  const party = v({ date: '2026-10-02', party: true });
  const parties = [fri('2026-09-23', 600, true), fri('2026-09-16', 500, true), fri('2026-09-09', 700, true)];
  assert.equal(similarShifts([...fridays, ...parties, party], party)!.label, 'party nights');

  // too few party nights: every night
  assert.equal(similarShifts([...fridays, parties[0]!, party], party)!.label, 'nights');

  // a day shift never measures against nights
  const day = v({ date: '2026-10-02', shift_type: 'day' });
  assert.equal(similarShifts([...fridays, day], day), null);
});

test('a finished shift against its kind, and a booked one forecast from it', () => {
  const past = ['2026-09-25', '2026-09-18', '2026-09-11', '2026-09-04'].map(date => v({ date, tips: 200 }));
  const done = v({ date: '2026-10-02', tips: 300 });
  assert.equal(versusSimilar([...past, done], done)!.pct, 50);
  assert.equal(forecast([...past, done], done), null);
  const booked = v({ date: '2026-10-09', tips: null, end: null });
  assert.equal(forecast([...past, booked], booked)!.tips.mid, 200);
});

test('the week on pace: done plus what the booked shifts should bring', () => {
  const past = ['2026-09-25', '2026-09-18', '2026-09-11', '2026-09-04'].map(date => v({ date, tips: 200 }));
  const views = [...past, v({ date: '2026-09-28', tips: 150 }), v({ date: '2026-10-03', tips: null, end: null })];
  const w = weekPace(views, TODAY);
  assert.equal(w.done, 150);
  assert.equal(w.booked, 1);
  assert.equal(w.expected, 350);
});

test('a series by week or month, through a filter', () => {
  const views = [v({ date: '2026-10-01', tips: 100 }), v({ date: '2026-09-22', tips: 50, shift_type: 'day' }), v({ date: '2026-08-15', tips: 70, party: true })];
  const weeks = series(views, TODAY, 'week', 3);
  assert.deepEqual(weeks.map(p => p.key), ['2026-09-14', '2026-09-21', '2026-09-28']);
  assert.deepEqual(weeks.map(p => p.s.tips), [0, 50, 100]);
  assert.equal(weeks[2]!.partial, true);
  const nights = series(views, TODAY, 'month', 3, { type: 'night', party: 'any' });
  assert.deepEqual(nights.map(p => [p.key, p.s.tips]), [['2026-08-01', 70], ['2026-09-01', 0], ['2026-10-01', 100]]);
  assert.equal(applyFilter(views, { type: 'any', party: 'yes' }).length, 1);
  assert.equal(series(views, TODAY, 'day', 2).map(p => p.key).join(), '2026-10-01,2026-10-02');
});
