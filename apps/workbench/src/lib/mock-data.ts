/**
 * Mock data for workbench development.
 * This data simulates what the extension would send via afxUpdate messages.
 *
 * Based on real data from a representative AFX-tracked project.
 */
import type {
  DocumentRow,
  FeatureTasksData,
  GhostTaskResult,
  JournalEntry,
  KanbanData,
  PipelineRow,
  QuickNote,
} from "@afx/shared";

export const MOCK_PIPELINE: PipelineRow[] = [
  {
    name: "15-infrastructure",
    specStatus: "Living",
    designStatus: "Living",
    tasksStatus: "Complete",
    completed: 24,
    total: 24,
    featureStatus: "Complete",
    specPath: "docs/specs/15-infrastructure/spec.md",
    designPath: "docs/specs/15-infrastructure/design.md",
    tasksPath: "docs/specs/15-infrastructure/tasks.md",
    specLastVerified: new Date(Date.now() - 7 * 86400000).toISOString(),
    designLastVerified: new Date(Date.now() - 7 * 86400000).toISOString(),
    tasksLastVerified: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    name: "16-marketplace-asset-recovery",
    specStatus: "Approved",
    designStatus: "Draft",
    tasksStatus: "In Progress",
    completed: 8,
    total: 15,
    featureStatus: "In Progress",
    specPath: "docs/specs/16-marketplace-asset-recovery/spec.md",
    designPath: "docs/specs/16-marketplace-asset-recovery/design.md",
    tasksPath: "docs/specs/16-marketplace-asset-recovery/tasks.md",
    specLastVerified: new Date(Date.now() - 2 * 86400000).toISOString(),
    designLastVerified: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    name: "19-marketplace-listings",
    specStatus: "Draft",
    designStatus: "Draft",
    tasksStatus: "Not Started",
    completed: 0,
    total: 20,
    featureStatus: "Not Started",
    specPath: "docs/specs/19-marketplace-listings/spec.md",
    designPath: "docs/specs/19-marketplace-listings/design.md",
    tasksPath: "docs/specs/19-marketplace-listings/tasks.md",
  },
];

