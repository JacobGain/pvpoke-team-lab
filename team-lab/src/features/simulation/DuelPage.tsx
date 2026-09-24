import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Swords } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PokemonCombobox } from '@/components/PokemonCombobox';
import { PokemonSprite } from '@/components/PokemonSprite';
import { usePokemonCatalog } from '@/features/meta/usePokemonCatalog';
import { useLeague } from '@/features/leagues/leagueStore';
import type { PokemonCatalog, PokemonCatalogEntry } from '@/domain/pokemon/catalog';
import type { ExactSimulationBuild, OneOnOneSimulationCombatant, OneOnOneSimulationResult, ShieldCount } from '@/domain/simulation/contracts';
import { calculateCombatPower, getCpMultiplier } from '@/domain/pokemon/combatPower';
import { createPvpokeOneOnOneAdapter } from '@/pvpoke/simulation';
import { defaultDuelBuild, duelBuildError, fitDuelLevel } from './duelBuild';
import { eventText, visibleBattleEvents, playbackDelay, turnChanges } from './duelReplay';
import '@/styles/modules/duel.css';

function BuildEditor({ index, catalog, value, onChange }: {
  index: number; catalog: PokemonCatalog; value: OneOnOneSimulationCombatant;
  onChange: (value: OneOnOneSimulationCombatant) => void;
}) {
  const league = useLeague();
  const pokemon = catalog.entries.find(entry => entry.speciesId === value.build.speciesId)!;
  const build = value.build;
  const error = duelBuildError(build, pokemon, league.cp);
  const cp = getCpMultiplier(build.level) === undefined ? '—' : calculateCombatPower(pokemon.baseStats, build.ivs, build.level);
  function update(patch: Partial<ExactSimulationBuild>) { onChange({ ...value, build: { ...build, ...patch } }); }
  function select(pokemon: PokemonCatalogEntry) { onChange({ ...value, build: defaultDuelBuild(pokemon, league.cp) }); }
  const counterpart = catalog.entries.find(entry => entry.speciesId === (pokemon.isShadow ? pokemon.speciesId.replace(/_shadow$/, '') : `${pokemon.speciesId}_shadow`));
  return <fieldset className={`duel-build duel-side-${index}`}>
    <legend>Contender {index + 1}</legend>
    <PokemonCombobox showAll key={pokemon.speciesId} label={`Pokémon ${index + 1} / form`} options={catalog.entries.filter(entry => entry.fastMoves.length && entry.chargedMoves.length)} selected={pokemon} onSelect={select} />
    <div className="duel-build__identity"><PokemonSprite speciesId={pokemon.speciesId} speciesName={pokemon.speciesName} size="large" /><div><strong>{cp} CP</strong><p>{pokemon.types.join(' / ')}</p></div>
      {counterpart && <label className="duel-shadow"><input type="checkbox" checked={pokemon.isShadow} onChange={() => select(counterpart)} /> Shadow</label>}
    </div>
    <div className="duel-fields">
      <label><span>Fast move</span><select value={build.fastMoveId} onChange={event => update({ fastMoveId: event.target.value })}>{pokemon.fastMoves.map(move => <option key={move.id} value={move.id}>{move.name}{move.isElite || move.isLegacy ? ' *' : ''} · {move.turns} turns</option>)}</select></label>
      {[0, 1].map(slot => <label key={slot}><span>Charged move {slot + 1}</span><select value={build.chargedMoveIds[slot] ?? ''} onChange={event => {
        const ids = [...build.chargedMoveIds]; ids[slot] = event.target.value;
        update({ chargedMoveIds: ids[1] ? [ids[0]!, ids[1]] : [ids[0]!] });
      }}>{slot === 1 && <option value="">None</option>}{pokemon.chargedMoves.map(move => <option key={move.id} value={move.id}>{move.name}{move.isElite || move.isLegacy ? ' *' : ''} · {move.energy} energy</option>)}</select></label>)}
      <label><span>Shields</span><select value={value.shields} onChange={event => onChange({ ...value, shields: Number(event.target.value) as ShieldCount })}>{[0, 1, 2].map(count => <option key={count} value={count}>{count} shields</option>)}</select></label>
    </div>
    <details className="duel-advanced">
      <summary>Level &amp; IVs <span>Lv {build.level} · {build.ivs.attack}/{build.ivs.defense}/{build.ivs.hp}</span></summary>
      <div className="duel-ivs"><label><span>Level</span><input type="number" min={pokemon.levelFloor} max={Math.min(50, pokemon.levelCap)} step="0.5" value={build.level} onChange={event => update({ level: Number(event.target.value) })} /></label>{(['attack', 'defense', 'hp'] as const).map(stat => <label key={stat}><span>{stat === 'hp' ? 'HP IV' : `${stat} IV`}</span><input type="number" min="0" max="15" step="1" value={build.ivs[stat]} onChange={event => update({ ivs: { ...build.ivs, [stat]: Number(event.target.value) } })} /></label>)}</div>
      <button className="duel-fit" type="button" onClick={() => update({ level: fitDuelLevel(pokemon, build.ivs, league.cp) })}>Fit to league</button>
    </details>
    <small className="duel-move-note">* Elite / legacy move</small>
    {error && <p className="duel-error" role="alert">{error}</p>}
  </fieldset>;
}

