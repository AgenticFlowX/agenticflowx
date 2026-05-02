import { cn } from "@afx/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("cn-skeleton", "animate-pulse rounded-none bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
