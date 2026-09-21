import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BattleReplayEvent, BattleReplayState } from '@/domain/simulation/contracts';
import { eventText, playbackDelay, turnChanges, visibleBattleEvents } from './duelReplay';

describe('duel playback presentation', () => {
  it('formats engine stat separators and renders unexpected markup as text', () => {
    const event: BattleReplayEvent = { type: 'charged', name: 'Move', actor: 0, values: [10, -35, 0, 'Attack rose<br>Defense fell', '<scrip<script>t>alert(1)</script>'] };
    const text = eventText(event, ['A', 'B']);
    expect(text).toContain('Attack rose, Defense fell');
    expect(text).toContain('<scrip<script>t>alert(1)</script>');
    const markup = renderToStaticMarkup(createElement('li', null, text));
    expect(markup).not.toContain('<script');
    expect(markup).toContain('&lt;scrip&lt;script&gt;t&gt;');
  });
  it('omits all minigame cues without deduplicating real attacks', () => {
    const attack: BattleReplayEvent = { type: 'charged water', name: 'Hydro Cannon', actor: 0, values: [60, -40] };
    const shield: BattleReplayEvent = { type: 'shield', name: 'Shield', actor: 1, values: [59] };
    const cues = Array.from({ length: 8 }, (_, index) => ({ ...attack, type: 'tap water', name: 'Swipe', values: [index] }));
    expect(visibleBattleEvents([...cues, shield, attack, attack, { ...attack, type: 'tap interaction' }])).toEqual([shield, attack, attack]);
    expect(eventText(attack, ['A', 'B'])).toBe('A: Hydro Cannon · 60 damage · -40 energy');
  });
  it.each([[.5, 1000], [1, 500], [2, 250], [4, 125]])('plays at %s× using %s ms turns', (speed, delay) => {
    expect(playbackDelay(speed)).toBe(delay);
  });
  it('uses real state deltas, including energy caps and overkill', () => {
    const previous: BattleReplayState = { hp: 3, maximumHp: 100, energy: 98, shields: 1, form: 'azumarill', buffs: [0, 0] };
    expect(turnChanges({ ...previous, hp: 0, energy: 100 }, previous)).toEqual({ hp: -3, energy: 2 });
    expect(turnChanges({ ...previous, energy: 58 }, previous)).toEqual({ hp: 0, energy: -40 });
    expect(turnChanges(previous)).toEqual({ hp: 0, energy: 0 });
  });
});
