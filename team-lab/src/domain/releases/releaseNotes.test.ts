import { describe, expect, it } from "vitest";

import { loadReleaseNotes, parseReleaseNote } from "@/domain/releases/releaseNotes";

const actualReleaseSources = import.meta.glob<string>("../../../docs/RELEASE-*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

describe("release notes", () => {
  it("sorts releases newest first by numeric version", () => {
    const releases = loadReleaseNotes({
      "RELEASE-0.0.9.md": "# Release v0.0.9\n\n## Earlier\n- Earlier release.",
      "RELEASE-1.0.0.md": "# Release v1.0.0\n\n## Launch\n- First stable release.",
      "RELEASE-0.0.10.md": "# Release v0.0.10\n\n## Polish\n- Sprite updates.",
    });

    expect(releases.map((release) => release.version)).toEqual([
      "1.0.0",
      "0.0.10",
      "0.0.9",
    ]);
  });

  it("keeps change groups and bullet points separate", () => {
    const release = parseReleaseNote(
      "docs/RELEASE-1.2.0.md",
      "# Release v1.2.0\n\n## What-if changes\n- Compare a swap.\n\n## Team recommendations\n- Show move suggestions.",
    );

    expect(release.groups).toEqual([
      { title: "What-if changes", bullets: ["Compare a swap."] },
      { title: "Team recommendations", bullets: ["Show move suggestions."] },
    ]);
  });

  it("rejects a file whose name and release heading disagree", () => {
    expect(() =>
      parseReleaseNote(
        "docs/RELEASE-1.2.0.md",
        "# Release v1.1.2\n\n## Changes\n- A change.",
      ),
    ).toThrow(/must start with/);
  });

  it("rejects an empty release group", () => {
    expect(() =>
      parseReleaseNote(
        "docs/RELEASE-1.2.0.md",
        "# Release v1.2.0\n\n## Changes\n\n## Another group\n- A change.",
      ),
    ).toThrow(/change groups with bullet points/);
  });

  it("parses the release-note archive and puts the current 1.2.2 release first", () => {
    const releases = loadReleaseNotes(actualReleaseSources);

    expect(releases[0]?.version).toBe("1.2.2");
    expect(releases[0]?.groups.length).toBeGreaterThan(0);
    expect(releases[0]?.groups.every((group) => group.bullets.length > 0)).toBe(true);
  });
});
