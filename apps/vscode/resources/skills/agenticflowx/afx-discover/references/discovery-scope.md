# Discovery Scope Reference

Shared scan paths, deep-scan patterns, and exclusions used across all `/afx-discover` subcommands.

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
