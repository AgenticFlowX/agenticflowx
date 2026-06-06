/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-13] [FR-18]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import { JSONCanvasParseError, parseJSONCanvas, serializeJSONCanvas } from "./json-canvas";

describe("json-canvas", () => {
  it("parses an empty file as an empty JSON Canvas", () => {
    expect(parseJSONCanvas("")).toEqual({ nodes: [], edges: [] });
  });

  it("round-trips Obsidian-authored fields without stripping them", () => {
    const raw = `{
  "unknownTop": "kept",
  "nodes": [
    {
      "id": "group-1",
      "type": "group",
      "x": 0,
      "y": 0,
      "width": 500,
      "height": 300,
      "label": "System",
      "backgroundStyle": "cover",
      "foreign": { "tool": "obsidian" }
    },
    {
      "id": "file-1",
      "type": "file",
      "file": "docs/spec.md",
      "subpath": "#requirements",
      "x": 40,
      "y": 50,
      "width": 320,
      "height": 200,
      "color": "6"
    },
    {
      "id": "link-1",
      "type": "link",
      "url": "https://jsoncanvas.org",
      "x": 380,
      "y": 60,
      "width": 260,
      "height": 120
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "fromNode": "file-1",
      "fromSide": "right",
      "fromEnd": "none",
      "toNode": "link-1",
      "toSide": "left",
      "toEnd": "arrow",
      "label": "source",
      "foreignEdge": true
    }
  ]
}`;

    const parsed = parseJSONCanvas(raw);
    const reparsed = JSON.parse(serializeJSONCanvas(parsed));

    expect(reparsed.unknownTop).toBe("kept");
    expect(reparsed.nodes[0].foreign).toEqual({ tool: "obsidian" });
    expect(reparsed.nodes[1].subpath).toBe("#requirements");
    expect(reparsed.nodes[2].type).toBe("link");
    expect(reparsed.edges[0]).toMatchObject({
      fromEnd: "none",
      toEnd: "arrow",
      foreignEdge: true,
    });
  });

  it("throws typed errors for malformed or invalid JSON Canvas", () => {
    expect(() => parseJSONCanvas("{")).toThrow(JSONCanvasParseError);
    expect(() => parseJSONCanvas(`{"nodes":[{"id":"missing-geometry","type":"text"}]}`)).toThrow(
      JSONCanvasParseError,
    );
    expect(() =>
      parseJSONCanvas(
        `{"nodes":[],"edges":[{"id":"bad","fromNode":"a","fromEnd":"dot","toNode":"b"}]}`,
      ),
    ).toThrow(JSONCanvasParseError);
  });
});
