# scripts

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
