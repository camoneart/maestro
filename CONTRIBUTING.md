# Contributing to shadow-clone-jutsu

First off, thank you for considering contributing to shadow-clone-jutsu! 🥷

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Commit Messages](#commit-messages)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/shadow-clone-jutsu.git`
3. Add upstream remote: `git remote add upstream https://github.com/hashiramaendure/shadow-clone-jutsu.git`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- Git >= 2.22.0
- pnpm >= 9.0.0

### Installation

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test
```

### Development Commands

```bash
# Watch mode for development
pnpm run dev

# Run tests in watch mode
pnpm test

# Run type checking
pnpm run typecheck

# Run linting
pnpm run lint

# Format code
pnpm run format

# Run E2E tests
pnpm run test:e2e

# Check test coverage
pnpm run test:coverage
```

## Development Workflow

1. **Create an Issue**: Before starting work, create or find an issue describing the feature/bug
2. **Fork & Branch**: Fork the repo and create a feature branch from `main`
3. **Develop**: Make your changes following our coding standards
4. **Test**: Write tests for your changes and ensure all tests pass
5. **Document**: Update documentation if needed
6. **Commit**: Use conventional commit messages
7. **Push**: Push your branch to your fork
8. **PR**: Create a pull request to the `main` branch

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-docker-support`)
- `fix/` - Bug fixes (e.g., `fix/tmux-session-error`)
- `docs/` - Documentation updates (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-config-logic`)
- `test/` - Test additions/updates (e.g., `test/add-sync-tests`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

## Pull Request Process

1. **Update your branch**: Rebase on latest upstream/main
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks locally**:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm test
   pnpm run build
   ```

3. **Create PR**: 
   - Use a clear, descriptive title
   - Reference the related issue(s)
   - Describe what changes you made and why
   - Include screenshots for UI changes
   - Add tests for new functionality

4. **PR Template**: Your PR description should include:
   ```markdown
   ## Description
   Brief description of changes

   ## Related Issue
   Fixes #123

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] Added new tests
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new warnings
   ```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Avoid `any` types - use proper typing
- Prefer interfaces over type aliases for object types
- Use descriptive variable and function names
- Keep functions small and focused

### Code Style

- We use ESLint and Prettier for code formatting
- Run `pnpm run format` before committing
- Maximum line length: 120 characters
- Use early returns to reduce nesting
- Prefer async/await over promises

### File Structure

```
src/
├── cli.ts           # CLI entry point
├── commands/        # Command implementations
├── core/           # Core business logic
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── __tests__/      # Test files
```

## Testing

### Test Requirements

- Write tests for all new features
- Maintain or improve code coverage (target: 80%+)
- Test both success and error cases
- Use descriptive test names

### Test Structure

```typescript
describe('CommandName', () => {
  describe('feature/scenario', () => {
    it('should do something specific', () => {
      // Arrange
      const input = createTestInput();
      
      // Act
      const result = performAction(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run tests with coverage
pnpm run test:coverage

# Run specific test file
pnpm test src/__tests__/commands/create.test.ts
```

## Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Update CHANGELOG.md following Keep a Changelog format
- Include code examples in documentation
- Keep documentation concise and clear

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
feat(create): add support for custom templates
fix(tmux): resolve session naming conflict
docs(readme): update installation instructions
test(sync): add tests for file sync feature
```

## Issue Guidelines

### Creating Issues

#### Bug Reports
Include:
- Clear description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- System information (OS, Node version, etc.)
- Error messages/stack traces

#### Feature Requests
Include:
- Problem description
- Proposed solution
- Alternative solutions considered
- Use cases

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `question`: Further information requested

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion in GitHub Discussions
- Tag maintainers in PR comments

Thank you for contributing! 🎉