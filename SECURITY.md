# Security Policy

## Supported Versions

Currently, we support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of maestro seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:
- Primary: [Create a security advisory](https://github.com/camoneart/maestro/security/advisories/new) on GitHub
- Alternative: Open an issue with the `security` label (for low-severity issues only)

### What to Include

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours, we will acknowledge receipt of your report
- **Assessment**: Within 7 days, we will provide an initial assessment of the issue
- **Resolution**: We aim to resolve confirmed vulnerabilities within 30 days

### Security Update Process

1. The security team will investigate the issue and determine its impact
2. Fixes will be developed in a private repository
3. A new release will be prepared with the security fix
4. The vulnerability will be publicly disclosed after the fix is available

## Built-in Security Features

Maestro includes several built-in security measures to protect against common vulnerabilities:

### Path Validation and Directory Traversal Protection

- **Automatic Path Validation**: All file operations are validated to prevent directory traversal attacks
- **Boundary Enforcement**: File operations are restricted to stay within designated worktree directories
- **Pattern Detection**: Automatically detects and blocks dangerous path patterns like `../` and `..`
- **Safe Path Resolution**: Uses absolute path resolution to prevent traversal attacks

### Loop Detection and Prevention

- **Infinite Loop Protection**: Detects and prevents infinite directory creation loops
- **Depth Limiting**: Enforces maximum directory depth limits (configurable, default: 10 levels)
- **Creation Tracking**: Monitors directory creation patterns to detect suspicious behavior
- **Resource Protection**: Prevents filesystem exhaustion from malicious or accidental loops

### Branch Name Security

- **Slash-containing Branch Names**: Safely handles branch names with slashes that could cause path traversal
- **Path Normalization**: Automatically normalizes dangerous branch names to safe equivalents
- **Boundary Validation**: Ensures branch-based directory operations stay within worktree boundaries

## Security Best Practices

When using maestro, please follow these security best practices:

1. **Keep the tool updated**: Always use the latest version to get security patches
2. **Secure your Git credentials**: Use SSH keys or secure credential managers
3. **Review worktree permissions**: Ensure proper file permissions on created worktrees
4. **Audit third-party integrations**: Be cautious when integrating with external services
5. **Use secure communication**: Always use HTTPS for Git operations when possible
6. **Monitor file sync operations**: Review file synchronization patterns, especially with `--auto` mode
7. **Validate branch names**: Be cautious with branch names containing special characters or unusual patterns

## Scope

The following are within scope for security reports:

- Command injection vulnerabilities
- Path traversal issues
- Information disclosure
- Authentication/authorization bypasses
- Any vulnerability that could compromise user data or system security

The following are **out of scope**:

- Vulnerabilities in dependencies (report these to the dependency maintainers)
- Social engineering attacks
- Physical attacks
- Denial of Service (DoS) attacks that don't expose sensitive data

## Recognition

We appreciate the security research community's efforts in helping keep maestro secure. Reporters who follow this policy will be publicly acknowledged (unless they prefer to remain anonymous).

Thank you for helping keep maestro and its users safe!