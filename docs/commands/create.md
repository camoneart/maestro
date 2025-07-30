# 🔸 create

Command to create orchestra members (Git worktrees). Creates a new branch and worktree simultaneously, building an independent development environment.

## Overview

```bash
mst create <branch-name> [options]
```

## Usage Examples

### Basic Usage

```bash
# Create a new orchestra member
mst create feature/new-feature

# Create orchestra member from issue number
mst create 123           # Created as issue-123
mst create #123          # Created as issue-123
mst create issue-123     # Created as issue-123
```

### Advanced Usage

```bash
# Create with tmux session (prompts for attachment in TTY, auto-attaches in non-TTY)
mst create feature/new-feature --tmux

# Create with tmux session and set up Claude workspace
mst create feature/new-feature --tmux --claude-md

# Create with tmux pane split options (when already in tmux)
mst create feature/new-feature --tmux-h  # Horizontal split
mst create feature/new-feature --tmux-v  # Vertical split

# Create with multiple tmux panes
mst create feature/api --tmux-h-panes 3       # 3 horizontal panes
mst create feature/ui --tmux-v-panes 4        # 4 vertical panes
mst create feature/dashboard --tmux-h-panes 2 # 2 horizontal panes

# Create with specific layouts
mst create feature/backend --tmux-v-panes 3 --tmux-layout even-vertical
mst create feature/frontend --tmux-h-panes 4 --tmux-layout main-horizontal
mst create feature/testing --tmux-h-panes 2 --tmux-layout tiled

# Create with specified base branch
mst create feature/new-feature --base develop

# Combine all options
mst create feature/new-feature --base main --open --setup --tmux-h-panes 3 --tmux-layout even-horizontal --claude-md
```

## Options

| Option               | Short | Description                                                   | Default |
| -------------------- | ----- | ------------------------------------------------------------- | ------- |
| `--base <branch>`    | `-b`  | Specify base branch                                           | `main`  |
| `--open`             | `-o`  | Open in editor after creation                                 | `false` |
| `--yes`              | `-y`  | Skip confirmation prompts                                     | `false` |
| `--setup`            | `-s`  | Run environment setup (npm install, etc.)                     | `false` |
| `--tmux`             | `-t`  | Create tmux session with attachment prompt (TTY) or auto-attach (non-TTY) | `false` |
| `--tmux-h`           |       | Split tmux pane horizontally (when in tmux)                  | `false` |
| `--tmux-v`           |       | Split tmux pane vertically (when in tmux)                    | `false` |
| `--tmux-h-panes <number>` |   | Create specified number of horizontal tmux panes             | none    |
| `--tmux-v-panes <number>` |   | Create specified number of vertical tmux panes               | none    |
| `--tmux-layout <type>`    |   | Apply tmux layout (even-horizontal, even-vertical, main-horizontal, main-vertical, tiled) | none |
| `--claude-md`        | `-c`  | Create CLAUDE.md file for Claude Code workspace              | `false` |
| `--copy-file <file>` |       | Copy files from current worktree (including gitignored files) | none    |
| `--shell`            |       | Enter shell after creation                                    | `false` |
| `--exec <command>`   |       | Execute command after creation                                | none    |

## Creating from Issue Number

When you specify an issue number, it automatically fetches issue information using the GitHub API and saves it as metadata:

```bash
# Any of these formats work
mst create 123
mst create #123
mst create issue-123
```

Retrieved information:

- Issue title
- Issue body
- Labels
- Assignees
- Milestone
- Author information



## tmux Integration

### Session Creation with Interactive Attachment

Using the `--tmux` option creates a new tmux session and prompts for attachment:

```bash
# Creates session and prompts for attachment
mst create feature/new-feature --tmux
```

**Behavior:**
- **In TTY environments (interactive terminals)**:
  - Shows confirmation prompt: "セッションにアタッチしますか？" (Do you want to attach to the session?)
  - User can choose Yes/No for attachment
  - If No is selected, shows manual attach instructions
- **In non-TTY environments (scripts, CI/CD)**:
  - Automatically attaches without prompting
  - If outside tmux: Attaches using `tmux attach`
  - If inside tmux: Switches using `tmux switch-client`
