/**
 * Bottom composer region composition boundary.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENTS]
 */
import type { ReactNode } from "react";

export interface ComposerDockProps {
  children: ReactNode;
}

export function ComposerDock({ children }: ComposerDockProps) {
  return (
    <section role="region" aria-label="Composer" className="shrink-0 px-2 pb-3 pt-2">
      {children}
    </section>
  );
}
