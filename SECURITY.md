# Security Policy

## Supported Versions

Currently, we support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take the security of shadow-clone-jutsu seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:
- Primary: [Create a security advisory](https://github.com/hashiramaendure/shadow-clone-jutsu/security/advisories/new) on GitHub
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

## Security Best Practices

When using shadow-clone-jutsu, please follow these security best practices:

1. **Keep the tool updated**: Always use the latest version
2. **Secure your Git credentials**: Use SSH keys or secure credential managers
3. **Review worktree permissions**: Ensure proper file permissions on created worktrees
4. **Audit third-party integrations**: Be cautious when integrating with external services
5. **Use secure communication**: Always use HTTPS for Git operations when possible

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

We appreciate the security research community's efforts in helping keep shadow-clone-jutsu secure. Reporters who follow this policy will be publicly acknowledged (unless they prefer to remain anonymous).

Thank you for helping keep shadow-clone-jutsu and its users safe!