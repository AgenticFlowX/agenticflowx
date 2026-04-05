# AgenticFlowX Privacy Policy

**Last Updated: April 05, 2026**

AgenticFlowX respects your privacy and is committed to transparency about how we handle your data.

### What Data We Collect

**Telemetry (Optional)**: AgenticFlowX collects optional anonymous usage data via [Microsoft Clarity](https://clarity.microsoft.com/) to help us understand how the UI is used and improve the product. This includes:

- **Session replay**: Visual recordings of your interactions with the extension UI (clicks, scrolls, navigation, tab switches). All text content is masked using Clarity's **Strict mode** — text is replaced with masking characters before it leaves your device. We see interaction patterns, not content.
- **Heatmaps**: Aggregated click and scroll patterns across all users.
- **JavaScript errors**: Stack traces and error messages from the extension UI (no personal data).
- **UI interaction metrics**: Rage clicks, dead clicks, quick-backs — signals that help us find UX friction.

**What is masked (never recorded):**

- All rendered text (chat messages, AI responses, code blocks, markdown content, terminal output)
- All input fields (search, text, password, contenteditable)
- File paths, error messages, and math equations

**What is visible in replays:**

- UI layout and structure (buttons, tabs, panels — without text labels)
- Click targets and scroll positions
- Navigation flow between views
- Time spent on different sections

We do **not** collect:

- Your code or file contents
- Your prompts or AI conversations
- Your API keys or credentials
- Personally identifiable information

You can disable telemetry at any time in **Settings → About → Allow anonymous error and usage reporting**. When disabled, no Clarity script is loaded and no data is sent.

### Where Your Data Goes

- **Code & Files**: AgenticFlowX accesses files on your local machine only when needed for AI-assisted features. When you send a request, relevant context may be transmitted to your chosen AI model provider (e.g., Anthropic, OpenAI, OpenRouter) to generate a response. AgenticFlowX never sees or stores this data. AI providers may process it per their own privacy policies.
- **API Keys & Credentials**: API keys you enter are stored locally on your device and are only sent to the provider you have chosen. They are never sent to AgenticFlowX.
- **Commands**: All commands execute in your local environment. Relevant context may be forwarded to your AI provider as part of a request, but not to AgenticFlowX.

### Analytics (Implemented)

AgenticFlowX uses **[Microsoft Clarity](https://clarity.microsoft.com/)** for optional analytics:

- It is **opt-in** and clearly disclosed in the extension settings (Settings → About).
- Session replay uses **Strict masking mode** — all text content is replaced with masking characters client-side before transmission.
- Additional CSS selector masking is applied to chat messages, code blocks, inputs, terminal output, and markdown content as defense-in-depth.
- It does **not** collect your code, prompts, or personally identifiable information.
- You can disable it at any time in the settings — no Clarity script will be loaded.
- Clarity's own privacy policy: [https://learn.microsoft.com/en-us/clarity/faq](https://learn.microsoft.com/en-us/clarity/faq)

### What We Don't Do

- We do **not** collect your code, prompts, or AI conversations.
- We do **not** have a cloud backend or proxy — all AI calls go directly from your machine to your chosen provider.
- We do **not** sell or share your data.
- We do **not** train any models on your data.

### Your Choices

- Run models locally (e.g., via Ollama) to keep all data entirely on your machine.
- Uninstall AgenticFlowX at any time to stop all local processing.

### Updates

This is an alpha release. If this privacy policy changes, we will update this document and note the change in the release notes.

### Contact

For privacy-related questions, open an issue or discussion at
https://github.com/AgenticFlowX/agenticflowx/issues

---

By using AgenticFlowX, you agree to this Privacy Policy.
