# mst history

Command to manage Claude Code conversation history. Save, search, and export development history for each orchestra member (Git Worktree).

## Overview

```bash
mst history [options]
mst h [options]  # alias
```

## Usage Examples

### Basic Usage

```bash
# List all histories
mst history --list

# Show history for specific branch
mst history --show feature-auth

# Export histories
mst history --export all-histories.json
mst history --export all-histories.md

# Merge all histories into one file
mst history --merge merged-history.md
```

### History Management

```bash
# Cleanup unnecessary histories
mst history --cleanup

# Sync history paths
mst history --sync

# Search histories
mst history --search "authentication"

# Output in JSON format
mst history --list --json
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--list` | `-l` | Display history list | `false` |
| `--show <branch>` | `-s` | Show history for specific branch | none |
| `--export <file>` | `-e` | Export histories | none |
| `--merge <file>` | `-m` | Merge all histories into one file | none |
| `--cleanup` | `-c` | Cleanup unnecessary histories | `false` |
| `--sync` | | Sync history paths | `false` |
| `--search <query>` | | Search histories | none |
| `--json` | `-j` | Output in JSON format | `false` |
| `--days <n>` | `-d` | Only histories within specified days | none |

## History Storage Format

Claude Code history is stored in the following format:

### Directory Structure

```
~/.claude/history/
├── feature-auth.md
├── bugfix-login.md
├── experiment-ml.md
└── main.md
```

### History File Content

```markdown
# Claude Code History - feature/auth

## Session: 2025-01-20 10:30:00

### Human

Please implement authentication feature. Use JWT.

### Assistant

I'll implement authentication feature with JWT. First, let's install the required packages...

---

## Session: 2025-01-20 14:00:00

### Human

Please add tests.

### Assistant

I'll add tests for the authentication feature...
```

## Displaying History List

### Normal Output

```bash
mst history --list
```

Example output:

```
📚 Claude Code Histories:

feature/auth (3 sessions, last: 2 hours ago)
  - Total messages: 45
  - Total tokens: 12,500
  - Duration: 4.5 hours

bugfix/login (1 session, last: 1 day ago)
  - Total messages: 12
  - Total tokens: 3,200
  - Duration: 1 hour

experiment/ml (5 sessions, last: 3 days ago)
  - Total messages: 89
  - Total tokens: 28,000
  - Duration: 8 hours

Summary:
- Total worktrees with history: 3
- Total sessions: 9
- Total tokens used: 43,700
```

### JSON Output (`--json`)

```json
{
  "histories": [
    {
      "branch": "feature/auth",
      "sessions": 3,
      "lastActivity": "2025-01-20T14:30:00Z",
      "stats": {
        "messages": 45,
        "tokens": 12500,
        "duration": 16200,
        "avgTokensPerSession": 4166
      },
      "path": "/Users/user/.claude/history/feature-auth.md"
    }
  ],
  "summary": {
    "totalWorktrees": 3,
    "totalSessions": 9,
    "totalTokens": 43700,
    "totalDuration": 32400
  }
}
```

## Searching History

### Keyword Search

```bash
# Search for histories containing specific keywords
mst history --search "authentication"
```

Example output:

```
🔍 Search results for "authentication":

feature/auth - Session 2025-01-20 10:30:00
  Line 15: "Please implement authentication feature. Use JWT."
  Line 20: "I'll implement authentication feature with JWT..."

feature/api - Session 2025-01-19 15:00:00
  Line 45: "Change API authentication to OAuth2.0..."

Found 2 matches in 2 worktrees
```

### Advanced Search

```bash
# Use regular expressions
mst history --search "auth(entication|orization)" --regex

# Specify time period
mst history --search "bug" --days 7

# Search within specific branch
mst history --show feature-auth --search "JWT"
```

## Export Feature

### Export in Markdown Format

```bash
mst history --export all-histories.md
```

Generated file:

```markdown
# Maestro - Claude Code History Export

Export date: 2025-01-20 16:00:00

## Table of Contents

1. [feature/auth](#featureauth)
2. [bugfix/login](#bugfixlogin)
3. [experiment/ml](#experimentml)

---

## feature/auth

### Session: 2025-01-20 10:30:00

...
```

### Export in JSON Format

```bash
mst history --export all-histories.json
```

### Export Specific Period

