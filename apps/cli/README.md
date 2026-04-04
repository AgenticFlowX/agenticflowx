# @agenticflowx/cli

Command Line Interface for AgenticFlowX — run the AgenticFlowX agent from the terminal without VSCode.

## Installation

### Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/AgenticFlowX/agenticflowx/main/apps/cli/install.sh | sh
```

**Requirements:** Node.js 20+, macOS Apple Silicon or Linux x64

**Custom install directory:**

```bash
AFX_INSTALL_DIR=/opt/afx AFX_BIN_DIR=/usr/local/bin curl -fsSL ... | sh
```

**Install a specific version:**

```bash
AFX_VERSION=1.0.0 curl -fsSL https://raw.githubusercontent.com/AgenticFlowX/agenticflowx/main/apps/cli/install.sh | sh
```

### Update

```bash
afx upgrade
```

### Uninstall

```bash
rm -rf ~/.afx/cli ~/.local/bin/afx
```

### Development Install

```bash
# From the monorepo root
pnpm install

# Build the main extension first
pnpm --filter agenticflowx bundle

# Build the CLI
pnpm --filter @agenticflowx/cli build
```

## Usage

### Interactive Mode (Default)

Auto-approves all actions and runs in interactive TUI mode:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...

afx "What is this project?" -w ~/Documents/my-project
```

Run without a prompt to enter it interactively:

```bash
afx -w ~/Documents/my-project
```

### Approval-Required Mode (`--require-approval`)

Prompt for manual approval before every action:

```bash
afx "Refactor utils.ts" --require-approval -w ~/Documents/my-project
```

### Print Mode (`--print`)

Non-interactive, machine-readable output:

```bash
afx --print "Summarize this repository"

# With a specific session ID
afx --print --create-with-session-id 018f7fc8-7c96-7f7c-98aa-2ec4ff7f6d87 "Summarize this repository"
```

### Stdin Stream Mode (`--stdin-prompt-stream`)

One process, multiple prompts via NDJSON on stdin:

```bash
printf '{"command":"start","requestId":"1","prompt":"1+1=?"}\n' | afx --print --stdin-prompt-stream --output-format stream-json
```

## Options

| Option                                  | Description                                                                             | Default                     |
| --------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| `[prompt]`                              | Your prompt (positional argument, optional)                                             | None                        |
| `--prompt-file <path>`                  | Read prompt from a file                                                                 | None                        |
| `--create-with-session-id <session-id>` | Create a new task with the provided session ID (UUID)                                   | None                        |
| `-w, --workspace <path>`                | Workspace path to operate in                                                            | Current directory           |
| `-p, --print`                           | Non-interactive mode: print response and exit                                           | `false`                     |
| `--stdin-prompt-stream`                 | Read NDJSON control commands from stdin (requires `--print`)                            | `false`                     |
| `-e, --extension <path>`                | Path to the extension bundle directory                                                  | Auto-detected               |
| `-d, --debug`                           | Enable debug output                                                                     | `false`                     |
| `-a, --require-approval`                | Require manual approval before actions execute                                          | `false`                     |
| `-k, --api-key <key>`                   | API key for the LLM provider                                                            | From env var                |
| `--provider <provider>`                 | API provider (anthropic, openai-native, openrouter, gemini, vercel-ai-gateway)          | `openrouter`                |
| `-m, --model <model>`                   | Model to use                                                                            | `anthropic/claude-opus-4.6` |
| `--mode <mode>`                         | Mode to start in (code, architect, ask, debug, etc.)                                    | `code`                      |
| `--terminal-shell <path>`               | Absolute shell path for inline terminal command execution                               | Auto-detected               |
| `-r, --reasoning-effort <effort>`       | Reasoning effort level (unspecified, disabled, none, minimal, low, medium, high, xhigh) | `medium`                    |
| `--consecutive-mistake-limit <n>`       | Consecutive error limit before guidance prompt (`0` disables)                           | `10`                        |
| `--ephemeral`                           | Run without persisting state                                                            | `false`                     |
| `--oneshot`                             | Exit upon task completion                                                               | `false`                     |
| `--output-format <format>`              | Output format with `--print`: `text`, `json`, or `stream-json`                          | `text`                      |

## Environment Variables

API keys (if not passed via `--api-key`):

| Provider          | Environment Variable        |
| ----------------- | --------------------------- |
| anthropic         | `ANTHROPIC_API_KEY`         |
| openai-native     | `OPENAI_API_KEY`            |
| openrouter        | `OPENROUTER_API_KEY`        |
| gemini            | `GOOGLE_API_KEY`            |
| vercel-ai-gateway | `VERCEL_AI_GATEWAY_API_KEY` |

## Development

```bash
# Run directly from source
pnpm dev --provider openrouter --api-key $OPENROUTER_API_KEY --print "Hello"

# Tests
pnpm test

# Type checking
pnpm check-types

# Linting
pnpm lint
```

## Releasing

Releases are created via **Actions → CLI Release → Run workflow** on GitHub. The workflow builds platform tarballs and publishes a GitHub release.

For local builds:

```bash
./apps/cli/scripts/build.sh           # Build for current platform
./apps/cli/scripts/build.sh --install # Build and install locally
```
