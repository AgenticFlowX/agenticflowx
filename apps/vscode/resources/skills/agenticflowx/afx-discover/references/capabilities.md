# capabilities

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
- `/afx-task code {name}` - Create missing script
- `/afx-session note "Priority: {gap}"` - Document gap

Next: /afx-discover infra {type} # Address highest priority gap
```
