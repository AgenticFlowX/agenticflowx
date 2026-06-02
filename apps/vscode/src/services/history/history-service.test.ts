/**
 * @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [NFR-6] [NFR-9]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-TEST]
 */
import { describe, expect, it, vi } from "vitest";

import type { AgentManager, AgentSessionInfo, Logger } from "@afx/shared";

import { HistoryService } from "./history-service";

const logger = {
  child: () => logger,
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
} as unknown as Logger;

function makeManager(over: Partial<AgentManager>): AgentManager {
  return over as unknown as AgentManager;
}

const SESSION: AgentSessionInfo = {
  id: "s1",
  path: "/p/s1.jsonl",
  messageCount: 3,
  createdAt: 1,
  updatedAt: 2,
};

describe("HistoryService", () => {
  it("returns supported:false when the runtime has no listSessions", async () => {
    const svc = new HistoryService(makeManager({}), logger);
    expect(await svc.listSessions()).toEqual({ supported: false, sessions: [] });
  });

  it("returns supported:false when listSessions throws (external runtime)", async () => {
    const svc = new HistoryService(
      makeManager({ listSessions: vi.fn().mockRejectedValue(new Error("unsupported")) }),
      logger,
    );
    expect(await svc.listSessions()).toEqual({ supported: false, sessions: [] });
  });

  it("reads the list fresh on every call (no caching)", async () => {
    const listSessions = vi.fn().mockResolvedValue([SESSION]);
    const svc = new HistoryService(makeManager({ listSessions }), logger);
    expect(await svc.listSessions()).toEqual({ supported: true, sessions: [SESSION] });
    await svc.listSessions();
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it("delegates delete to the runtime", async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    const svc = new HistoryService(makeManager({ deleteSession }), logger);
    await svc.deleteSession("/p/s1.jsonl");
    expect(deleteSession).toHaveBeenCalledWith("/p/s1.jsonl");
  });

  it("getTranscript returns [] when the runtime errors", async () => {
    const svc = new HistoryService(
      makeManager({ getTranscript: vi.fn().mockRejectedValue(new Error("x")) }),
      logger,
    );
    expect(await svc.getTranscript("/p/s1.jsonl")).toEqual([]);
  });
});