- **Shell Environment**: Sessions are created with login shells to inherit your custom PS1 prompts, environment variables, and shell configuration files

### Pane Splitting (when already in tmux)

For quick development without leaving your current tmux session:

```bash
# Split horizontally (left/right)
mst create feature/new-feature --tmux-h

# Split vertically (top/bottom)
mst create feature/new-feature --tmux-v
```

**Behavior:**
- Creates a new pane in your current tmux window
- **Improved Focus Management**: Automatically focuses the first pane (top-left) for better user experience
- **Shell Environment**: Panes are created with login shells to preserve your custom prompts and environment
- Sets the working directory to the new worktree
- **Unified Pane Titles**: ALL panes are now titled with the branch name for consistent identification

**Focus Management:**
The first pane (top-left) is automatically focused after creation, providing a more intuitive and consistent workflow. This improvement ensures that focus lands in the primary workspace position regardless of how many panes are created.

### Multi-Pane Creation

Create multiple panes at once for complex development workflows:

```bash
# Create 3 horizontal panes
mst create feature/api --tmux-h-panes 3

# Create 4 vertical panes
mst create feature/ui --tmux-v-panes 4

# Combine with layouts for optimal organization
mst create feature/dashboard --tmux-h-panes 3 --tmux-layout even-horizontal
mst create feature/microservice --tmux-v-panes 2 --tmux-layout main-vertical
```

#### Layout Types and Visual Examples

**1. `even-horizontal` - Equal horizontal splits**
```
┌──────────┬──────────┬──────────┐
│  Pane 1  │  Pane 2  │  Pane 3  │
│          │          │          │
│          │          │          │
└──────────┴──────────┴──────────┘
```
Use case: Running frontend, backend, and database servers side by side

**2. `even-vertical` - Equal vertical splits**
```
┌─────────────────────┐
│      Pane 1         │
├─────────────────────┤
│      Pane 2         │
├─────────────────────┤
│      Pane 3         │
└─────────────────────┘
```
Use case: Editor at top, terminal in middle, logs at bottom

**3. `main-horizontal` - Large top pane with smaller bottom panes**
```
┌─────────────────────┐
│                     │
│    Main Pane        │
│                     │
├──────────┬──────────┤
│  Pane 2  │  Pane 3  │
└──────────┴──────────┘
```
Use case: Main editor at top, terminal and test runner below

**4. `main-vertical` - Large left pane with smaller right panes**
```
┌──────────┬──────────┐
│          │  Pane 2  │
│   Main   ├──────────┤
│   Pane   │  Pane 3  │
│          ├──────────┤
│          │  Pane 4  │
└──────────┴──────────┘
```
Use case: Main editor on left, file explorer and terminals on right

**5. `tiled` - Balanced grid layout**
```
┌──────────┬──────────┐
│  Pane 1  │  Pane 2  │
├──────────┼──────────┤
│  Pane 3  │  Pane 4  │
└──────────┴──────────┘
```
Use case: Multiple service monitoring or test runners

#### Practical Examples by Use Case

**Frontend + Backend + Database Development**
```bash
# 3 horizontal panes for full-stack development
mst create feature/fullstack --tmux-h-panes 3 --tmux-layout even-horizontal
# Pane 1: npm run dev (frontend)
# Pane 2: npm run server (backend)  
# Pane 3: docker-compose up (database)
```

**Test-Driven Development Setup**
```bash
# 4 panes in grid layout for TDD workflow
mst create feature/tdd --tmux-h-panes 4 --tmux-layout tiled
# Pane 1: Editor (code)
# Pane 2: Test runner (watch mode)
# Pane 3: Coverage report
# Pane 4: Git status/commands
```

**Microservices Development**
```bash
# Main service with supporting services
mst create feature/microservice --tmux-v-panes 3 --tmux-layout main-vertical
# Main pane: Primary service development
# Pane 2: API Gateway logs
# Pane 3: Message queue monitor
```

**Documentation and Development**
```bash
# Split for code and documentation
mst create feature/docs --tmux-h-panes 2 --tmux-layout even-horizontal --claude-md
# Pane 1: Code editor
# Pane 2: Documentation preview server
```

