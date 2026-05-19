/**
 * Ordered composer panel/strip host.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES] [DES-HISTORY]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type ComponentType, type ReactNode, memo, useEffect, useMemo, useState } from "react";

import type {
  ComposerPanelDefinition,
  ComposerPanelStackConfig,
  ComposerPanelZone,
} from "./chat.types";
import { ComposerPanel } from "./composer-panel";

const DEFAULT_ZONE_ORDER: ComposerPanelZone[] = ["context", "workflow", "feedback", "debug"];

export interface ComposerPanelStackProps {
  children?: ReactNode;
  config?: ComposerPanelStackConfig;
  onDismissPanel?: (id: string) => void;
}

export const ComposerPanelStack = memo(function ComposerPanelStack({
  children,
  config,
  onDismissPanel,
}: ComposerPanelStackProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [seenDefaults, setSeenDefaults] = useState<ReadonlySet<string>>(() => new Set());
  const panels = useMemo(() => orderPanels(config), [config]);

  // Apply per-panel collapse defaults once per id/key pair. The key allows
  // late-arriving settings snapshots to compact or expand panels without
  // clobbering every user toggle on subsequent renders.
  useEffect(() => {
    if (!config) return;
    const newDefaults = panels
      .filter((panel) => panel.defaultCollapsed || panel.defaultCollapsedKey !== undefined)
      .map((panel) => ({
        id: panel.id,
        key: defaultCollapseKey(panel),
        collapsed: panel.defaultCollapsed === true,
      }))
      .filter((entry) => !seenDefaults.has(entry.key));
    if (newDefaults.length === 0) return;
    setSeenDefaults((current) => {
      const next = new Set(current);
      newDefaults.forEach((entry) => next.add(entry.key));
      return next;
    });
    setCollapsed((current) => {
      const next = new Set(current);
      newDefaults.forEach((entry) => {
        if (entry.collapsed) next.add(entry.id);
        else next.delete(entry.id);
      });
      return next;
    });
  }, [config, panels, seenDefaults]);

  useEffect(() => {
    if (!config) return;
    const activePanelIds = new Set(
      panels.filter((panel) => panel.visible).map((panel) => panel.id),
    );
    setDismissed((current) => {
      let touched = false;
      const next = new Set(current);
      for (const id of current) {
        if (!activePanelIds.has(id)) {
          next.delete(id);
          touched = true;
        }
      }
      return touched ? next : current;
    });
  }, [config, panels]);

  if (!config) return <>{children}</>;

  const visiblePanels = panels.filter((panel) => panel.visible && !dismissed.has(panel.id));

  return (
    // Keep panel spacing aligned with the composer textarea rhythm.
    <div className="mb-1.5 flex flex-col gap-1.5" data-composer-panel-stack>
      {children}
      {visiblePanels.map((panel) => {
        const PanelComponent = panel.component as ComponentType<Record<string, unknown>>;
        const panelProps = (panel.props ?? {}) as Record<string, unknown>;
        const isCollapsed = panel.forcedCollapsed === true || collapsed.has(panel.id);
        return (
          <ComposerPanel
            key={panel.id}
            titleId={`composer-panel-${panel.id}`}
            title={panel.title}
            actions={panel.actions}
            headerExtras={panel.headerExtras}
            count={panel.count}
            tone={panel.tone}
            monoHeader={panel.monoHeader}
            collapsible={panel.forcedCollapsed === true ? false : panel.collapsible}
            collapsed={isCollapsed}
            onCollapsedChange={(nextCollapsed) => {
              setCollapsed((current) => toggleId(current, panel.id, nextCollapsed));
              panel.onCollapsedChange?.(nextCollapsed);
            }}
            dismissible={panel.dismissible}
            onDismiss={() => {
              setDismissed((current) => toggleId(current, panel.id, true));
              onDismissPanel?.(panel.id);
            }}
          >
            <PanelComponent {...panelProps} />
          </ComposerPanel>
        );
      })}
    </div>
  );
});

function orderPanels(config: ComposerPanelStackConfig | undefined): ComposerPanelDefinition[] {
  if (!config) return [];
  const zoneOrder = config.defaultZoneOrder ?? DEFAULT_ZONE_ORDER;
  const zoneRank = new Map(zoneOrder.map((zone, index) => [zone, index]));
  const panels = config.panels.slice().sort((a, b) => {
    const zoneDelta = (zoneRank.get(a.zone) ?? 999) - (zoneRank.get(b.zone) ?? 999);
    if (zoneDelta !== 0) return zoneDelta;
    return config.panels.indexOf(a) - config.panels.indexOf(b);
  });

  for (let pass = 0; pass < panels.length; pass += 1) {
    let changed = false;
    for (const panel of panels.slice()) {
      const currentIndex = panels.findIndex((item) => item.id === panel.id);
      if (currentIndex < 0) continue;

      if (panel.before) {
        const targetIndex = panels.findIndex((item) => item.id === panel.before);
        if (targetIndex >= 0 && currentIndex > targetIndex) {
          panels.splice(currentIndex, 1);
          panels.splice(targetIndex, 0, panel);
          changed = true;
          continue;
        }
      }

      if (panel.after) {
        const targetIndex = panels.findIndex((item) => item.id === panel.after);
        if (targetIndex >= 0 && currentIndex < targetIndex) {
          panels.splice(currentIndex, 1);
          panels.splice(targetIndex, 0, panel);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return panels;
}

function toggleId(current: ReadonlySet<string>, id: string, enabled: boolean): ReadonlySet<string> {
  const next = new Set(current);
  if (enabled) next.add(id);
  else next.delete(id);
  return next;
}

function defaultCollapseKey(panel: ComposerPanelDefinition): string {
  return `${panel.id}\u0000${panel.defaultCollapsedKey ?? "initial"}`;
}
