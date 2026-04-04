# Contributing to AgenticFlowX

AgenticFlowX is a community-driven project and we value every contribution. To keep collaboration smooth, we use an [Issue-First](#issue-first-approach) workflow -- all [Pull Requests (PRs)](#submitting-a-pull-request) must be linked to a GitHub Issue. Please review this guide before contributing.

## Table of Contents

- [Before You Contribute](#before-you-contribute)
- [Finding & Planning Your Contribution](#finding--planning-your-contribution)
- [Development & Submission Process](#development--submission-process)
- [Legal](#legal)

## Before You Contribute

### 1. Code of Conduct

All contributors must adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).

### 2. Project Roadmap

Our roadmap guides the project's direction. Align your contributions with these key goals:

#### Reliability First

- Ensure diff editing and command execution are consistently reliable.
- Reduce friction points that deter regular usage.
- Guarantee smooth operation across all locales and platforms.
- Expand robust support for a wide variety of AI providers and models.

#### Enhanced User Experience

- Streamline the UI/UX for clarity and intuitiveness.
- Continuously improve the workflow to meet the high expectations developers have for daily-use tools.

#### Leading on Agent Performance

- Establish comprehensive evaluation benchmarks (evals) to measure real-world productivity.
- Make it easy for everyone to run and interpret these evals.
- Ship improvements that demonstrate clear increases in eval scores.

Mention alignment with these areas in your PRs.

### 3. Join the Community

- Engage with other contributors via [GitHub Discussions](https://github.com/AgenticFlowX/agenticflowx/discussions).
- Track project progress on the [GitHub Project board](https://github.com/orgs/AgenticFlowX/projects/1).

## Finding & Planning Your Contribution

### Types of Contributions

- **Bug Fixes:** Addressing code issues.
- **New Features:** Adding functionality.
- **Documentation:** Improving guides and clarity.

### Issue-First Approach

All contributions start with a GitHub Issue.

- **Check existing issues**: Search [GitHub Issues](https://github.com/AgenticFlowX/agenticflowx/issues).
- **Create an issue** using:
    - **Enhancements:** "Enhancement Request" template (plain language focused on user benefit).
    - **Bugs:** "Bug Report" template (minimal repro + expected vs actual + version).
- **Want to work on it?** Comment "Claiming" on the issue to get assigned.
- **PRs must link to the issue.** Unlinked PRs may be closed.

### Deciding What to Work On

- Check the [GitHub Project](https://github.com/orgs/AgenticFlowX/projects/1) for unassigned issues.

### Reporting Bugs

- Check for existing reports first.
- Create a new bug using the ["Bug Report" template](https://github.com/AgenticFlowX/agenticflowx/issues/new/choose) with:
    - Clear, numbered reproduction steps
    - Expected vs actual result
    - AgenticFlowX version (required); API provider/model if relevant
- **Security issues**: Report privately via [security advisories](https://github.com/AgenticFlowX/agenticflowx/security/advisories/new).

## Development & Submission Process

### Development Setup

1. **Fork & Clone:**

```
git clone https://github.com/YOUR_USERNAME/agenticflowx.git
```

2. **Install Dependencies:**

```
pnpm install
```

3. **Debugging:** Open with VS Code and press `F5`.

### Writing Code Guidelines

- One focused PR per feature or fix.
- Follow ESLint and TypeScript best practices.
- Write clear, descriptive commits referencing issues (e.g., `Fixes #123`).
- Provide thorough testing (`pnpm test`).
- Rebase onto the latest `main` branch before submission.

### Submitting a Pull Request

- Begin as a **Draft PR** if seeking early feedback.
- Clearly describe your changes following the Pull Request Template.
- Link the issue in the PR description/title (e.g., "Fixes #123").
- Provide screenshots/videos for UI changes.
- Indicate if documentation updates are necessary.

### Pull Request Policy

- Must reference an assigned GitHub Issue.
- Unlinked PRs may be closed.
- PRs should pass CI tests, align with the roadmap, and have clear documentation.

### Review Process

- **Daily Triage:** Quick checks by maintainers.
- **Weekly In-depth Review:** Comprehensive assessment.
- **Iterate promptly** based on feedback.

## Legal

By contributing, you agree your contributions will be licensed under the Apache 2.0 License, consistent with AgenticFlowX's licensing.