#### Advanced Usage Tips

**1. Dynamic Pane Creation**
```bash
# Start with 2 panes, add more as needed
mst create feature/dynamic --tmux-h-panes 2
# Later: Ctrl+B, % (add vertical pane) or Ctrl+B, " (add horizontal pane)
```

**2. Combining with Other Options**
```bash
# Full setup with multiple panes, Claude integration, and auto-setup
mst create feature/complete --base develop \
  --tmux-h-panes 3 \
  --tmux-layout main-horizontal \
  --claude-md \
  --setup \
  --open
```

**3. Session Management**
```bash
# Create detached session with multiple panes
mst create feature/background --tmux-v-panes 4
# Choose "No" when prompted to attach
# Later: tmux attach -t feature-background
```

#### Multi-Pane Behavior Details

- **Outside tmux**: 
  - Creates new tmux session with specified panes
  - Interactive prompt asks if you want to attach
  - Session continues running if you choose not to attach
  
- **Inside tmux**: 
  - Creates panes in current window
  - **Automatically focuses the first pane (top-left)** for consistent user experience
  - Preserves existing panes in the window
  - **All panes receive unified titles** showing the branch name
  
- **Default Layouts**: 
  - Horizontal panes (`--tmux-h-panes`): Uses `even-horizontal` 
  - Vertical panes (`--tmux-v-panes`): Uses `even-vertical`
  - Can be overridden with `--tmux-layout`
  
- **Limitations**:
  - Minimum: 2 panes (including the initial pane)
  - Maximum: Limited by terminal size and tmux configuration
  - Recommended: 2-6 panes for usability
  
- **Shell Environment**: 
  - All panes start in the worktree directory
  - Inherit your login shell and environment variables
  - MAESTRO environment variables are set in each pane
  - **Consistent pane titles**: All panes display the branch name for easy identification

## Claude Code Integration

Using the `--claude-md` option creates CLAUDE.md workspace files for Claude Code integration:

```bash
mst create feature/ai-feature --tmux --claude-md
```

Executed processes:

1. Worktree creation
2. tmux session/window creation (with attachment prompt if using `--tmux`)
3. CLAUDE.md file creation for workspace setup
4. Environment setup (if specified in configuration)

## Copying Files Feature

Using the `--copy-file` option allows you to copy files from the current worktree to the new one, including gitignored files:

```bash
# Copy environment files
mst create feature/api --copy-file .env --copy-file .env.local

# Multiple files can be specified
mst create feature/new --copy-file .env --copy-file config/local.json --copy-file .npmrc
```

Features:

- **Gitignore detection**: Automatically detects and can copy gitignored files
- **Multiple files**: Can specify multiple files by using the option multiple times
- **Preserves directory structure**: Maintains the original directory structure when copying

## Configuration File Integration

Settings from `.maestro.json` are automatically applied:

```json
{
  "worktrees": {
    "path": ".git/orchestra-members",
    "branchPrefix": "feature/"
  },
  "development": {
    "autoSetup": true,
    "defaultEditor": "cursor"
  },
  "postCreate": {
    "copyFiles": [".env", ".env.local"],
    "commands": ["pnpm install", "pnpm run dev"]
  },
  "hooks": {
    "afterCreate": ["npm install", "npm run setup"]
  },
  "claude": {
    "markdownMode": "shared"  // "shared" | "split"
  },
  "ui": {
    "pathDisplay": "absolute"  // "absolute" | "relative"
  }
}
```

### UI Configuration

The `ui.pathDisplay` setting controls how paths are displayed in creation confirmation messages:

| Option | Description |
|--------|-------------|
| `"absolute"` | Show full absolute paths in creation confirmations (default) |
| `"relative"` | Show paths relative to current working directory |

### Claude Configuration

The `claude.markdownMode` setting controls how CLAUDE.md files are managed:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `"shared"` | Creates symlink to main repository's CLAUDE.md | Share same Claude Code instructions across all worktrees |
| `"split"` | Creates independent CLAUDE.md for each worktree | Different Claude Code instructions per worktree |

