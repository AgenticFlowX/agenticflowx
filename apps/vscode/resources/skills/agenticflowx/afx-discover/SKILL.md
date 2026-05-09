---
name: afx-discover
description: Project discovery — find infrastructure scripts, automation tools, deployment workflows, and development capabilities in your codebase
license: MIT
metadata:
  afx-owner: "@rix"
  afx-status: Living
  afx-tags: "workflow,discovery,infrastructure,tools,capabilities"
  afx-argument-hint: "infra | scripts | tools | capabilities"
  modeSlugs:
    - focus-discover
    - architect
---

# /afx-discover

Discover what exists in your project: infrastructure scripts, automation tools, deployment workflows, and development capabilities.

## Configuration

**Read config** using two-tier resolution: `.afx/.afx.yaml` (managed defaults) + `.afx.yaml` (user overrides).

- `paths.specs` - Where spec files live (default: `docs/specs`)
- `paths.adr` - Where global ADR files live (default: `docs/adr`)

If neither file exists, use defaults.

## Usage

```bash
/afx-discover infra [type] [--all]        # Find infrastructure provisioning scripts
/afx-discover scripts [keyword] [--all]   # Find automation/deployment scripts
/afx-discover tools                       # List dev/deployment tools
/afx-discover capabilities                # High-level project automation overview
```

## Execution Contract (STRICT)

### Allowed

- Read/list/search files anywhere in workspace
- Discover infrastructure scripts, automation tools, deployment workflows

### Forbidden

- Create/modify/delete any files
- Run build/test/deploy/migration commands

If implementation is requested, respond with:

```text
Out of scope for /afx-discover (read-only discovery mode). Use /afx-dev code to implement or /afx-scaffold to scaffold.
```

### Timestamp Format (MANDATORY)

When writing execution reports or creating journal entries, all timestamps MUST use ISO 8601 with millisecond precision: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). Never write short formats like `2025-12-17 14:30`. **To get the current timestamp**, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via the Bash tool — do NOT guess or use midnight (`T00:00:00.000Z`).

## Post-Action Checklist (MANDATORY)

Since this is a read-only discovery skill, no files are modified. However, after executing any discovery action, you MUST:

1. Clearly state what infrastructure or scripts were discovered.
2. Formulate proper Markdown output based on the discovery type.

### Proactive Journal Capture

