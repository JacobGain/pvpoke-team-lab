import type { BattleReplayEvent, BattleReplayState } from '@/domain/simulation/contracts';

export function playbackDelay(speed: number): number {
  return 500 / speed;
}

export function visibleBattleEvents(events: readonly BattleReplayEvent[]) {
  // PvPoke emits eight swipe markers for one charged attack, plus fast-move
  // tap markers. These are animation cues, not additional battle actions.
  return events.filter(event => !event.type.startsWith('tap') && event.type !== 'switchAvailable');
}

export function turnChanges(state: BattleReplayState, previous?: BattleReplayState) {
  return {
    hp: previous ? state.hp - previous.hp : 0,
    energy: previous ? state.energy - previous.energy : 0,
  };
}

export function eventText(event: BattleReplayEvent, names: readonly string[]) {
  const actor = names[event.actor];
  const kind = event.type.split(' ')[0];
  if (kind === 'fast' || kind === 'charged') {
    const energy = Number(event.values[1] ?? 0);
    // The engine separates stat changes with <br>. Convert that separator only;
    // all other content remains text, escaped by React when the log renders.
    const extra = event.values.slice(3).map(value => String(value).replace(/<br\s*\/?\s*>/gi, ', ')).join(' · ');
    return `${actor}: ${event.name} · ${event.values[0]} damage · ${energy > 0 ? '+' : ''}${energy} energy${extra ? ` · ${extra}` : ''}`;
  }
  if (kind === 'shield') return `${actor} shields · ${event.values[0]} damage blocked`;
  return `${actor}: ${event.name}`;
}
