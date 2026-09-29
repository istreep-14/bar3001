export type ShiftType = 'day' | 'night';
export type Category = 'Chump' | 'Cash' | 'Venmo' | 'Consideration' | 'Overtime';

export interface Shift {
  id: string;
  date: string;                 // YYYY-MM-DD
  start: number | null;         // minutes since midnight
  end: number | null;
  tips: number | null;
  notes: string | null;
  updated_at: number;
  deleted: boolean;
  other: number | null;         // legacy single amount; new entries use Income rows
  shift_type: ShiftType | null;
  party: boolean;               // a party happened on this shift
}
export interface Income {
  id: string;
  shift_id: string;
  category: Category;
  amount: number;
  note: string | null;
  updated_at: number;
  deleted: boolean;
}
export interface Crew {
  id: string;
  shift_id: string;
  staff_id: string;
  name: string | null;          // roster name when logged; the Sheet shows this
  start: number | null;
  end: number | null;
  updated_at: number;
  deleted: boolean;
}
export interface Wage {
  id: string;
  date: string;                 // in effect from this date until the next Wage row's date
  rate: number;                 // dollars per hour
  note: string | null;
  updated_at: number;
  deleted: boolean;
}
export interface Staff {
  id: string;
  name: string;                 // the unique handle
  first: string | null;
  last: string | null;
  roles: string[];
  id_number: string | null;
  manager: boolean;
  is_user: boolean;
  status: 'active' | 'inactive';
  notes: string | null;
  updated_at: number;
  deleted: boolean;
  aliases: string[];            // other names they go by; a typed name matches these too
  photo: string | null;         // a small data:image URL, shown in their avatar
  avatar_color: string | null;  // '#rrggbb' or a palette name; null picks one from the id
  avatar_text: string | null;   // 1-3 characters in place of the initials
  role: string | null;          // the main role; `roles` holds the others. Null on older rows: read roles[0] as main
}
export interface Role {
  id: string;
  name: string;                 // unique; what Staff.role and Staff.roles hold
  color: string | null;         // '#rrggbb' or a palette name
  icon: string | null;          // an icon name the app draws
  sort: number;                 // rank: lower first
  updated_at: number;
  deleted: boolean;
}
export type Local<T> = T & { _dirty?: boolean };

export const COLS: string[];
export const INCOME_COLS: string[];
export const STAFF_COLS: string[];
/** The longest a person's photo (a data URL) may be: it lives in one Sheet cell. */
export const PHOTO_MAX: number;
export const CREW_COLS: string[];
export const WAGE_COLS: string[];
export const ROLE_COLS: string[];
export function validateRole(r: unknown): Role;
export function validateWage(r: unknown): Wage;
export function wageRateFor(rates: Pick<Wage, 'date' | 'rate'>[] | undefined, date: string): number | null;
export function wageFor(rates: Pick<Wage, 'date' | 'rate'>[] | undefined, date: string, hours: number | null): number | null;
export function validateCrew(r: unknown): Crew;
export function crewHours(crew?: Pick<Crew, 'start' | 'end'>[]): number;
export function validateStaff(r: unknown): Staff;
export const CATEGORIES: Category[];
export function toMin(hhmm: string | null | undefined): number | null;
export function toHHMM(min: number | null | undefined): string;
export function hoursWorked(start: number | null, end: number | null): number | null;
export function tipsPerHour(r: Pick<Shift, 'start' | 'end' | 'tips'>): number | null;
export function sumIncome(income?: Pick<Income, 'amount'>[]): number;
export function totalIncome(r: Pick<Shift, 'tips' | 'other'>, income?: Pick<Income, 'amount'>[], wage?: number | null): number;
export function defaultShiftType(startMin: number | null | undefined): ShiftType | null;
export function validateRow(r: unknown): Shift;
export function validateIncome(r: unknown): Income;
export function pickNewer<T extends { updated_at: number }>(current: T | undefined, incoming: T | undefined): T;
export function reconcileClient<T extends { id: string; updated_at: number }>(
  local: Record<string, Local<T>>, serverRows: T[], heldIds?: string[]): Record<string, Local<T>>;
export function stripLocal<T>(r: Local<T>): T;
