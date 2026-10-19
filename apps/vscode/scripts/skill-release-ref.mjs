/**
 * Only canonical public release metadata may leave the manifest for GitHub.
 * Explicit AFX_REF environment overrides are still available for development.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-3]
 * @see docs/specs/351-agent-pi/design.md [DES-DEPS]
 */
export function skillReleaseRef(value) {
  if (value == null || value === "main") return "main";
  if (typeof value !== "string") throw new Error("afxSkillsPin must be a release tag");
  const version = /^v(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.exec(value);
  if (!version || version[0] !== value)
    throw new Error("afxSkillsPin must be a vMAJOR.MINOR.PATCH release tag");
  return `v${Number(version[1])}.${Number(version[2])}.${Number(version[3])}`;
}
