# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is a CLI tool for managing Git Worktrees with a conductor/orchestra theme. It helps developers work on multiple branches in parallel by creating "orchestra members" (worktrees) with integration for Claude Code, tmux, GitHub, and more.

## Development Commands

### Build & Test
- `npm run build` - Build the TypeScript project using tsup
- `npm run dev` - Watch mode development using tsx
- `npm test` - Run tests with vitest
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run typecheck` - Type checking without emitting files

### Code Quality
- `npm run lint` - ESLint checking on TypeScript files
- `npm run format` - Format code with Prettier
- `npm run prettier:check` - Check code formatting

### Publishing
- `npm run changeset` - Create a changeset for releases
- `npm run version` - Version bump using changesets
- `npm run release` - Build and publish to npm

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

- Unit tests: `src/__tests__/commands/` and `src/__tests__/core/`
- E2E tests: `e2e/tests/`
- Test utilities: `src/__tests__/utils/`
- Run single test: `npm test -- path/to/test.test.ts`

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