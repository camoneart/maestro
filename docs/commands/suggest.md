# 🔸 suggest

Command to provide AI-powered suggestions for branch names, commit messages, PR descriptions, and code reviews. Integrates with Claude to enhance development workflows with intelligent automation.

## Overview

```bash
mst suggest [options]
```

## Usage Examples

### Basic Usage

```bash
# Suggest branch name based on current changes
mst suggest --branch

# Generate commit message from staged changes
mst suggest --commit

# Create PR description from branch changes
mst suggest --pr 123

# Get issue-based suggestions
mst suggest --issue 456
```

### Advanced Usage

```bash
# Suggest with custom description
mst suggest --branch --description "Add user authentication system"

# AI-powered code review
mst suggest --review --diff

# Combine multiple suggestion types
mst suggest --commit --description "Fix memory leak in worker threads"
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--branch` | | Suggest branch names | `false` |
| `--commit` | | Generate commit messages | `false` |
| `--issue <number>` | | Suggest based on GitHub issue | none |
| `--pr <number>` | | Generate PR description | none |
| `--description <text>` | | Custom description for context | none |
| `--diff` | | Include diff in suggestions | `false` |
| `--review` | | AI-powered code review | `false` |

## Suggestion Types

### Branch Name Suggestions

```bash
# Auto-suggest based on current changes
mst suggest --branch
```

**Sample output:**
```
🤖 AI Branch Name Suggestions:

1. feature/user-authentication
2. feat/auth-system
3. add/login-functionality
4. feature/secure-auth
5. implement/user-login

? Select a branch name: (Use arrow keys)
❯ feature/user-authentication
  feat/auth-system
  add/login-functionality
```

### Commit Message Generation

```bash
# Generate from staged changes
git add .
mst suggest --commit
```

**Sample output:**
```
🤖 AI Commit Message Suggestions:

1. feat: implement user authentication with JWT tokens
2. add: user login and registration endpoints
3. feature: secure authentication system with password hashing
4. implement: JWT-based user authentication flow
5. add: user auth with bcrypt password encryption

? Select a commit message: (Use arrow keys)
❯ feat: implement user authentication with JWT tokens
```

### PR Description Generation

```bash
# Generate description for existing PR
mst suggest --pr 123
```

**Sample output:**
```
🤖 AI PR Description:

## Summary
This PR implements a comprehensive user authentication system using JWT tokens.

## Changes
- Added user registration and login endpoints
- Implemented JWT token generation and validation
- Added password hashing with bcrypt
- Created authentication middleware

## Testing
- Unit tests for auth endpoints
- Integration tests for JWT validation
- Manual testing of login flow

## Breaking Changes
None

Copy this description? (y/N)
```

### Issue-based Suggestions

```bash
# Generate suggestions based on GitHub issue
mst suggest --issue 456
```

Uses GitHub issue context to provide relevant suggestions for:
- Branch naming conventions
- Implementation approach
- Testing strategies
- Documentation needs

### AI Code Review

```bash
# AI-powered code review suggestions
mst suggest --review --diff
```

**Sample output:**
```
🤖 AI Code Review Suggestions:

1. Consider adding error handling for the API call on line 23
2. The function could benefit from JSDoc documentation
3. Memory leak potential: ensure proper cleanup of event listeners
4. Performance: consider memoizing expensive calculations
5. Security: validate user input before database queries

? Apply any of these suggestions? (y/N)
```

## AI Integration

### Claude Integration

The suggest command integrates with Claude AI to provide:

- **Context-aware suggestions** based on code changes
- **Natural language processing** of issue descriptions
- **Code pattern recognition** for naming conventions
- **Best practice recommendations** for commit messages

### Prompt Engineering

Maestro uses carefully crafted prompts to ensure:

- **Consistent naming conventions** following project patterns
- **Semantic commit messages** following conventional commits
- **Comprehensive PR descriptions** with proper structure
- **Actionable code review feedback**

## Configuration

### AI Model Settings

Configure in `.maestro.json`:

```json
{
  "ai": {
    "model": "claude-3-sonnet",
    "maxSuggestions": 5,
    "temperature": 0.7,
    "conventions": {
      "branchPrefix": "feature/",
      "commitFormat": "conventional",
      "reviewStyle": "constructive"
    }
  }
}
```

### Custom Prompts

Customize suggestion prompts:

```json
{
  "ai": {
    "prompts": {
      "branch": "Generate branch names following our team conventions...",
      "commit": "Create semantic commit messages that...",
      "review": "Provide code review focusing on..."
    }
  }
}
```

## Workflow Integration

### Development Flow

```bash
# 1. Start new feature
BRANCH=$(mst suggest --branch --description "Add payment processing")
mst create "$BRANCH"

# 2. Make changes and commit
git add .
COMMIT=$(mst suggest --commit)
git commit -m "$COMMIT"

# 3. Create PR with AI description
gh pr create --title "$COMMIT" --body "$(mst suggest --pr)"
```

### Code Review Flow

```bash
# 1. Review changes with AI assistance
mst suggest --review --diff

# 2. Apply suggested improvements
# ... make changes ...

# 3. Generate improved commit message
mst suggest --commit --description "Address code review feedback"
```

## Best Practices

### 1. Provide Context

```bash
# Better suggestions with context
mst suggest --branch --description "Implement OAuth2 authentication with Google and GitHub providers"

# vs basic usage
mst suggest --branch
```

### 2. Review AI Suggestions

Always review and customize AI suggestions:

```bash
# Don't blindly accept - review and edit
mst suggest --commit | head -1 > commit_msg.txt
# Edit commit_msg.txt as needed
git commit -F commit_msg.txt
```

### 3. Combine with Manual Input

```bash
# Use AI as starting point, then customize
BASE_BRANCH=$(mst suggest --branch --description "API refactoring" | head -1)
FINAL_BRANCH="refactor/${BASE_BRANCH#feature/}"
mst create "$FINAL_BRANCH"
```

## Troubleshooting

### Common Issues

1. **AI service unavailable**
   ```bash
   # Check network connection
   # Verify API keys in configuration
   ```

2. **Poor suggestions quality**
   ```bash
   # Provide more context with --description
   # Check diff content with --diff
   # Adjust temperature in configuration
   ```

3. **No staged changes for commit suggestions**
   ```bash
   # Stage changes first
   git add .
   mst suggest --commit
   ```

## Privacy and Security

### Data Handling

- **Code content** is sent to AI service for analysis
- **No persistent storage** of code by maestro
- **Respect privacy settings** in configuration
- **Local processing** where possible

### Security Considerations

- **Review suggestions** before applying
- **Avoid including secrets** in AI prompts
- **Configure AI service** according to team policies

## Related Commands

- [`mst create`](./create.md) - Create branches with AI-suggested names
- [`mst review`](./review.md) - Use AI suggestions in code reviews
- [`mst github`](./github.md) - Create PRs with AI-generated descriptions