export const MOCK_FEATURE_TASKS: FeatureTasksData[] = [
  {
    name: "15-infrastructure",
    tasksPath: "docs/specs/15-infrastructure/tasks.md",
    completed: 24,
    total: 24,
    phases: [
      {
        number: 1,
        name: "Setup",
        completed: 5,
        total: 5,
        line: 10,
        items: [
          { text: "Initialize NX monorepo", completed: true, line: 12 },
          { text: "Configure AWS credentials", completed: true, line: 13 },
          { text: "Set up Amplify", completed: true, line: 14 },
          { text: "Configure DynamoDB schemas", completed: true, line: 15 },
          { text: "Set up CI/CD pipeline", completed: true, line: 16 },
        ],
      },
      {
        number: 2,
        name: "Core Infrastructure",
        completed: 19,
        total: 19,
        line: 30,
        items: [
          { text: "Implement RDS PostgreSQL setup", completed: true, line: 32 },
          { text: "Configure Amplify branches", completed: true, line: 33 },
          { text: "Set up DynamoDB tables", completed: true, line: 34 },
          { text: "Implement seeding scripts", completed: true, line: 35 },
          { text: "Document deployment steps", completed: true, line: 36 },
        ],
      },
    ],
    workSessions: [
      {
        date: new Date(Date.now() - 7 * 86400000).toISOString(),
        task: "Infrastructure completion",
        action: "Final deployment documentation",
        filesModified: "docs/specs/15-infrastructure/",
        agent: true,
        human: false,
      },
      {
        date: new Date(Date.now() - 14 * 86400000).toISOString(),
        task: "DynamoDB setup",
        action: "Provisioned tables and seeding scripts",
        filesModified: "packages/db/src/adapters/dynamodb/",
        agent: true,
        human: true,
      },
    ],
  },
  {
    name: "16-marketplace-asset-recovery",
    tasksPath: "docs/specs/16-marketplace-asset-recovery/tasks.md",
    completed: 8,
    total: 15,
    phases: [
      {
        number: 1,
        name: "Planning",
        completed: 3,
        total: 3,
        line: 10,
        items: [
          { text: "Define recovery workflow", completed: true, line: 12 },
          { text: "Design API endpoints", completed: true, line: 13 },
          { text: "Plan UI components", completed: true, line: 14 },
        ],
      },
      {
        number: 2,
        name: "Implementation",
        completed: 5,
        total: 12,
        line: 25,
        items: [
          { text: "Implement recovery service", completed: true, line: 27 },
          { text: "Create API routes", completed: true, line: 28 },
          { text: "Add recovery dashboard", completed: true, line: 29 },
          { text: "Implement notifications", completed: true, line: 30 },
          { text: "Add audit logging", completed: true, line: 31 },
          { text: "Write tests", completed: false, line: 32 },
          { text: "Documentation", completed: false, line: 33 },
        ],
      },
    ],
    workSessions: [
      {
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        task: "Recovery service",
        action: "Implemented core recovery logic",
        filesModified: "packages/db/src/services/recovery.ts",
        agent: true,
        human: false,
      },
    ],
  },
];

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export const MOCK_JOURNAL: JournalEntry[] = [
  // Today
  {
    id: "AR-D003",
    date: ago(0),
    title: "Recovery pagination — cursor vs offset decision",
    status: "active",
    feature: "16-marketplace-asset-recovery",
    filePath: "docs/specs/16-marketplace-asset-recovery/journal.md",
    line: 150,
    context:
      "Deciding pagination strategy for the recovery list endpoint before FR-7 implementation.",
    summary:
      "Cursor-based pagination chosen for the recovery list. Offset pagination creates drift when items are inserted mid-page during long polls.",
    decisions: ["Cursor-based pagination (not offset)", "Cursor encoded as base64 ISO timestamp"],
  },
  // Yesterday
  {
    id: "AR-D002",
    date: ago(1),
    title: "Recovery API Endpoints",
    status: "active",
    feature: "16-marketplace-asset-recovery",
    filePath: "docs/specs/16-marketplace-asset-recovery/journal.md",
    line: 100,
    context: "Defining REST API shape for asset recovery before implementation sprint.",
    summary:
      "Settled on POST /api/recover for initiating recovery and GET /api/recover/:id for status polling. Webhook notification on completion.",
    decisions: [
      "POST /api/recover initiates, GET /api/recover/:id polls",
      "Webhook on completion (not polling-only)",
    ],
  },
  // 3 days ago
  {
    id: "AR-D001",
    date: ago(3),
    title: "Asset Recovery Dashboard Design",
    status: "active",
    feature: "16-marketplace-asset-recovery",
    filePath: "docs/specs/16-marketplace-asset-recovery/journal.md",
    line: 10,
    context: "Kicking off dashboard design for the asset recovery feature.",
    summary:
      "Agreed on a card-based layout with per-asset status indicators. Bulk actions deferred to v2 milestone.",
    decisions: ["Card-based layout", "Bulk actions deferred to v2"],
  },
  // 1 week ago
  {
    id: "INF-D002",
    date: ago(7),
    title: "DynamoDB Provisioning & Seeding PRD Updates",
    status: "closed",
    feature: "15-infrastructure",
    filePath: "docs/specs/15-infrastructure/journal.md",
    line: 50,
    context: "Updating infrastructure PRD files for DynamoDB table provisioning and seeding.",
    summary:
      "Completed PRD documentation for two-phase DynamoDB provisioning approach. Phase 1 consolidates schemas and uses AWS CLI parameter overrides.",
    decisions: [
      "TypeScript via ElectroDB for seeding (not AWS CLI batch-write-item)",
      "Phase 2 (CDK) tasks deferred",
    ],
  },
  // 2 weeks ago
  {
    id: "INF-D001",
    date: ago(14),
    title: "Warranty Claims Dev Deployment",
    status: "closed",
    feature: "15-infrastructure",
    filePath: "docs/specs/15-infrastructure/journal.md",
    line: 10,
    context: "First deployment of warranty-claims feature to dev environment.",
    summary:
      "Deployed warranty-claims branch to dev. RDS PostgreSQL provisioned; local environment connected successfully.",
  },
  // 3 weeks ago
  {
    id: "AUTH-D001",
    date: ago(21),
    title: "Session token storage — compliance review",
    status: "closed",
    feature: "12-auth",
    filePath: "docs/specs/12-auth/journal.md",
    line: 10,
    context: "Legal flagged session token storage approach for compliance review.",
    summary:
      "Existing session token storage does not meet new compliance requirements. Auth middleware rewrite scheduled. Scope favours compliance over DX ergonomics.",
    decisions: [
      "Auth middleware rewrite required",
      "Scope: compliance > ergonomics",
      "Migration must be zero-downtime",
    ],
  },
  // ~2 months ago
  {
    id: "CHAT-D001",
    date: ago(55),
    title: "Chat streaming architecture — SDK vs RPC",
    status: "closed",
    feature: "10-chat",
    filePath: "docs/specs/10-chat/journal.md",
    line: 10,
    context: "Evaluating whether chat streaming goes through Pi RPC or via SDK directly.",
    summary:
      "SDK path chosen for streaming — avoids subprocess framing overhead and gives direct access to the provider event stream. Pi RPC retained for CLI-mode session continuity.",
    decisions: [
      "SDK streaming for API providers",
      "Pi RPC retained for CLI agent sessions",
      "Transport abstraction hides the difference from chat UI",
    ],
  },
  // ~6 months ago
  {
    id: "INFRA-D001",
    date: ago(180),
    title: "Monorepo workspace structure decision",
    status: "closed",
    feature: "00-setup",
    filePath: "docs/specs/00-setup/journal.md",
    line: 10,
    context: "Initial architecture session — choosing monorepo structure for the v2 rewrite.",
    summary:
      "pnpm workspaces + Turbo chosen over Nx. Simpler mental model for a team this size; Turbo caching covers the build performance gap.",
    decisions: [
      "pnpm workspaces (not Yarn/npm)",
      "Turbo for build orchestration",
      "No Nx — overhead not justified at current scale",
    ],
  },
];

