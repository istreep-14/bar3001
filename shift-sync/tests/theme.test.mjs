import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCENTS, TINTS, buildTheme, contrast, hexToHsl, hslToHex, mix, resolveAccent } from '../src/lib/theme.ts';

test('hsl round trip', () => {
  for (const hex of ['#0d7a70', '#4fd6c4', '#be1e5a', '#475569']) {
    const { h, s, l } = hexToHsl(hex);
    assert.ok(contrast(hex, hslToHex(h, s, l)) > 1.02 ** -1 && contrast(hex, hslToHex(h, s, l)) < 1.05, hex);
  }
});

test('every text step keeps its contrast on every surface, in every combination', () => {
  for (const mode of ['light', 'dark'])
    for (const tint of TINTS) for (const c of ['soft', 'standard', 'high']) for (const a of ACCENTS) {
      const t = buildTheme({ mode, accent: a.id, tint: tint.id, contrast: c });
      const label = `${mode}/${tint.id}/${c}/${a.id}`;
      for (const g of ['--bg', '--surface', '--surface-2', '--surface-3']) {
        assert.ok(contrast(t['--ink'], t[g]) >= 11.5, `ink on ${g} ${label}`);
        assert.ok(contrast(t['--ink-2'], t[g]) >= 5.3, `ink-2 on ${g} ${label}`);
        assert.ok(contrast(t['--ink-3'], t[g]) >= 4.5, `ink-3 on ${g} ${label}`);
      }
      assert.ok(contrast(t['--accent'], t['--surface']) >= 4.5, `accent as text ${label}`);
      assert.ok(contrast(t['--on-accent'], t['--accent']) >= 4.5, `on-accent ${label}`);
    }
});

test('text stays readable on the canvas blooms and on glass over them', () => {
  for (const mode of ['light', 'dark'])
    for (const tint of TINTS) for (const c of ['soft', 'standard', 'high']) for (const a of ACCENTS) {
      const t = buildTheme({ mode, accent: a.id, tint: tint.id, contrast: c });
      const label = `${mode}/${tint.id}/${c}/${a.id}`;
      for (const m of ['--mesh-a', '--mesh-b', '--mesh-c']) {
        // the bare canvas where a bloom has faded to 60% (page titles, the nav), and a pane (--glass-pane-a, the lighter
        // frost) of --surface over a bloom at full strength
        assert.ok(contrast(t['--ink-3'], mix(t['--bg'], t[m], 0.6)) >= 4.5, `ink-3 on the canvas under ${m} ${label}`);
        assert.ok(contrast(t['--ink-3'], mix(t[m], t['--surface'], 0.56)) >= 4.5, `ink-3 on glass over ${m} ${label}`);
      }
      assert.ok(contrast(t['--on-accent'], t['--accent-2']) >= 4.5, `on-accent across the button's sheen ${label}`);
    }
});

test('the surfaces are a ramp, not two extremes', () => {
  const l = buildTheme({ mode: 'light', accent: 'teal', tint: 'teal', contrast: 'standard' });
  const d = buildTheme({ mode: 'dark', accent: 'teal', tint: 'teal', contrast: 'standard' });
  assert.notEqual(l['--surface'], '#ffffff');
  assert.ok(contrast(l['--surface'], l['--bg']) > 1.08 && contrast(l['--surface'], l['--bg']) < 1.4);
  assert.ok(contrast(l['--surface'], l['--line']) > 1.25);            // a line is visible against the panel
  assert.ok(contrast(d['--surface'], d['--line']) > 1.2);
  assert.ok(contrast(d['--ink'], d['--bg']) < 21 && contrast(d['--ink'], d['--bg']) > 12);
});

test('custom accents: as-is in light, lightened in dark, always readable', () => {
  assert.equal(resolveAccent('#336699', 'light'), '#336699');
  assert.ok(hexToHsl(resolveAccent('#336699', 'dark')).l >= 67);
  const t = buildTheme({ mode: 'light', accent: '#f5e000', tint: 'neutral', contrast: 'standard' });   // a yellow that fails as text
  assert.ok(contrast(t['--accent'], t['--surface']) >= 4.5);
  assert.equal(resolveAccent('nonsense', 'light'), ACCENTS[0].light);
});

test('table headers read as a band and their text stays readable on it', () => {
  for (const mode of ['light', 'dark'])
    for (const tint of TINTS) for (const c of ['soft', 'standard', 'high']) {
      const t = buildTheme({ mode, accent: 'teal', tint: tint.id, contrast: c });
      const th = mix(t['--surface'], t['--surface-3'], 0.7);   // tokens.css --th-bg
      const label = `${mode}/${tint.id}/${c}`;
      assert.ok(contrast(t['--ink-2'], th) >= 5.3, `header text ${label}`);
      assert.ok(contrast(th, t['--surface']) > 1.08, `header band stands off the table ${label}`);
    }
});
