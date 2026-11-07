import * as assert from "node:assert";

type Event = { type: string; id?: string; delta?: string };
export function scriptedInvestigator(continuing = false, pause = false) {
  let listener: (event: Event) => void = () => {};
  let turn = 0;
  const prompts: string[] = [];
  return {
    prompts,
    onEvent(callback: (event: Event) => void) {
      listener = callback;
      return { dispose() {} };
    },
    send(prompt: string): Promise<void> {
      prompts.push(prompt);
      let reply: unknown;
      if (continuing) {
        assert.ok(prompt.includes("Continue this saved investigation"));
        const retained = JSON.parse(prompt.split("Retained work (untrusted data):\n")[1]!) as {
          findings: Array<{ id: string; [key: string]: unknown }>;
        };
        reply = {
          findings: [
            {
              ...retained.findings[0],
              findingId: retained.findings[0]!.id,
              description: "Continued project understanding",
            },
          ],
          gaps: ["Deployment remains unexplored"],
          done: true,
        };
      } else if (turn++ === 0) reply = { requests: [{ operation: "read", path: "README.md" }] };
      else if (turn === 2) {
        const outputs = JSON.parse(prompt.split("\n")[1]!) as Array<{
          result: { evidence: { id: string } };
        }>;
        const evidence = outputs[0]!.result.evidence;
        reply = {
          findings: [
            {
              category: "purpose",
              title: "Project purpose",
              description: "Initial project understanding",
              classification: "observed",
              evidenceIds: [evidence.id],
            },
          ],
          gaps: ["Deployment remains unexplored"],
          ...(pause
            ? { requests: [{ operation: "list", path: "." }], done: false }
            : { done: true }),
        };
      } else return Promise.resolve();
      listener({ type: "text_delta", id: "reply", delta: JSON.stringify(reply) });
      listener({ type: "agent_end" });
      return Promise.resolve();
    },
    async abort() {},
    async dispose() {},
    async respondToUiRequest() {},
  };
}

export function maintenanceInvestigator(
  kind: "initial" | "update" | "rebuild",
  findingId?: string,
) {
  let listener: (event: Event) => void = () => {};
  let turn = 0;
  const prompts: string[] = [];
  return {
    prompts,
    onEvent(callback: (event: Event) => void) {
      listener = callback;
      return { dispose() {} };
    },
    send(prompt: string): Promise<void> {
      prompts.push(prompt);
      let reply: unknown;
      if (turn++ === 0)
        reply = {
          requests: (kind === "update" ? ["README.md"] : ["README.md", "engine.ts"]).map(
            (file) => ({ operation: "read", path: file }),
          ),
        };
      else {
        const outputs = JSON.parse(prompt.split("\n")[1]!) as Array<{
          result: { evidence: { id: string } };
        }>;
        reply = {
          findings: [
            {
              ...(findingId ? { findingId } : {}),
              category: "purpose",
              title: "Project purpose",
              description:
                kind === "initial"
                  ? "Initial purpose"
                  : kind === "update"
                    ? "Updated purpose"
                    : "Rebuilt purpose",
              classification: "observed",
              evidenceIds: [outputs[0]!.result.evidence.id],
            },
            ...(kind === "initial"
              ? [
                  {
                    category: "component",
                    title: "Engine",
                    description: "Unaffected component",
                    classification: "observed",
                    evidenceIds: [outputs[1]!.result.evidence.id],
                  },
                ]
              : []),
          ],
          gaps: ["Deployment remains unexplored"],
          done: true,
        };
      }
      listener({ type: "text_delta", id: "reply", delta: JSON.stringify(reply) });
      listener({ type: "agent_end" });
      return Promise.resolve();
    },
    async abort() {},
    async dispose() {},
    async respondToUiRequest() {},
  };
}