```bash
# Export only histories from past 7 days
mst history --export recent-history.md --days 7

# Export only specific branch
mst history --show feature-auth --export feature-auth-history.md
```

## Merge Feature

Merge multiple history files chronologically into one:

```bash
mst history --merge complete-history.md
```

Merge options:

```bash
# Exclude duplicates
mst history --merge complete-history.md --dedupe

# Sort by timestamp
mst history --merge complete-history.md --sort-by-time

# Sort by token count (for cost analysis)
mst history --merge complete-history.md --sort-by-tokens
```

## Cleanup

### Delete Old Histories

```bash
# Delete histories older than 30 days
mst history --cleanup --days 30

# Check deletion targets (dry run)
mst history --cleanup --days 30 --dry-run
```

### Delete Orphaned Histories

```bash
# Delete histories for non-existent worktrees
mst history --cleanup --orphaned
```

## History Sync

### Path Synchronization

```bash
# Sync history file paths to current configuration
mst history --sync
```

This allows moving existing histories to new locations when the history path is changed in configuration files.

## Statistics and Reports

### Cost Analysis

```bash
# Token usage report
mst history --stats
```

Example output:

```
📊 Token Usage Report

By Worktree:
1. experiment/ml: 28,000 tokens ($0.84)
2. feature/auth: 12,500 tokens ($0.38)
3. bugfix/login: 3,200 tokens ($0.10)

By Time Period:
- Today: 5,000 tokens ($0.15)
- This week: 18,000 tokens ($0.54)
- This month: 43,700 tokens ($1.31)

Model Usage:
- Claude 3 Opus: 30,000 tokens
- Claude 3 Sonnet: 13,700 tokens
```

### Productivity Analysis

```bash
# Analyze session time and frequency
mst history --analyze
```

## Configuration

Customize history management in `.mst.json`:

```json
{
  "claude": {
    "costOptimization": {
      "historyPath": "~/.claude/history/{branch}.md",
      "maxHistoryDays": 90,
      "autoCleanup": true,
      "compressOldHistories": true
    }
  }
}
```

## Advanced Usage Examples

### Learning from History

```bash
# Extract frequently used commands
mst history --export - | grep -E "^### Human" -A1 | grep -v "^--" | sort | uniq -c | sort -nr | head -20
```

### Team Sharing

```bash
# Export history with anonymization
mst history --export team-history.md --anonymize

# Share only specific session
mst history --show feature-auth --session 2025-01-20 --export session.md
```

### Backup Script

```bash
#!/bin/bash
# backup-histories.sh

BACKUP_DIR="./history-backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup all histories
mst history --export "$BACKUP_DIR/all-histories.json"
mst history --merge "$BACKUP_DIR/merged-history.md"

# Compress
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "Backup created: $BACKUP_DIR.tar.gz"
```

## Best Practices

### 1. Session Management

```bash
# Check history before starting new session
before_claude() {
  local branch=$(git branch --show-current)
  echo "📚 Previous sessions for $branch:"
  mst history --show "$branch" --summary
}
```

### 2. Cost Optimization

```bash
# Identify high-cost sessions
mst history --list --json | jq -r '
  .histories[] |
  select(.stats.tokens > 10000) |
  "\(.branch): \(.stats.tokens) tokens ($\(.stats.tokens * 0.00003))"
'
```

### 3. Knowledge Inheritance

```bash
# Document useful sessions
mst history --show feature-auth --export docs/auth-implementation.md
echo "## Key Learnings" >> docs/auth-implementation.md
echo "- JWT implementation details..." >> docs/auth-implementation.md
```

## Tips & Tricks

### History Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias mst-history='mst history --list'
alias mst-history-search='mst history --search'
alias mst-history-export='mst history --export "histories-$(date +%Y%m%d).md"'

# Usage examples
mst-history              # List histories
mst-history-search bug   # Search bug-related histories
mst-history-export       # Export with date
```

### Integration

```bash
# Auto-export with Git hooks
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
echo "Exporting Claude Code history..."
mst history --export .claude-history.md
git add .claude-history.md
git commit -m "chore: update Claude Code history" --no-verify
EOF
chmod +x .git/hooks/pre-push
```

## Related Commands

- [`mst create`](./create.md) - Start new orchestra member and history
- [`mst suggest`](./suggest.md) - Suggestions based on history
- [`mst snapshot`](./snapshot.md) - Snapshot management with history
- [`mst health`](./health.md) - Health check for history files