# AI Diff Review Feature

The AI diff review feature uses Claude Code to analyze your git diff and provide a comprehensive code review summary.

## Requirements

- Claude Code must be installed and available in PATH
- Git repository with uncommitted changes

## Usage

```bash
# Review current changes
scj suggest --review
scj suggest -r

# Interactive mode (select "差分レビュー")
scj suggest
```

## What it reviews

The AI review analyzes:

1. **Change Overview**: 1-2 sentence summary of changes
2. **Main Changes**: Bullet-point list of key modifications
3. **Potential Issues**: Identifies possible problems or improvement areas
4. **Security & Performance**: Evaluates security implications and performance impacts

## Output Options

After review, you can:
- View the review in terminal
- Save the review to a markdown file with timestamp
- The saved file includes both the review and the original diff

## Review Process

1. Collects git diff (staged and unstaged changes)
2. Creates a structured prompt for Claude Code
3. Executes Claude Code with the diff context
4. Displays formatted review results
5. Optionally saves to `review-YYYY-MM-DD.md`

## Use Cases

- **Pre-commit Review**: Review changes before committing
- **Code Quality Check**: Get AI insights on code improvements
- **Security Audit**: Identify potential security issues
- **Documentation**: Save reviews for project documentation

## Example Output

```
👀 差分レビュー結果:

## 変更の概要
Added user authentication middleware with JWT token validation.

## 主な変更点
- Created auth middleware function
- Added JWT token verification
- Implemented error handling for invalid tokens
- Added user context to requests

## 潜在的な問題や改善点
- Consider adding token expiration handling
- Missing rate limiting on auth endpoints
- Could benefit from refresh token implementation

## セキュリティや性能への影響
- Secure: Uses proper JWT verification
- Performance: Adds ~10ms per request for token validation
- Recommendation: Add token caching for better performance
```

## Tips

- Review frequently for smaller, more focused feedback
- Use before important commits or merges
- Save reviews for code review discussions
- Combine with `--commit` for review + commit message