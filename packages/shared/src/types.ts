/**
 * Shared domain types used by both the extension host and webviews.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-2] [FR-3]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-DOMAIN-TYPES]
 */

export type TaskStatus = "todo" | "in-progress" | "done" | "blocked";

export type SpecStatus = "draft" | "approved" | "living";

export type Mode = "spec" | "design" | "dev" | "check" | "report" | "session" | "task" | "discover";

/**
 * Workspace posture for the chat shell and settings snapshot.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-3] [FR-9] [FR-10]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-DOMAIN-TYPES]
 */
export type WorkspaceMode = "code" | "explore" | "spec";

export type Provider = "openai" | "anthropic" | "google" | "ollama" | "lmstudio" | "custom";

export interface TaskStats {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
}

export interface Feature {
  id: string;
  name: string;
  status: SpecStatus;
  owner?: string;
}

export interface Spec {
  id: string;
  name: string;
  status: SpecStatus;
  requirements: string[];
  nonGoals: string[];
  phases: Phase[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  phase: string;
  assignee?: string;
}

export interface Phase {
  id: string;
  name: string;
  tasks: Task[];
}

export interface Discussion {
  id: string;
  timestamp: string;
  status: "open" | "resolved" | "promoted";
  summary: string;
}
