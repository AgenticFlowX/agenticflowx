/**
 * Workbench Vite config — browser-target webview build and dev-server port handoff.
 *
 * @see docs/specs/310-infra-build/spec.md [FR-3]
 * @see docs/specs/310-infra-build/design.md [DES-INFRA-BUILD-SYSTEM-CONTEXT]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE]
 */
import { rmSync, writeFileSync } from "node:fs";
import { pid } from "node:process";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const DEV_SERVER_HOST = "127.0.0.1";
const PORT_FILE = resolve(__dirname, "../../.vite-port-workbench");

function persistPortPlugin(): Plugin {
  return {
    name: "persist-port",
    configureServer(server) {
      const cleanupPortFile = () => {
        try {
          rmSync(PORT_FILE, { force: true });
        } catch {
          // best-effort
        }
      };
      // Signals: clean up, then re-raise so the default OS handler terminates
      // with the conventional exit code. `once` removes our listener before
      // the re-raise, so we don't loop.
      const onSignal = (signal: NodeJS.Signals) => () => {
        cleanupPortFile();
        process.kill(process.pid, signal);
      };
      rmSync(PORT_FILE, { force: true });
      process.once("exit", cleanupPortFile);
      process.once("SIGINT", onSignal("SIGINT"));
      process.once("SIGTERM", onSignal("SIGTERM"));
      process.once("SIGHUP", onSignal("SIGHUP"));
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        const port = address && typeof address === "object" ? address.port : null;
        if (port) {
          writeFileSync(PORT_FILE, `${JSON.stringify({ host: DEV_SERVER_HOST, port, pid })}\n`);
        }
      });
      server.httpServer?.once("close", cleanupPortFile);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), persistPortPlugin()],
  resolve: {
    alias: [{ find: "@", replacement: resolve(__dirname, "src") }],
  },
  server: {
    host: DEV_SERVER_HOST,
    cors: { origin: "*", methods: "*", allowedHeaders: "*" },
    hmr: { host: DEV_SERVER_HOST, protocol: "ws" },
  },
});