When this skill detects a high-impact discovery event, auto-capture to `journal.md` per the [Proactive Capture Protocol](../afx-session/SKILL.md#proactive-capture-protocol-mandatory).

**Triggers for `/afx-discover`**: Significant architectural pattern or missing infrastructure discovered.

---

## Agent Instructions

### Context Resolution (CLI & IDE)

1. **Environment detection:** Check if IDE context is available (`ide_opened_file` or `ide_selection` tags in conversation).
2. **Feature inference:**
   - **IDE:** Infer scan scope from the active file path (e.g., `scripts/deploy.sh` → focus discovery on deployment tooling).
   - **CLI:** Infer from explicit arguments first, then cwd, then conversation history.
   - **Fallback:** Discover across the entire project if no scope is specified.
3. **Trailing parameters (`[...context]`):** Treat extra words as discovery constraints (e.g., `/afx-discover scripts deploy kubernetes` → filter scripts related to Kubernetes deployment).

### Next Command Suggestion (MANDATORY)

**CRITICAL**: After EVERY `/afx-discover` action, suggest the most appropriate next command based on context:

| Context                          | Suggested Next Command                              |
| -------------------------------- | --------------------------------------------------- |
| After `infra` (scripts found)    | Use the discovered script or `/afx-next`            |
| After `infra` (nothing found)    | `/afx-scaffold spec` or `/afx-sprint new`           |
| After `scripts` (found relevant) | Run the script or document in AFX                   |
| After `tools` (inventory shown)  | `/afx-next` or `/afx-task pick`                     |
| After `capabilities` (overview)  | `/afx-discover <specific>` for deeper investigation |

**Suggestion Format** (top 3 context-driven, bottom 2 static):

```
Next (ranked):

1. Run discovered script: {command} # Context-driven: If script found
2. /afx-scaffold spec {name} # Context-driven: If nothing found
3. /afx-session note "Missing: {capability}" # Context-driven: Document gap
   ──
4. /afx-next # Re-orient after discovery
5. /afx-help # See all options
```

---

## Subcommands

---

## 1. infra

Find infrastructure provisioning and management scripts.

### Usage

```bash
/afx-discover infra [type] [--all]
```

Examples:

- `/afx-discover infra` - Find all infrastructure scripts
- `/afx-discover infra database` - Find database-related scripts
- `/afx-discover infra storage --all` - Deep scan for storage scripts
- `/afx-discover infra "scan the entire codebase for container scripts"` - Natural language

### Context

- Type: $ARGUMENTS (optional - filters by infrastructure type)
- Scope: Default (smart scan) or --all (deep scan)
- Targets: Cloud services, database provisioning, container orchestration, serverless deployment

### Search Strategy

#### Default Scan (Fast - ~5-10 files)

Searches common locations:

```bash
# Standard script directories
scripts/
bin/
infrastructure/
.github/workflows/
.gitlab-ci.yml

# Configuration files
package.json (scripts section)
Makefile
docker-compose.yml
serverless.yml
terraform/
pulumi/
cloudformation/

# Documentation
docs/infrastructure/
docs/deployment/
docs/adr/
README.md
```

#### Deep Scan (--all flag - Comprehensive)

Searches entire codebase:

```bash
# All files with infrastructure patterns
**/*.sh
**/*.bash
**/*.yml
**/*.yaml
**/*.tf (Terraform)
**/*.ts (CDK/Pulumi)
**/package.json
**/Makefile
**/Dockerfile
**/docker-compose*.yml
```

### Infrastructure Type Keywords

| Type         | Search Keywords                                        |
| ------------ | ------------------------------------------------------ |
| `database`   | database, db, postgres, mysql, mongo, redis, provision |
| `storage`    | storage, bucket, blob, s3, gcs, azure-storage          |
| `compute`    | compute, lambda, function, vm, instance, server        |
| `container`  | container, docker, kubernetes, k8s, ecs, fargate       |
| `api`        | api, gateway, endpoint, rest, graphql                  |
| `network`    | network, vpc, subnet, firewall, security-group         |
| `auth`       | auth, iam, rbac, role, policy, permissions             |
| `cdn`        | cdn, edge, cloudfront, cloudflare, akamai              |
| `monitoring` | monitoring, logging, metrics, observability, apm       |
| `ci-cd`      | ci, cd, pipeline, workflow, deploy, release            |
| `general`    | provision, deploy, infrastructure, setup, infra        |

### Output Format

#### Scripts Found

```markdown
## Infrastructure Discovery: {type}

### Found Scripts

**1. Database Provisioning**

- **File**: `scripts/provision-database.sh`
- **Type**: Shell script
- **Purpose**: Provisions database instances
- **Usage**: `./scripts/provision-database.sh --env prod`
- **Related**: [package.json:{line}](package.json#{line})

**2. Infrastructure Documentation**

- **File**: `docs/infrastructure/database-setup.md`
- **Type**: Documentation
- **Purpose**: Manual provisioning guide
- **Note**: No automated script found

### Package/Make Scripts

| Script         | Command                           |
| -------------- | --------------------------------- |
| `provision:db` | `./scripts/provision-database.sh` |
| `deploy:infra` | `terraform apply -auto-approve`   |

### Documentation

- [Infrastructure Setup Guide](docs/infrastructure/setup.md)
- [Deployment README](scripts/README.md)

Next: {discovered-command} # Use discovered script
```

#### Nothing Found

```markdown
## Infrastructure Discovery: {type}

### No Scripts Found

Searched locations:

- scripts/ ✗
- infrastructure/ ✗
- .github/workflows/ ✗
- Configuration files ✗

### Suggestions

1. **Create provisioning script**: Use `/afx-dev code` to create `provision-{type}` script
2. **Check cloud console**: Manual provisioning may be in use
3. **Document in AFX**: Add to `docs/infrastructure/{type}-setup.md`

Next (ranked):

1. /afx-dev code provision-{type} # Context-driven: Create new script
2. /afx-discover scripts deploy # Context-driven: Check related scripts
3. /afx-session note "Infrastructure gap: {type}" # Context-driven: Document gap
   ──
4. /afx-next # Re-orient after discovery
5. /afx-help # See all options
```

### Natural Language Parsing

Parse scope intent from natural language:

| User Input                                   | Interpreted As     |
| -------------------------------------------- | ------------------ |
| "scan the entire codebase"                   | `--all`            |
| "check everywhere"                           | `--all`            |
| "deep search"                                | `--all`            |
| "comprehensive scan"                         | `--all`            |
| "find database scripts" (no scope modifiers) | Default smart scan |
| "look for deployment tools"                  | Default smart scan |

---

## 2. scripts

Find automation, deployment, and utility scripts.

### Usage

```bash
/afx-discover scripts [keyword] [--all]
```

Examples:

- `/afx-discover scripts` - Find all scripts
- `/afx-discover scripts deploy` - Find deployment scripts
- `/afx-discover scripts test --all` - Deep scan for test scripts

### Search Strategy

#### Default Scan

```bash
# Script directories
scripts/
bin/
tools/

# Workflow files
.github/workflows/
.gitlab-ci.yml
Jenkinsfile

# Build/Deploy configs
package.json (scripts section)
Makefile
justfile
docker-compose.yml
```

#### Keywords

| Keyword    | Search Terms                         |
| ---------- | ------------------------------------ |
| `deploy`   | deploy, deployment, release, publish |
| `test`     | test, spec, e2e, integration         |
| `build`    | build, compile, bundle, package      |
| `setup`    | setup, install, init, bootstrap      |
| `ci`       | ci, continuous, workflow, pipeline   |
| `migrate`  | migrate, migration, seed, db-setup   |
| `backup`   | backup, restore, snapshot            |
| `monitor`  | monitor, health, metrics, logs       |
| `security` | security, audit, scan, vulnerability |

### Output Format

```markdown
## Scripts Discovery: {keyword}

### Shell Scripts

**1. Deployment Script**

- **File**: `scripts/deploy.sh`
- **Purpose**: Deploy application to environment
- **Usage**: `./scripts/deploy.sh --env staging`

**2. Database Migration**

- **File**: `scripts/migrate.sh`
- **Purpose**: Run pending database migrations
- **Usage**: `./scripts/migrate.sh`

### Package Scripts

| Script     | Command                | Purpose        |
| ---------- | ---------------------- | -------------- |
| `deploy`   | `./scripts/deploy.sh`  | Deploy app     |
| `test:e2e` | `{test-runner} test`   | E2E tests      |
| `migrate`  | `./scripts/migrate.sh` | Run migrations |

### CI/CD Workflows

- [Deploy Workflow](.github/workflows/deploy.yml) - Auto-deploy on merge to main
- [Test Workflow](.github/workflows/test.yml) - Run tests on PR

Next: {discovered-command} # Use discovered script
```

---

## 3. tools

List development and deployment tools configured in the project.

### Usage

```bash
/afx-discover tools
```

### Output Format

```markdown
## Project Tools Inventory

### Build & Development

| Tool   | Version | Purpose   | Config        |
| ------ | ------- | --------- | ------------- |
| {tool} | {ver}   | {purpose} | {config-file} |

### Testing

| Tool   | Version | Purpose   | Config        |
| ------ | ------- | --------- | ------------- |
| {tool} | {ver}   | {purpose} | {config-file} |

### Infrastructure

| Tool   | Version | Purpose   | Config        |
| ------ | ------- | --------- | ------------- |
| {tool} | {ver}   | {purpose} | {config-file} |

### Deployment

| Platform   | Purpose | Config        |
| ---------- | ------- | ------------- |
| {platform} | Hosting | {config-file} |

### Package Managers

- **{manager}**: {description}

Next: /afx-next # Choose the safest next workflow step
```

---

## 4. capabilities

High-level overview of project automation and tooling.

### Usage

```bash
/afx-discover capabilities
```

### Output Format

```markdown
## Project Capabilities Overview

### Infrastructure Provisioning

**Available:**

- {capability-1}
- {capability-2}

**Missing:**

- {missing-capability-1}
- {missing-capability-2}

### Deployment

**Available:**

- {deployment-method-1}
- {deployment-method-2}

**Missing:**

- {missing-deployment-method}

### Testing

**Available:**

- {test-type-1}
- {test-type-2}

**Missing:**

- {missing-test-type}

### Build & Package

**Available:**

- {build-capability-1}

**Missing:**

- {missing-build-capability}

### Monitoring & Observability

**Available:**

- {monitoring-capability}

**Missing:**

- {missing-monitoring-capability}

### Architecture & Decisions

**Status:**

- **Total ADRs:** {count}
- **Latest Decision:** {ADR-NNNN: Title} ({status})
- **Active Proposals:** {count}

### Next Steps

**High Priority Gaps:**

1. {gap-1}
2. {gap-2}
3. {gap-3}

**Commands:**

- `/afx-discover infra {type}` - Investigate specific infrastructure
- `/afx-dev code {name}` - Create missing script
- `/afx-session note "Priority: {gap}"` - Document gap

Next: /afx-discover infra {type} # Address highest priority gap
```

---

## Error Handling

### Invalid Subcommand

```
Error: Unknown subcommand "{subcommand}"
Usage: /afx-discover [infra|scripts|tools|capabilities]

Examples:
  /afx-discover infra database
  /afx-discover scripts deploy
  /afx-discover tools
  /afx-discover capabilities
```

### No Type Specified (when helpful)

```
Tip: Narrow your search with a type keyword

Examples:
  /afx-discover infra database      # Find database scripts
  /afx-discover scripts deploy      # Find deployment scripts

Or run without type to see all:
  /afx-discover infra               # All infrastructure scripts
  /afx-discover scripts             # All automation scripts
```

---

## Related Commands

| Command         | Relationship                                      |
| --------------- | ------------------------------------------------- |
| `/afx-scaffold` | Scaffold new spec directories and ADRs            |
| `/afx-session`  | Document infrastructure gaps                      |
| `/afx-dev`      | Implement discovered tooling improvements         |
| `/afx-task`     | Continue with tasks after infrastructure is ready |

---

## Discovery Scope Reference

### Default Scan Paths

```
scripts/
bin/
infrastructure/
.github/workflows/
.gitlab-ci.yml
package.json
Makefile
justfile
docker-compose.yml
serverless.yml
terraform/
pulumi/
cloudformation/
docs/infrastructure/
docs/deployment/
README.md
```

### Deep Scan Patterns (--all)

```
**/*.sh
**/*.bash
**/*.zsh
**/*.ps1
**/*.yml
**/*.yaml
**/*.json (package.json, config files)
**/*.tf (Terraform)
**/*.ts (IaC: CDK/Pulumi)
**/Makefile
**/justfile
**/Dockerfile
**/docker-compose*.yml
**/*config*.{js,ts,json}
```

### Exclusions (Always)

```
node_modules/
vendor/
.git/
dist/
build/
.next/
target/
coverage/
*.min.js
*.bundle.js
```
