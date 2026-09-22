# Change Log

All notable changes to the **AIContextFlow** extension will be documented in this file.

## [1.0.0] - 2026-09-21

### Added
- **Unified Context Architecture**: Support for `.context/project-rules.md`, `.context/features/*.md`, and root instruction files (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`).
- **Sidebar TreeView (`aicontextflow.explorer`)**:
  - "Global Rules" group displaying `.context/project-rules.md` and file status.
  - "Feature Sub-Contexts" group displaying all modular feature files.
  - Visual checkmark badges and green highlight for the active sub-context.
  - "Root AI Instructions" group displaying master `AGENTS.md` and symlinks (`CLAUDE.md`, Copilot).
- **Core Commands**:
  - `aicontextflow.initStructure`: Automatically creates directory hierarchy, templates, and relative cross-tool symlinks.
  - `aicontextflow.createFeature`: Prompts for a validated kebab-case feature name and populates required standard sections (`Scope`, `Key Files`, `Gotchas`, `Verification`).
  - `aicontextflow.setActiveFeature`: Selects an active feature and synchronizes `AGENTS.md` active sub-context section.
  - `aicontextflow.unsetActiveFeature`: Deactivates active feature back to global project rules only.
  - `aicontextflow.exportBundle`: Concatenates global rules + active feature, strips markdown fluff, and copies token-dense context to the system clipboard.
  - `aicontextflow.previewBundle`: Opens side-by-side markdown preview of the active context bundle.
  - `aicontextflow.validateStructure`: Diagnostic report analyzing directory presence, file sizes, and symlink integrity.
  - `aicontextflow.deleteFeature`: Safe removal of feature sub-contexts with automatic active-state clearing.
- **Status Bar Integration**:
  - Real-time indicator displaying `$(book) AI Context: [Active-Feature-Name]`.
  - One-click quick pick to switch active features or create new ones.
- **Automatic File Watching**:
  - Real-time file system watchers on `.context/**`, `AGENTS.md`, `CLAUDE.md`, and Copilot files with debouncing.
- **Symlink Management**:
  - Cross-platform relative symlink creation with automatic fallback copy for Windows environments lacking developer privileges.