function DuelWorkspace({ catalog }: { catalog: PokemonCatalog }) {
  const league = useLeague();
  const [combatants, setCombatants] = useState<[OneOnOneSimulationCombatant | undefined, OneOnOneSimulationCombatant | undefined]>([undefined, undefined]);
  const [result, setResult] = useState<OneOnOneSimulationResult>();
  const replayRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!result) return;
    replayRef.current?.focus({ preventScroll: true });
    replayRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [result]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frames = result?.replay ?? [];
  const frame = frames[cursor];
  const finished = frames.length > 0 && cursor === frames.length - 1;
  const names = combatants.map(value => value?.build.speciesName ?? 'Choose a Pokémon');
  const invalid = combatants.some(value => !value || duelBuildError(value.build, catalog.entries.find(entry => entry.speciesId === value.build.speciesId)!, league.cp));
  useEffect(() => {
    if (!playing || cursor >= frames.length - 1) return;
    const timer = window.setTimeout(() => setCursor(current => current + 1), playbackDelay(speed));
    return () => window.clearTimeout(timer);
  }, [playing, cursor, frames.length, speed]);
  async function simulate() {
    if (!combatants[0] || !combatants[1] || invalid) return;
    setBusy(true); setError(''); setPlaying(false);
    try {
      const response = await createPvpokeOneOnOneAdapter(catalog.dataVersion).simulate({
        format: { id: league.id, cpCap: league.cp, levelCap: 50, cup: league.cup },
        combatants: [combatants[0], combatants[1]].map(value => ({ ...value, build: { ...value.build, cp: calculateCombatPower(catalog.entries.find(entry => entry.speciesId === value.build.speciesId)!.baseStats, value.build.ivs, value.build.level) } })) as [OneOnOneSimulationCombatant, OneOnOneSimulationCombatant],
        dataVersion: catalog.dataVersion, captureReplay: true,
      });
      setResult(response); setCursor(0); setPlaying((response.replay?.length ?? 0) > 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Battle could not be simulated. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    <div className="duel-builds" aria-busy={busy}>
      {combatants.map((value, index) => {
        function change(next: OneOnOneSimulationCombatant | undefined) {
          setCombatants(current => index === 0 ? [next, current[1]] : [current[0], next]);
          setResult(undefined); setPlaying(false); setCursor(0); setError('');
        }
        return <div key={index} inert={busy}>
          {value ? <>
            <BuildEditor index={index} catalog={catalog} value={value} onChange={change} />
            <button className="duel-clear" type="button" onClick={() => change(undefined)}>Clear contender {index + 1}</button>
          </> : <fieldset className={`duel-build duel-side-${index}`}>
            <legend>Contender {index + 1}</legend>
            <PokemonCombobox showAll label={`Pokémon ${index + 1} / form`}
              options={catalog.entries.filter(entry => entry.fastMoves.length && entry.chargedMoves.length)}
              onSelect={pokemon => change({ build: defaultDuelBuild(pokemon, league.cp), shields: 1 })} />
            <p className="duel-selection-hint">Search or scroll through all Pokémon and forms to choose your contender.</p>
          </fieldset>}
        </div>;
      })}
    </div>
    <div className="duel-launch"><button className="button button--primary" type="button" disabled={busy || invalid} onClick={() => void simulate()}><Swords size={18} />{busy ? 'Simulating…' : 'Simulate matchup'}</button><span>{league.shortTitle} · Independent shield counts · Exact IVs</span></div>
    {error && <p role="alert" className="duel-error">{error}</p>}
    {frame && result ? <section ref={replayRef} tabIndex={-1} className="duel-replay" aria-label="Battle replay">
      <div className="duel-replay__heading"><div><p className="eyebrow">Battle playback</p><h2>{finished ? result.winner === 'tie' ? 'The matchup is a tie' : `${names[result.winner]} wins` : cursor === 0 ? 'Ready to battle' : `Turn ${frame.turn}`}</h2></div><span>{cursor} / {frames.length - 1} turns</span></div>
      <div className="duel-arena">{frame.combatants.map((state, index) => {
        const changes = turnChanges(state, frames[cursor - 1]?.combatants[index]);
        return <div className={`duel-fighter duel-side-${index}${state.hp === 0 ? ' duel-fighter--fainted' : ''}`} key={index}>
        <h3>{names[index]}</h3><div className="duel-fighter__sprite" key={`${cursor}-${index}`} data-shielding={frame.events.some(event => event.actor === index && event.type === 'shield')} data-attacking={frame.events.some(event => event.actor === index && /^(fast|charged)/.test(event.type))}><PokemonSprite speciesId={combatants[index]!.build.isShadow && !state.form.endsWith('_shadow') ? `${state.form}_shadow` : state.form} speciesName={names[index]!} size="hero" eager /></div>
        <label>HP <span className="duel-resource-value">{changes.hp !== 0 && <span key={`hp-${cursor}`} className="duel-delta duel-delta--damage" data-resource="hp">{changes.hp > 0 ? '+' : ''}{changes.hp} HP</span>}<strong>{state.hp} / {state.maximumHp}</strong></span><meter min="0" max={state.maximumHp} value={state.hp} aria-label={`${names[index]} HP`} /></label>
        <label>Energy <span className="duel-resource-value">{changes.energy !== 0 && <span key={`energy-${cursor}`} className={`duel-delta ${changes.energy > 0 ? 'duel-delta--gain' : 'duel-delta--spend'}`} data-resource="energy">{changes.energy > 0 ? '+' : ''}{changes.energy} energy</span>}<strong>{state.energy} / 100</strong></span><progress max="100" value={state.energy} aria-label={`${names[index]} energy`} /></label>
        <div className="duel-fighter__stats"><span>◈ {state.shields} shields</span><span>ATK {state.buffs[0] ?? 0} / DEF {state.buffs[1] ?? 0}</span></div>
        {finished && <p>Battle rating <strong>{result.combatants[index]!.battleRating}</strong> / 1000</p>}
      </div>;
      })}</div>
      <div className="duel-controls"><button type="button" aria-label="Restart replay" onClick={() => { setCursor(0); setPlaying(false); }}><RotateCcw size={18} /></button><button type="button" aria-label="Previous turn" disabled={cursor === 0} onClick={() => { setPlaying(false); setCursor(cursor - 1); }}><ChevronLeft size={18} /></button><button type="button" onClick={() => { if (finished) setCursor(0); setPlaying(!playing || finished); }}>{playing && !finished ? <Pause size={18} /> : <Play size={18} />}{playing && !finished ? 'Pause' : finished ? 'Replay' : 'Play'}</button><button type="button" aria-label="Next turn" disabled={finished} onClick={() => { setPlaying(false); setCursor(cursor + 1); }}><ChevronRight size={18} /></button><label><span>Speed</span><select value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}</select></label><button type="button" onClick={() => { setPlaying(false); setCursor(frames.length - 1); }}>Show result</button></div>
      <label className="duel-scrubber">Turn {frame.turn}<input aria-label="Battle turn" type="range" min="0" max={frames.length - 1} value={cursor} onChange={event => { setPlaying(false); setCursor(Number(event.target.value)); }} /></label>
      <section className="duel-log" aria-label="Turn log">
        <h3>Turn log <small>Latest first</small></h3>
        {cursor === 0 ? <p>Full HP, zero energy. Playback starts automatically; use the controls to pause or step through the battle.</p> :
          <ol aria-live={playing && !finished ? 'off' : 'polite'}>
            {frames.slice(1, cursor + 1).reverse().map(item => {
              const events = visibleBattleEvents(item.events);
              return <li key={item.turn} className="duel-log__turn" aria-current={item.turn === frame.turn ? 'step' : undefined}>
                <strong>Turn {item.turn}</strong>
                {events.length ? <ul>{events.map((event, index) => <li key={index}>{eventText(event, names)}</li>)}</ul> : <p>Moves in progress. No attack lands this turn.</p>}
              </li>;
            })}
          </ol>}
      </section>
    </section> : <div className="duel-empty"><Swords size={30} /><h2>See how the matchup unfolds</h2><p>Choose two Pokémon, customize their builds, then simulate to inspect every turn.</p></div>}
    <details className="duel-method"><summary>How this simulation works</summary><p>Uses the bundled PvPoke engine and its default move and shield decisions, including charged-move priority and default buff behavior. Results describe this simulated strategy, not every possible player decision. Each playback frame records the engine’s actual state after a turn, including turns without attacks. At 1×, playback advances two turns per second (500 ms per turn). Charged-attack minigame animations are condensed into their battle turn. Resource changes show the actual net HP and energy change for that turn.</p><p>Both Pokémon start at full HP and zero energy. No switching. Forms are selected in the Pokémon search; available Shadow variants have a toggle. Changing a form or Shadow variant resets its build to defaults. Levels are supported up to 50. Data version: {catalog.dataVersion}.</p></details>
  </>;
}

export function DuelPage() {
  const catalog = usePokemonCatalog();
  return <main className="page duel-page"><PageHeader eyebrow="Battle lab" title="One matchup. Every turn." description="Build a 1v1 matchup and watch the battle unfold, powered by PvPoke." />{catalog.error ? <p role="alert">Could not load Pokémon data. Reload the page to try again.</p> : catalog.data ? <DuelWorkspace catalog={catalog.data} /> : <p role="status">Loading Pokémon and moves…</p>}</main>;
}
