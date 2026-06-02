/**
 * Host-side history service. Wraps the active `AgentManager` session methods and
 * maps "runtime has no session store" (the multiplexer rejects for external
 * harnesses) to a `supported: false` result for the webview.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [NFR-6] [NFR-9]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-STORE] [DES-PERSISTENT-FLOW]
 */
import type { AgentManager, AgentSessionInfo, AgentTranscriptEntry, Logger } from "@afx/shared";

export interface SessionListResult {
  /** False when the active runtime has no session store (external harness). */
  supported: boolean;
  sessions: AgentSessionInfo[];
}

export class HistoryService {
  private readonly log: Logger;

  constructor(
    private readonly manager: AgentManager,
    logger: Logger,
  ) {
    this.log = logger.child("history");
  }

  /** List persisted sessions for the active runtime (always reads fresh). */
  async listSessions(opts?: { allWorkspaces?: boolean }): Promise<SessionListResult> {
    if (!this.manager.listSessions) {
      return { supported: false, sessions: [] };
    }
    try {
      const sessions = await this.manager.listSessions(
        opts?.allWorkspaces ? { allWorkspaces: true } : undefined,
      );
      this.log.info("listSessions", { count: sessions.length });
      return { supported: true, sessions };
    } catch (err) {
      this.log.warn(
        `listSessions unsupported/failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { supported: false, sessions: [] };
    }
  }

  /** Load a past session's transcript (read-only). */
  async getTranscript(sessionPath: string): Promise<AgentTranscriptEntry[]> {
    if (!this.manager.getTranscript) return [];
    try {
      return await this.manager.getTranscript(sessionPath);
    } catch (err) {
      this.log.error("getTranscript failed", err instanceof Error ? err : undefined);
      return [];
    }
  }

  /** Rename the currently-loaded session. */
  async setSessionName(name: string): Promise<void> {
    if (!this.manager.setSessionName) return;
    await this.manager.setSessionName(name);
  }

  /** Delete a persisted session by path. */
  async deleteSession(sessionPath: string): Promise<void> {
    if (!this.manager.deleteSession) return;
    await this.manager.deleteSession(sessionPath);
  }
}
