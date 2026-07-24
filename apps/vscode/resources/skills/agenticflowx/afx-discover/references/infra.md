# infra

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

1. **Create provisioning script**: Use `/afx-task code` to create `provision-{type}` script
2. **Check cloud console**: Manual provisioning may be in use
3. **Document in AFX**: Add to `docs/infrastructure/{type}-setup.md`

Next (ranked):

1. /afx-task code provision-{type} # Context-driven: Create new script
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
