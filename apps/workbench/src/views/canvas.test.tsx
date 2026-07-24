/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-1] [FR-2] [FR-44]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH] [DES-FILES]
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as WorkbenchContextModule from "../context/workbench-context";
import { WorkbenchProvider } from "../context/workbench-context";
import Canvas from "./canvas";

const canvasAppRender = vi.hoisted(() => vi.fn<(enabled: boolean) => void>());

vi.mock("../components/canvas/canvas-app", async () => {
  const { useWorkbench } = await vi.importActual<typeof WorkbenchContextModule>(
    "../context/workbench-context",
  );

  return {
    CanvasApp() {
      const { canvasEnabled } = useWorkbench();
      canvasAppRender(canvasEnabled);
      return (
        <div data-testid="shared-canvas-app" data-experiment-enabled={String(canvasEnabled)}>
          Shared React Flow CanvasApp
        </div>
      );
    },
  };
});

function renderRoute(canvasEnabled: boolean) {
  return render(
    <WorkbenchProvider initialState={{ isLoading: false, canvasEnabled }}>
      <Canvas />
    </WorkbenchProvider>,
  );
}

describe("Workbench Canvas route", () => {
  beforeEach(() => {
    canvasAppRender.mockClear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("delegates the disabled experiment state to the shared CanvasApp", () => {
    renderRoute(false);

    expect(screen.getByTestId("shared-canvas-app")).toHaveAttribute(
      "data-experiment-enabled",
      "false",
    );
    expect(canvasAppRender).toHaveBeenLastCalledWith(false);
  });

  it("delegates the enabled experiment state to the shared CanvasApp", () => {
    renderRoute(true);

    expect(screen.getByTestId("shared-canvas-app")).toHaveAttribute(
      "data-experiment-enabled",
      "true",
    );
    expect(canvasAppRender).toHaveBeenLastCalledWith(true);
  });

  it("ignores the removed legacy renderer query and always mounts CanvasApp", () => {
    window.history.replaceState({}, "", "/?canvas-renderer=legacy");

    renderRoute(true);

    expect(screen.getByText("Shared React Flow CanvasApp")).toBeInTheDocument();
    expect(canvasAppRender).toHaveBeenCalledTimes(1);
  });
});
