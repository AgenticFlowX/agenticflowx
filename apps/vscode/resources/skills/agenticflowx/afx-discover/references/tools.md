# tools

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