export const MOCK_KANBAN: KanbanData = {
  dirPath: ".afx/kanban",
  boards: [
    {
      name: "Backlog",
      filePath: ".afx/kanban/backlog.md",
      meta: {
        title: "Backlog",
        status: "active",
      },
      columns: [
        {
          title: "Backlog",
          cards: [
            { text: "Review task creation template" },
            { text: "Task template strict templating" },
            { text: "Cross-spec deps tracking" },
          ],
        },
        {
          title: "Todo",
          cards: [{ text: "Revisit Amplify Service Role" }],
        },
        {
          title: "In Progress",
          cards: [{ text: "OAuth integration" }],
        },
        {
          title: "Review",
          cards: [],
        },
        {
          title: "Done",
          cards: [{ text: "Redesign document panel" }, { text: "Improve landing page" }],
        },
      ],
    },
  ],
};

export const MOCK_NOTES: QuickNote[] = [
  {
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    time: "2:30:15 PM",
    displayTime: "2:30:15 PM",
    date: new Date().toISOString().split("T")[0] ?? "",
    text: "Remember to add error boundaries to the chat component",
  },
  {
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    time: "1:00:00 PM",
    displayTime: "1:00:00 PM",
    date: new Date().toISOString().split("T")[0] ?? "",
    text: "The streaming implementation needs more testing with large messages",
  },
  {
    timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
    time: "3:45:00 PM",
    displayTime: "3:45:00 PM",
    date: new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0] ?? "",
    text: "Found a memory leak in the message history hook - needs investigation",
  },
  {
    timestamp: new Date(Date.now() - 9 * 86400000).toISOString(),
    time: "10:15:30 AM",
    displayTime: "10:15:30 AM",
    date: new Date(Date.now() - 9 * 86400000).toISOString().split("T")[0] ?? "",
    text: "Consider adding keyboard shortcuts for common actions",
  },
];

export const MOCK_DOCUMENTS: DocumentRow[] = [
  {
    type: "SPEC",
    name: "Infrastructure",
    status: "Living",
    owner: "@rixrix",
    filePath: "docs/specs/15-infrastructure/spec.md",
    isAfx: true,
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    excerpt: "AWS infrastructure including RDS, DynamoDB, Amplify deployment...",
  },
  {
    type: "SPEC",
    name: "Asset Recovery",
    status: "Approved",
    owner: "@rixrix",
    filePath: "docs/specs/16-marketplace-asset-recovery/spec.md",
    isAfx: true,
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    excerpt: "Marketplace asset recovery workflow for expired listings...",
  },
  {
    type: "DESIGN",
    name: "Infrastructure Design",
    status: "Living",
    owner: "@rixrix",
    filePath: "docs/specs/15-infrastructure/design.md",
    isAfx: true,
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    excerpt: "DynamoDB schema, RDS setup, Amplify configuration...",
  },
  {
    type: "TASKS",
    name: "Infrastructure Tasks",
    status: "Complete",
    owner: "@rixrix",
    filePath: "docs/specs/15-infrastructure/tasks.md",
    isAfx: true,
    updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    excerpt: "Phase 1: Setup, Phase 2: Core Infrastructure...",
  },
];

export const MOCK_GHOST_TASKS: GhostTaskResult = {
  count: 1,
  items: [
    {
      feature: "16-marketplace-asset-recovery",
      task: "Implement email notifications",
      target: "notifications service not found",
    },
  ],
};

export const MOCK_WORKBENCH_STATE = {
  pipeline: MOCK_PIPELINE,
  featureTasks: MOCK_FEATURE_TASKS,
  documents: MOCK_DOCUMENTS,
  journal: MOCK_JOURNAL,
  kanban: MOCK_KANBAN,
  notes: MOCK_NOTES,
  notesFilePath: ".afx/notes.md",
  ghostTasks: MOCK_GHOST_TASKS,
  selectedFeature: "15-infrastructure",
  isLoading: false,
};
