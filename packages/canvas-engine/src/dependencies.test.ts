import { describe, expect, it } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import {
  dependencySuppressionKey,
  detachGeneratedDependencies,
  normalizeDetachedDependencyEdges,
  suppressesGeneratedDependency,
} from "./dependencies";

function fixture(): JSONCanvas {
  return {
    nodes: [],
    edges: [
      {
        id: "generated-a-b",
        fromNode: "a",
        toNode: "b",
        label: "depends on",
        custom: { keep: true },
        afxProvenance: {
          version: 1,
          kind: "declared-dependency",
          owner: "spec-a",
          detached: false,
        },
      },
    ],
  };
}

describe("dependency detach", () => {
  it("creates a fresh manual ID with durable suppression and preserves fields", () => {
    const source = fixture();
    const detached = detachGeneratedDependencies(source, ["generated-a-b"]);
    const edge = detached.edges?.[0];

    expect(edge).toMatchObject({
      id: "generated-a-b:manual",
      label: "depends on",
      custom: { keep: true },
      afxProvenance: {
        detached: true,
        generatedEdgeId: "generated-a-b",
        suppressionKey: dependencySuppressionKey("spec-a", "generated-a-b"),
      },
    });
    expect(edge && suppressesGeneratedDependency(edge, "generated-a-b")).toBe(true);
    expect(source).toEqual(fixture());
  });

  it("allocates without collisions and stays idempotent", () => {
    const source = fixture();
    source.edges?.push({ id: "generated-a-b:manual", fromNode: "x", toNode: "y" });
    const once = detachGeneratedDependencies(source, ["generated-a-b"]);
    expect(once.edges?.[0]?.id).toBe("generated-a-b:manual:2");
    expect(detachGeneratedDependencies(once, ["generated-a-b:manual:2"])).toBe(once);
  });

  it("migrates the legacy same-ID detached shape exactly once", () => {
    const source = fixture();
    source.edges![0]!.afxProvenance = { ...source.edges![0]!.afxProvenance!, detached: true };
    const migrated = normalizeDetachedDependencyEdges(source);
    expect(migrated[0]).toMatchObject({
      id: "generated-a-b:manual",
      afxProvenance: { generatedEdgeId: "generated-a-b", detached: true },
    });
    expect(normalizeDetachedDependencyEdges({ ...source, edges: migrated })).toEqual(migrated);
  });
});
