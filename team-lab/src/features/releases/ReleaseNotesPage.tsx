import { PageHeader } from "@/components/PageHeader";
import { loadReleaseNotes } from "@/domain/releases/releaseNotes";
import "@/styles/modules/release-notes.css";

const releaseSources = import.meta.glob<string>("../../../docs/RELEASE-*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

const releaseNotes = loadReleaseNotes(releaseSources);

export function ReleaseNotesPage() {
  return (
    <main className="release-notes-page">
      <PageHeader
        description={
          <p>Recent changes and historical updates, with the latest release first.</p>
        }
        eyebrow="TeamLab updates"
        title="Release notes"
      />

      <section aria-label="Release history" className="release-notes-list">
        {releaseNotes.map((release) => {
          const releaseId = `release-${release.version.replaceAll(".", "-")}`;

          return (
            <article
              aria-labelledby={releaseId}
              className="release-note"
              key={release.version}
            >
              <header className="release-note__heading">
                <h2 id={releaseId}>Release v{release.version}</h2>
              </header>
              <div className="release-note__groups">
                {release.groups.map((group, index) => {
                  const groupId = `${releaseId}-group-${index + 1}`;

                  return (
                    <section
                      aria-labelledby={groupId}
                      className="release-note__group"
                      key={`${group.title}-${index}`}
                    >
                      <h3 id={groupId}>{group.title}</h3>
                      <ul>
                        {group.bullets.map((bullet, bulletIndex) => (
                          <li key={`${groupId}-item-${bulletIndex}`}>{bullet}</li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