When using `--claude-md` option:
- `"shared"` mode: Creates a symlink pointing to the main repository's CLAUDE.md
- `"split"` mode: Creates a new independent CLAUDE.md file in the worktree

### postCreate Configuration

The `postCreate` section allows automatic execution of file copying and commands after worktree creation:

- **copyFiles**: Array of files to copy automatically (including gitignored files)
- **commands**: Array of commands to execute in the new worktree

### hooks.afterCreate

The `afterCreate` hook supports both string and array formats:

```json
// String format (backward compatible)
"afterCreate": "npm install"

// Array format (for multiple commands)
"afterCreate": ["npm install", "npm run setup", "npm run test"]
```

## Tips & Tricks

### 1. Utilize Shortcuts

```bash
# Convenient to alias commonly used combinations
alias mstf='mst create --tmux --claude-md --setup'

# Usage example
mstf feature/new-feature
```

### 2. Issue-Driven Development

```bash
# Check issues
gh issue list

# Create orchestra member by issue number
mst create 123 --tmux --claude-md

# Start development
# Issue information is automatically saved as metadata
```

### 3. Parallel Development Flow

```bash
# Main feature development
mst create feature/main-feature --tmux

# Sub-feature development (separate window)
mst create feature/sub-feature --tmux --new-window

# Bug fix (yet another window)
mst create bugfix/urgent-fix --tmux --new-window

# Multi-service development with multiple panes
mst create feature/microservice --tmux-h-panes 3 --tmux-layout main-horizontal
# Pane 1: API server, Pane 2: Database, Pane 3: Logs
```

### 4. Development Environment Layouts

```bash
# Full-stack development setup
mst create feature/fullstack --tmux-v-panes 3 --tmux-layout main-vertical
# Main pane: Editor, Top pane: Frontend server, Bottom pane: Backend server

# Testing environment
mst create feature/testing --tmux-h-panes 4 --tmux-layout even-horizontal
# Pane 1: Tests, Pane 2: Coverage, Pane 3: Linting, Pane 4: Build
```

## Error Handling

### Automatic Rollback Functionality

The create command includes intelligent automatic rollback functionality to prevent orphaned worktrees when post-creation tasks fail. This ensures your repository remains clean even when errors occur during tmux session creation or other post-processing steps.

**How Automatic Rollback Works:**

1. **Tracks Worktree Creation**: The command monitors whether a worktree was successfully created
2. **Detects Post-Creation Failures**: If tmux session creation, environment setup, or other post-creation tasks fail
3. **Automatic Cleanup**: Immediately attempts to remove the created worktree and branch
4. **User Notification**: Provides clear feedback about the cleanup process
5. **Fallback Instructions**: If automatic cleanup fails, provides manual cleanup commands

**Example Rollback Scenario:**
```bash
# Command fails during tmux session creation
mst create feature/new-feature --tmux

# Output shows automatic rollback:
⚠️  後処理でエラーが発生したため、作成したリソースをクリーンアップします...
✅ クリーンアップが完了しました
```

**Manual Cleanup (if automatic rollback fails):**
```bash
# Commands provided in error message for manual cleanup:
git worktree remove --force /path/to/worktree
git branch -D branch-name
```

**Benefits:**
- **Prevents Orphaned Worktrees**: No leftover directories when creation fails
- **Maintains Clean Repository**: Automatic cleanup keeps your Git state consistent  
- **Better Error Recovery**: Clear feedback and recovery instructions
- **Improved User Experience**: Less manual cleanup required after failures

### Common Errors

1. **Branch already exists**

   ```
   Error: Branch 'feature/new-feature' already exists
   ```

   Solution: Use a different branch name or delete the existing branch

2. **Base branch not found**

   ```
   Error: Base branch 'develop' not found
   ```

   Solution: Specify an existing branch or run `git fetch`

3. **GitHub authentication error**
   ```
   Error: GitHub authentication failed
   ```
   Solution: Authenticate GitHub CLI with `gh auth login`

### tmux Pane Validation and Error Handling

The create command now includes **early validation for tmux pane creation** to prevent resource waste and provide better user experience:

