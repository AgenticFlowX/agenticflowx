/**
 * Safe, finite icon vocabulary for optional Canvas semantic metadata.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-33] [FR-38]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI]
 */
import {
  Boxes,
  CircleHelp,
  Cloud,
  Database,
  FileText,
  GitBranch,
  LayoutDashboard,
  Network,
  Server,
  ShieldCheck,
  StickyNote,
  UserRound,
} from "lucide-react";

const ICONS = {
  board: LayoutDashboard,
  cloud: Cloud,
  component: Boxes,
  database: Database,
  decision: GitBranch,
  file: FileText,
  network: Network,
  note: StickyNote,
  server: Server,
  "server-2": Server,
  shield: ShieldCheck,
  user: UserRound,
} as const;

export interface CanvasSemanticIconProps {
  name?: string;
  className?: string;
}

export function CanvasSemanticIcon({ name, className }: CanvasSemanticIconProps) {
  const Icon = name && name in ICONS ? ICONS[name as keyof typeof ICONS] : CircleHelp;
  return <Icon data-canvas-icon={name ?? "unknown"} aria-hidden size={12} className={className} />;
}

export function isKnownCanvasSemanticIcon(name: string | undefined): boolean {
  return Boolean(name && name in ICONS);
}

export const CANVAS_SEMANTIC_ICON_NAMES = Object.freeze(Object.keys(ICONS));
