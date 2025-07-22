# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is a CLI tool for managing Git worktrees with a conductor/orchestra theme. It helps developers work on multiple branches in parallel by creating "orchestra members" (worktrees) with integration for Claude Code, tmux, GitHub, and more.

## Development Commands

**IMPORTANT**: This project uses pnpm exclusively. All commands must use `pnpm` instead of `npm`.

### Build & Test

- `pnpm build` - Build the TypeScript project using tsup
- `pnpm dev` - Watch mode development using tsx
- `pnpm test` - Run tests with vitest
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:coverage` - Run tests with coverage report (80% minimum threshold)
- `pnpm typecheck` - Type checking without emitting files

### Code Quality

- `pnpm lint` - ESLint checking on TypeScript files
- `pnpm format` - Format code with Prettier
- `pnpm prettier:check` - Check code formatting

### Single Test Execution

- `pnpm test -- path/to/test.test.ts` - Run a specific test file
- `pnpm test -- --reporter=verbose` - Run tests with detailed output

### Publishing

- `pnpm changeset` - Create a changeset for releases
- `pnpm version` - Version bump using changesets
- `pnpm release` - Build and publish to npm

## Core Architecture

### Main Components

- **CLI Entry Point**: `src/cli.ts` - Main CLI interface using Commander.js
- **Commands**: `src/commands/` - Individual command implementations
- **Core Logic**: `src/core/` - Core Git and configuration management
- **Types**: `src/types/index.ts` - TypeScript type definitions
- **Utils**: `src/utils/` - Utility functions and helpers

### Key Classes

- `GitWorktreeManager` (src/core/git.ts) - Git worktree operations using simple-git
- Configuration management in `src/core/config.ts`
- Individual command handlers in `src/commands/`

### Technology Stack

- **Language**: TypeScript with ES2022 target
- **CLI Framework**: Commander.js for command structure
- **Git Operations**: simple-git library
- **UI Libraries**: chalk (colors), inquirer (prompts), ora (spinners)
- **File Watching**: chokidar
- **Testing**: Vitest for unit and e2e tests
- **Build**: tsup for bundling

## Command Structure

The CLI follows a modular command structure where each command (create, delete, list, etc.) has its own file in `src/commands/`. Commands support:

- Interactive prompts using inquirer
- fzf integration for selection
- JSON output for scripting
- tmux integration
- Claude Code integration via MCP

## Testing Approach

### Test Structure

- **Unit tests**: `src/__tests__/commands/` and `src/__tests__/core/`
- **E2E tests**: `e2e/tests/`
- **Test utilities**: `src/__tests__/utils/`
- **Coverage Requirements**: 80% statements minimum, configured in vitest.config.ts

### Test-Driven Development (TDD)

This project follows TDD methodology:

1. Create failing test first (Red)
2. Write minimal code to pass (Green)
3. Refactor while keeping tests green
4. Always run `pnpm lint && pnpm typecheck` after changes

### Running Tests

- `pnpm test -- path/to/test.test.ts` - Run specific test file
- `pnpm test:coverage` - Generate coverage report
- `pnpm test:e2e` - Run end-to-end tests

## Implementation Logs

This project maintains implementation logs in `_docs/templates/` with format `yyyy-mm-dd_feature-name.md`. When working on features, check existing logs for context on design decisions and previous implementations.

## MCP Integration

The project includes MCP (Model Context Protocol) server functionality in `src/mcp/server.ts` for Claude Code integration. Commands can be executed through the MCP interface.

## Package Configuration

- **Package Manager**: pnpm (specified in package.json)
- **Node Version**: >=20.0.0
- **Module Type**: ESM with .js extensions in imports
- **Binaries**: `maestro` and `mst` commands

## Key Dependencies

- @modelcontextprotocol/sdk - MCP integration
- simple-git - Git operations
- commander - CLI framework
- inquirer - Interactive prompts
- chalk - Terminal colors
- chokidar - File watching
- conf - Configuration management
- zod - Runtime type validation
- execa - Process execution

## Orchestra Theme & Terminology

Maestro uses orchestra/conductor metaphors throughout:

- **Orchestra Members**: Git worktrees (stored in `.git/orchestra-members`)
- **Performers**: Active worktree sessions
- **Conductors**: Main branch or coordinating worktrees
- **Configuration**: `.maestro.json` for project-specific settings

## Git Commit Guidelines

Follow semantic commit prefixes for this project:

- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions/updates
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `chore:` - Build/dependency updates

**IMPORTANT**: Always stage files individually with `git add <specific-files>` instead of `git add -A`. Create meaningful commit messages that explain the "why" of changes.

## Integration Points

### Claude Code MCP

- Server implementation in `src/mcp/server.ts`
- Auto-generates CLAUDE.md files for new worktrees
- Supports AI-powered code review workflows

### External Tool Integration

- **GitHub CLI**: Direct `gh` command integration for PR management
- **tmux**: Session management and pane splitting
- **fzf**: Fuzzy finding for interactive selection
- **Shell Completion**: bash/zsh/fish completion scripts available
