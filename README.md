# AIContextFlow

<p align="center">
  <img src="media/logo.png" alt="AIContextFlow Logo" width="160" height="160" />
</p>

<h3 align="center">Unified AI Context Management &amp; Validation for VS Code</h3>

<p align="center">
  Streamline how your AI coding assistants (Claude Code, GitHub Copilot, Gemini, Cursor) read, validate, and focus on project context.
</p>

---

## 💡 Overview

Modern AI-assisted development requires high-signal, modular context. Bloated instruction files overwhelm token limits and cause hallucinations, while fragmented rules cause agents to violate project architecture.

**AIContextFlow** solves this by establishing a single source of truth:
- **Global Rules** (`.context/project-rules.md`): Core architecture, conventions, and guardrails applied across the entire codebase.
- **Feature Sub-Contexts** (`.context/features/<name>.md`): Task-focused contexts detailing Scope, Key Files, Gotchas, and Verification.
- **Root Instruction Synchronization** (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`): Root files remain synchronized via relative symlinks pointing to master instructions.
- **Dynamic Context Bundling**: Concatenates active sub-contexts with global rules, strips markdown fluff, and copies token-dense prompts directly to your clipboard.

---

## 🚀 Key Features

### 1. Dedicated Sidebar Explorer (`aicontextflow.explorer`)
- **Global Rules Group:** Inspect and edit `.context/project-rules.md` directly.
- **Feature Sub-Contexts Group:** View all available feature modules with immediate visual indicators (`✓ Active Sub-Context` badge) marking the currently active feature.
- **Root AI Instructions Group:** Monitor the health and destination of `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` symlinks.
- **Inline Actions:** One-click activation, file creation, previewing, and bundle exporting.

### 2. Status Bar Quick Switcher
- Displays `$(book) AI Context: [Active-Feature-Name]` on the VS Code status bar.
- Click to open the **QuickPick switcher**, activate a different feature, create a new sub-context, or clear back to global rules.

### 3. Automated Context Bundling (`aicontextflow.exportBundle`)
- Combines `.context/project-rules.md` + active feature into an optimized prompt bundle.
- **Fluff Stripping:** Eliminates HTML comments, redundant whitespace, internal markers, and trailing spaces to maximize token efficiency.
- Copies the cleaned context directly to your system clipboard and displays token and character statistics.

### 4. Cross-Tool Symlink Management (`aicontextflow.initStructure`)
- Sets up standard directories and starter templates.
- Establishes relative symlinks:
  - `CLAUDE.md` → `AGENTS.md`
  - `.github/copilot-instructions.md` → `../AGENTS.md`
- Handles permissions gracefully with automatic fallback copying on Windows filesystems lacking Developer Mode privileges.

### 5. Reactive File Watching
- Watches `.context/**` and instruction files in real-time.
- Automatically refreshes the TreeView and Status Bar upon external edits, file creations, deletions, or git branch checkouts.

---

## 📂 File Architecture

```
my-project/
├── .context/
│   ├── project-rules.md            # Global architecture & coding standards
│   └── features/
│       ├── auth-flow.md            # Modular feature sub-context
│       ├── payment-gateway.md
│       └── search-indexing.md
├── .github/
│   └── copilot-instructions.md     # Symlink -> ../AGENTS.md
├── AGENTS.md                       # Master AI instructions with active block
└── CLAUDE.md                       # Symlink -> AGENTS.md
```

### Feature File Template
Every feature sub-context generated via `aicontextflow.createFeature` includes standard headers:

```markdown
# Auth Flow

<!-- AIContextFlow: Feature sub-context for auth-flow -->

## Scope
- User authentication, JWT issuance, and refresh token rotation.
- In-scope: REST endpoints `/api/auth/*`.
- Out-of-scope: OAuth social logins.

## Key Files
- `src/controllers/authController.ts` - Login and refresh handlers
- `src/services/jwtService.ts` - Token signing and verification
- `test/auth.test.ts` - Integration tests

## Gotchas
- Refresh tokens must be stored in httpOnly, Secure cookies.
- Watch out for clock drift when verifying token expiration timestamps.

## Verification
1. Run auth unit tests: `npm test`
2. Test login flow via curl or Postman:
   - [ ] POST `/api/auth/login` returns 200 and sets cookie
   - [ ] POST `/api/auth/refresh` renews access token
```

---

## ⌨️ Commands

| Command | Title | Description |
|---|---|---|
| `aicontextflow.initStructure` | Initialize Context Structure | Creates directories, starter templates, and symlinks. |
| `aicontextflow.createFeature` | Create Feature Sub-Context | Prompts for a kebab-case name and creates a standard template. |
| `aicontextflow.setActiveFeature` | Set Active Feature Sub-Context | Sets the active sub-context and updates `AGENTS.md`. |
| `aicontextflow.unsetActiveFeature` | Clear Active Sub-Context | Resets active context back to global rules only. |
| `aicontextflow.exportBundle` | Export Bundled AI Context | Bundles rules + active feature and copies to clipboard. |
| `aicontextflow.previewBundle` | Preview Bundled AI Context | Opens a side-by-side markdown preview of the active bundle. |
| `aicontextflow.validateStructure` | Validate AI Context & Symlinks | Runs diagnostic checks on directories, files, and symlinks. |
| `aicontextflow.refreshExplorer` | Refresh Explorer | Manually forces a refresh of the tree and status bar. |
| `aicontextflow.deleteFeature` | Delete Feature Sub-Context | Confirms and deletes a feature sub-context. |

---

## ⚙️ Extension Settings

| Setting | Default | Description |
|---|---|---|
| `aicontextflow.contextDirectory` | `".context"` | Relative path to the context directory. |
| `aicontextflow.agentsFilePath` | `"AGENTS.md"` | Relative path to the root agents instruction file. |
| `aicontextflow.stripFluffOnExport` | `true` | Strip comments and blank lines on context export. |
| `aicontextflow.embedFullContentInAgentsMd` | `false` | Embed full feature content in `AGENTS.md` vs. link reference. |
| `aicontextflow.showStatusBarItem` | `true` | Display active feature item in the status bar. |

---

## 🛠️ Development & Testing

```bash
# Clone repository
git clone https://github.com/aicontextflow/aicontextflow.git
cd aicontextflow

# Install dependencies
npm install

# Run TypeScript compilation
npm run compile

# Run tests
npm test

# Bundle production extension with esbuild
npm run package
```

Press `F5` in VS Code to launch the Extension Development Host for interactive debugging.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
