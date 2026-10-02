/* One icon family (Lucide-style, 24px grid, 1.75 stroke). Add paths here, never emoji. */
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  log: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  x: 'M18 6L6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  refresh: 'M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8M21 4v5h-5M3 20v-5h5',
  cloudOff: 'M2 2l20 20M8.4 4.3A6 6 0 0117 8a4 4 0 012 7.4M6 18a4 4 0 01-.9-7.9',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  chevron: 'M9 6l6 6-6 6',
  left: 'M15 18l-6-6 6-6',
  dollar: 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  table: 'M3 5h18v14H3zM3 10h18M9 5v14',
  cards: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  star: 'M12 3l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z',
  calendar: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  clock: 'M12 6v6l4 2M12 22a10 10 0 100-20 10 10 0 000 20z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  /* you, and a manager */
  crown: 'M3 7l4.5 4.5L12 4l4.5 7.5L21 7l-2 10H5L3 7zM5 21h14',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  /* the icons a role can wear */
  cocktail: 'M8 22h8M12 11v11M3 3h18l-9 9z',
  beer: 'M17 11h1a3 3 0 010 6h-1M5 8h12v12a2 2 0 01-2 2H7a2 2 0 01-2-2zM9 12v6M13 12v6M6 8a3 3 0 012-5 4 4 0 017 0 3 3 0 012 5',
  bell: 'M3 18h18M5 18a7 7 0 0114 0M12 8V6M10 6h4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  door: 'M13 4h3a2 2 0 012 2v14M2 20h20M13 20V3.5a1 1 0 00-1.2-1L6 4v16M10 12v.01',
  key: 'M12 11a4 4 0 100-8 4 4 0 000 8zM12 11v10M12 16h3M12 19h2',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
  chef: 'M6 13.9A4 4 0 017 6a5 5 0 0110 0 4 4 0 011 7.9V20H6zM6 17h12',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9z',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z',
  flame: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.2.4-2.3 1-3.3.5 1.8 1.6 2.8 2.5 2.8z',
  sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z'
} as const;
export type IconName = keyof typeof PATHS;
/** The icons a role can pick in Settings. */
export const ROLE_ICONS: IconName[] = ['cocktail', 'beer', 'bell', 'box', 'door', 'key', 'music', 'chef', 'bolt', 'heart', 'flame', 'sparkle', 'star', 'shield', 'crown', 'users'];
export const isIconName = (s: string | null | undefined): s is IconName => !!s && s in PATHS;

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg class="icon" viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={PATHS[name]} />
    </svg>
  );
}
