/**
 * Parse a Delta Green system version string into comparable parts.
 * Supports MAJOR.MINOR.PATCH with optional -betaN suffix.
 * @param {string|null|undefined} version
 * @returns {{ major: number, minor: number, patch: number, beta: number|null, raw: string }|null}
 */
export function parseSystemVersion(version) {
  const raw = String(version ?? "").trim();
  if (!raw || raw === "dev") return null;

  const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta(\d+))?$/i.exec(raw);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: match[4] != null ? Number(match[4]) : null,
    raw,
  };
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {-1|0|1}
 */
export function compareSystemVersions(a, b) {
  const parsedA = parseSystemVersion(a);
  const parsedB = parseSystemVersion(b);

  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;

  for (const key of ["major", "minor", "patch"]) {
    if (parsedA[key] !== parsedB[key]) {
      return parsedA[key] < parsedB[key] ? -1 : 1;
    }
  }

  const betaA = parsedA.beta;
  const betaB = parsedB.beta;

  if (betaA == null && betaB == null) return 0;
  if (betaA == null) return 1;
  if (betaB == null) return -1;
  if (betaA === betaB) return 0;
  return betaA < betaB ? -1 : 1;
}

/**
 * True when version is at least the minimum (inclusive of betas for same major.minor.patch).
 * @param {string|null|undefined} version
 * @param {string} minimum
 * @returns {boolean}
 */
export function isAtLeastVersion(version, minimum) {
  return compareSystemVersions(version, minimum) >= 0;
}
