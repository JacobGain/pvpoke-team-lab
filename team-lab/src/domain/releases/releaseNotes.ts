export interface ReleaseNoteGroup {
  readonly title: string;
  readonly bullets: readonly string[];
}

export interface ReleaseNote {
  readonly version: string;
  readonly groups: readonly ReleaseNoteGroup[];
}

const releaseHeadingPattern = /^# Release v(\d+\.\d+\.\d+)$/;
const releaseFilePattern = /(?:^|\/)RELEASE-(\d+\.\d+\.\d+)\.md$/;

export function parseReleaseNote(
  sourcePath: string,
  markdown: string,
): ReleaseNote {
  const sourceVersion = sourcePath.match(releaseFilePattern)?.[1];
  const lines = markdown.trim().replaceAll("\r\n", "\n").split("\n");
  const headingVersion = lines[0]?.match(releaseHeadingPattern)?.[1];

  if (!sourceVersion || !headingVersion || sourceVersion !== headingVersion) {
    throw new Error(
      `Release note ${sourcePath} must start with "# Release v${sourceVersion ?? "X.Y.Z"}".`,
    );
  }

  const groups: { title: string; bullets: string[] }[] = [];
  let activeGroup: { title: string; bullets: string[] } | undefined;

  for (const [index, line] of lines.slice(1).entries()) {
    if (line.trim().length === 0) continue;

    const groupHeading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (groupHeading) {
      activeGroup = { title: groupHeading, bullets: [] };
      groups.push(activeGroup);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!activeGroup) {
        throw new Error(
          `Release note ${sourcePath}:${index + 2} has a bullet before a change group.`,
        );
      }
      const bullet = line.slice(2).trim();
      if (!bullet) {
        throw new Error(
          `Release note ${sourcePath}:${index + 2} has an empty bullet.`,
        );
      }
      activeGroup.bullets.push(bullet);
      continue;
    }

    if (line.startsWith("  ") && activeGroup?.bullets.length) {
      const lastBulletIndex = activeGroup.bullets.length - 1;
      activeGroup.bullets[lastBulletIndex] =
        `${activeGroup.bullets[lastBulletIndex]} ${line.trim()}`;
      continue;
    }

    throw new Error(
      `Release note ${sourcePath}:${index + 2} must use a group heading or bullet.`,
    );
  }

  if (groups.length === 0 || groups.some((group) => group.bullets.length === 0)) {
    throw new Error(
      `Release note ${sourcePath} must contain change groups with bullet points.`,
    );
  }

  return { version: headingVersion, groups };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

export function loadReleaseNotes(
  sources: Readonly<Record<string, string>>,
): readonly ReleaseNote[] {
  const releases = Object.entries(sources).map(([sourcePath, markdown]) =>
    parseReleaseNote(sourcePath, markdown),
  );
  const seenVersions = new Set<string>();

  for (const release of releases) {
    if (seenVersions.has(release.version)) {
      throw new Error(`Release v${release.version} is listed more than once.`);
    }
    seenVersions.add(release.version);
  }

  return releases.sort((left, right) =>
    compareVersions(right.version, left.version),
  );
}
