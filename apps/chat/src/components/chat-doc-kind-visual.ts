/**
 * Shared visual treatment for AFX document kinds in chat composer surfaces.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/220-app-workbench/design.md
 */
import {
  BookOpen,
  Boxes,
  FileText,
  FlaskConical,
  GitBranch,
  Lightbulb,
  StickyNote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ActiveDocCtx } from "../lib/doc-actions";

export function docKindVisual(docKind: ActiveDocCtx["docKind"]): {
  icon: LucideIcon;
  accent: string;
} {
  switch (docKind) {
    case "spec":
      return { icon: StickyNote, accent: "text-afx-brand" };
    case "design":
      return { icon: FileText, accent: "text-purple-400" };
    case "tasks":
      return { icon: GitBranch, accent: "text-afx-success" };
    case "journal":
      return { icon: BookOpen, accent: "text-amber-400" };
    case "adr":
      return { icon: Lightbulb, accent: "text-blue-400" };
    case "research":
      return { icon: FlaskConical, accent: "text-muted-foreground" };
    case "context":
      return { icon: Boxes, accent: "text-cyan-400" };
    case null:
    default:
      return { icon: FileText, accent: "text-muted-foreground" };
  }
}
