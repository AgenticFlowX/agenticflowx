/** Bounded navigation over the host-owned inventory; listing is not source evidence.
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-INSPECT] [DES-SEC]
 */
export function listBlueprintFiles(inventory: readonly string[], directory = ".", offset = 0) {
  if (
    directory !== "." &&
    (!directory ||
      directory.startsWith("/") ||
      directory.includes("\\") ||
      directory.split("/").some((part) => part === ".." || part === "."))
  )
    throw new Error("Use a repository-relative directory, or '.' for the root.");
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid inventory offset.");
  const prefix = directory === "." ? "" : `${directory.replace(/\/$/, "")}/`;
  const children = new Set<string>();
  for (const file of inventory) {
    if (!file.startsWith(prefix)) continue;
    const remainder = file.slice(prefix.length);
    const slash = remainder.indexOf("/");
    children.add(slash < 0 ? remainder : `${remainder.slice(0, slash)}/`);
  }
  const entries = [...children].sort();
  const page: string[] = [];
  let characters = 0;
  for (const entry of entries.slice(offset, offset + 80)) {
    if (page.length && characters + entry.length > 8000) break;
    page.push(entry);
    characters += entry.length;
  }
  return {
    directory,
    entries: page,
    total: entries.length,
    nextOffset: offset + page.length < entries.length ? offset + page.length : null,
  };
}

/** @see docs/specs/231-app-vscode-blueprint/design.md [DES-INSPECT] */
export function summarizeBlueprintInventory(inventory: readonly string[]): string {
  return JSON.stringify({
    fileCount: inventory.length,
    root: listBlueprintFiles(inventory),
    guidance:
      "Explore directories with list requests. This is a navigation index, not evidence. Read source to support findings. Explain representative architecture; an unread file is not automatically a coverage gap.",
  });
}
