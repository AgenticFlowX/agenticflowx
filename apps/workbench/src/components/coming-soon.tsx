/**
 * ComingSoon — placeholder card for workbench views not yet implemented.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-5]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-TABS]
 */
import { Hourglass } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hourglass size={18} className="text-afx-brand-soft" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