**Smart Pre-Validation**:
- **Early Detection**: Validates pane count limits BEFORE creating any resources (worktree, branch, tmux session)
- **Prevents Resource Creation**: Command exits with error code 1 immediately when validation fails
- **No Cleanup Needed**: Since no resources are created, no rollback is required
- **Maximum Limits**: 10 panes for horizontal splits, 15 panes for vertical splits

**Enhanced Error Messages**:
```bash
# Early validation error message:
Error: 画面サイズに対してペイン数（20個）が多すぎるため、セッションが作成できませんでした。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（水平分割）

# Command exits immediately - no resources created
```

4. **Pane count validation error (new enhanced validation)**

   ```
   Error: 画面サイズに対してペイン数（20個）が多すぎるため、セッションが作成できませんでした。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（水平分割）
   ```

   **Cause**: The requested number of panes exceeds the maximum limits (10 for horizontal, 15 for vertical splits).

   **Error Message Details**:
   - **Early validation** prevents creation of ANY resources
   - Displays in Japanese for better user experience
   - Shows the specific number of panes that was requested
   - Indicates whether it was horizontal (水平分割) or vertical (垂直分割) splitting
   - Provides actionable solutions directly in the error message
   - **No cleanup required** since no resources were created

   **Solutions**:
   - Reduce pane count to within limits: `--tmux-h-panes 8` instead of `--tmux-h-panes 20`
   - Switch to vertical splitting for higher limits: `--tmux-v-panes 12` instead of `--tmux-h-panes 12`  
   - Use efficient layouts: `--tmux-layout main-vertical` or `--tmux-layout tiled`

   **Validation Benefits**:
   - **Clean Exit**: Command exits with error code 1 when validation fails
   - **No Resource Waste**: Prevents creation of worktrees that would need cleanup
   - **Better Performance**: Immediate feedback without waiting for tmux operations
   - **Clear Guidance**: Specific error messages with actionable solutions

5. **Other tmux pane creation errors**

   ```
   Error: tmuxペインの作成に失敗しました: [specific error message]
   ```

   **Cause**: Various tmux configuration or environment issues.

   **Error Message Features**:
   - Generic fallback for all other tmux pane creation failures
   - Preserves the original tmux error message for debugging
   - Consistent Japanese error messaging across the application

   **Solutions**:
   - Ensure tmux is properly installed: `brew install tmux`
   - Check tmux configuration in `~/.tmux.conf`
   - Verify terminal compatibility with tmux
   - Restart tmux session: `tmux kill-server && tmux`

### Troubleshooting Multi-Pane Creation

The create command now includes **early validation** to prevent issues before any resources are created:

**Smart Validation Features**:
- **Pane Limits**: 10 maximum for horizontal splits, 15 maximum for vertical splits
- **Early Detection**: Validates limits before creating worktrees, branches, or tmux sessions
- **Immediate Feedback**: Command exits with error code 1 when limits are exceeded
- **No Cleanup Required**: Since no resources are created during validation failures

**Pane Count Guidelines**:
- **Horizontal splits (`--tmux-h-panes`)**: Maximum 10 panes (smaller screen space per pane)
- **Vertical splits (`--tmux-v-panes`)**: Maximum 15 panes (more vertical space available)
- **Validation triggers**: Only for multi-pane options (> 2 panes)

**Example validation scenarios**:
```bash
# This will be rejected during validation (exceeds limit):
mst create feature/api --tmux-h-panes 20
# Error: 画面サイズに対してペイン数（20個）が多すぎるため、セッションが作成できませんでした...

# These will pass validation:
mst create feature/api --tmux-h-panes 8    # Within horizontal limit
mst create feature/api --tmux-v-panes 12   # Within vertical limit
mst create feature/api --tmux-h-panes 6 --tmux-layout tiled  # Efficient layout
```

**Benefits of Early Validation**:
- **Prevents Resource Waste**: No worktrees created when validation fails
- **Better Performance**: Immediate feedback without tmux operations
- **Clean State**: Repository remains unchanged during validation failures
- **Clear Guidance**: Error messages include specific solutions

## Related Commands

- [`mst list`](./list.md) - Display list of created orchestra members
- [`mst delete`](./delete.md) - Delete orchestra members
- [`mst github`](./github.md) - Create orchestra members from GitHub PR/Issues
