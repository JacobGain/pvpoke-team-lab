import { useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import { useLeague } from "@/features/leagues/leagueStore";
import { formatMoveList } from "@/utils/formatters";
import { useRosterReview } from "./updateReviewQueries";
import { reviewReminderKey, useReviewReminderStore } from "./reviewReminderStore";
import "./roster-review.css";

export function RosterUpdatePage() {
  const league = useLeague();
  const result = useRosterReview();
  const [showMinor, setShowMinor] = useState(false);
  const { reviewed, markReviewed } = useReviewReminderStore();
  const heading = <PageHeader title="What changed for my roster?" eyebrow={`${league.title} · Data update review`}
    back={{ to: "/inventory", label: "Inventory" }}
    description={<p>Review published ranking and move changes alongside your exact owned builds.</p>} />;

  if (result.isLoading) return <main className="inventory-page">{heading}<p role="status">Checking your roster against the latest battle data…</p></main>;
  if (result.error || !result.data || !result.comparison) return (
    <main className="inventory-page">{heading}<p className="inventory-error" role="alert">{result.error instanceof Error ? result.error.message : "Could not load the roster update review."}</p>
      <button type="button" className="secondary-button" onClick={result.retry}>Retry review</button></main>
  );
  const { records, teams } = result.data;
  const comparison = result.comparison;
  const changed = records.filter(record => record.changed);
  const significant = changed.filter(record => record.significant);
  const visible = [...(showMinor ? changed : significant)].sort((a, b) =>
    b.issues.length - a.issues.length || b.details.length - a.details.length || a.name.localeCompare(b.name),
  );
  const attentionTeams = teams.filter(team => team.status !== "current");
  const reminderKey = reviewReminderKey(comparison.fromCommit, comparison.toCommit ?? comparison.toVersion, league.id);
  const isReviewed = reviewed.includes(reminderKey);

  return (
    <main className="inventory-page roster-review-page">
      {heading}
      <section className="roster-review-summary" aria-label="Update comparison scope">
        <p><strong>{comparison.fromVersion.slice(0, 10)} → {comparison.toVersion.slice(0, 10)}</strong> · {league.title}</p>
        <p>{significant.length} {significant.length === 1 ? "build" : "builds"} with notable changes or validation issues · {attentionTeams.length} {attentionTeams.length === 1 ? "team" : "teams"} to review</p>
        <details className="roster-review-scope"><summary>How this comparison works</summary>
          <p>Comparisons cover these two published snapshots. Builds saved before the earlier date may have additional changes. Ranking movement alone does not predict a matchup result.</p>
          <p>Includes builds best suited to this league, unavailable records saved for this league, and all members of its saved teams. Switch leagues to review another format.</p>
        </details>
        <button className="secondary-button" type="button" disabled={isReviewed} onClick={() => markReviewed(reminderKey)}>
          {isReviewed ? "Update reminder dismissed" : "Dismiss this update reminder"}
        </button>
        <small>This hides the dashboard reminder for this format and update. Build issues and team analysis status stay visible here.</small>
      </section>

      <section aria-labelledby="roster-build-changes">
        <div className="section-heading"><h2 id="roster-build-changes">Owned Pokémon</h2>
          <label className="roster-review-filter"><input type="checkbox" checked={showMinor} onChange={event => setShowMinor(event.target.checked)} />Include rank shifts under 10 places ({changed.length - significant.length})</label>
        </div>
        {records.length === 0 ? <p>No owned builds to review in this format. <Link to="/inventory/new">Add a Pokémon</Link> or switch leagues.</p> :
          visible.length === 0 ? <p>{changed.length ? "No notable changes or invalid references found. Enable smaller ranking shifts to see the remaining changes." : "No published changes or invalid references found for these owned builds in this comparison."}</p> : null}
        <div className="roster-review-list">
          {visible.map(item => <article className="roster-review-card" key={item.record.inventoryId}>
            <div className="roster-review-card__heading">
              <PokemonSprite size="small" speciesId={item.speciesId} speciesName={item.name} />
              <div><h3>{item.name}</h3>
                <p>{item.record.buildStatus === "planned" ? `Planned from ${item.ownedName}` : "Current build"}{item.cp !== undefined ? ` · CP ${item.cp}` : " · Target CP not set"}</p>
                <small>{item.record.currentBuild.ivProfile.source === "assumed-rank-1" ? "Assumed IVs" : "Entered IVs"}: {item.record.currentBuild.ivProfile.ivs.attack}/{item.record.currentBuild.ivProfile.ivs.defense}/{item.record.currentBuild.ivProfile.ivs.hp}</small>
              </div>
              {item.issues.length > 0 ? <strong className="invalid-value">Needs repair</strong> : null}
            </div>
            {item.issues.length > 0 ? <ul className="invalid-value">{item.issues.map(message => <li key={message}>{message}</li>)}</ul> : null}
            {item.details.length > 0 ? <ul>{item.details.map(detail => <li key={`${detail.speciesId}/${detail.message}`}>{detail.name}: {detail.message}</li>)}</ul> : null}
            {item.rank ? <p className="roster-review-rank"><strong>{item.rank.before === null ? "Previously unranked" : `#${item.rank.before}`} → {item.rank.after === null ? "Now unranked" : `#${item.rank.after}`}</strong>
              {item.rank.before !== null && item.rank.after !== null && item.rank.before !== item.rank.after ? ` · ${Math.abs(item.rank.before - item.rank.after)} places ${item.rank.after < item.rank.before ? "up" : "down"}` : null}</p> : null}
            {item.recommendedChanged && item.rank ? <div><p>Previously recommended: {formatMoveList(item.rank.recommendedBefore)}</p><p>Now recommended: {formatMoveList(item.rank.recommendedAfter)}</p></div> : null}
            <div className="page-actions">
              <Link className="secondary-link" to={`/inventory/${item.record.inventoryId}`}>{item.issues.length ? "Repair build" : "Edit build"}</Link>
              {item.issues.length === 0 ? <Link className="secondary-link" to={`/inventory/${item.record.inventoryId}/analysis`}>Analyze build</Link> : null}
            </div>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="roster-team-changes"><h2 id="roster-team-changes">Saved teams</h2>
        <p>Fresh analysis is recommended after a data update even when your members have not changed: their opponents may have changed.</p>
        {attentionTeams.length === 0 ? <p>{teams.length ? "All saved teams have analysis recorded for the current data and unchanged builds." : "No saved teams in this format."}</p> : null}
        <div className="roster-review-list">{attentionTeams.map(item => <article className="roster-review-card" key={item.team.teamId}>
          <h3>{item.team.name}</h3>
          <p>{item.status === "repair" ? "Repair required before simulation." : item.status === "not-analyzed" ? "No completed analysis recorded yet." : item.membersEdited ? "A team member was edited since this team was analyzed." : `Analysis needs a refresh for the current upstream snapshot. Last recorded data: ${item.team.lastAnalyzedDataVersion}.`}</p>
          {item.changedMembers.length > 0 ? <p>{item.changedMembers.length} members have changes in this comparison.</p> : null}
          {item.issues.length ? <ul className="invalid-value">{item.issues.map(message => <li key={message}>{message}</li>)}</ul> : null}
          <Link className="secondary-link" to={item.status === "repair" ? `/teams/${item.team.teamId}` : `/teams/${item.team.teamId}/simulation`}>
            {item.status === "repair" ? "Repair team" : "Review and run team analysis"}
          </Link>
        </article>)}</div>
      </section>
    </main>
  );
}
