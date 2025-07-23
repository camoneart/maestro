# 🔸 template

Command to manage worktree templates for consistent project setup and configuration. Enables creating, saving, and applying reusable worktree configurations across projects.

## Overview

```bash
mst template [options]
```

## Usage Examples

### Basic Usage

```bash
# List available templates
mst template --list

# Apply existing template
mst template --apply feature

# Save current configuration as template
mst template --save my-setup

# Edit existing template
mst template --edit feature
```

### Advanced Usage

```bash
# Global template management
mst template --list --global
mst template --save backend-dev --global

# Delete template
mst template --delete old-template

# Create template with custom configuration
mst template --save custom-flow --description "Full-stack development setup"
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--list` | | List available templates | `false` |
| `--save <name>` | | Save current config as template | none |
| `--apply <name>` | | Apply template configuration | none |
| `--delete <name>` | | Delete template | none |
| `--edit <name>` | | Edit existing template | none |
| `--global` | | Manage global templates | `false` |

## Template Structure

### Template Definition

Templates are stored as JSON files containing worktree configuration:

```json
{
  "name": "feature-development",
  "description": "Standard feature development setup",
  "config": {
    "branchPrefix": "feature/",
    "autoSetup": true,
    "syncFiles": [".env", ".env.local"],
    "editor": "cursor",
    "tmux": true,
    "claude": true,
    "hooks": {
      "afterCreate": ["npm install", "npm run dev"],
      "beforeDelete": "npm run cleanup"
    },
    "customFiles": [
      {
        "path": ".vscode/settings.json",
        "content": "{\n  \"editor.formatOnSave\": true\n}"
      }
    ]
  }
}
```

### Configuration Options

Templates can include:

- **Branch settings**: Prefix, naming conventions
- **Environment setup**: Auto-install dependencies
- **File synchronization**: Copy specific files
- **Editor integration**: Preferred editor
- **Tool integration**: tmux, Claude Code
- **Lifecycle hooks**: Commands to run at specific times
- **Custom files**: Template-specific configuration files

## Template Management

### Listing Templates

```bash
# List project templates
mst template --list
```

**Sample output:**
```
📋 Available Templates:

Local Templates:
  ✅ feature        - Feature development with hot reload
  ✅ bugfix         - Bug fix workflow with testing
  ✅ experiment     - Experimental development setup

Global Templates:
  🌍 full-stack     - Complete full-stack development
  🌍 backend-api    - Backend API development
  🌍 frontend-ui    - Frontend UI development
```

### Saving Templates

```bash
# Save current project configuration
mst template --save my-workflow

# Save with description
mst template --save api-dev --description "API development with database"
```

**Interactive prompts:**
```
? Template name: api-development
? Description: REST API development with PostgreSQL
? Include current editor settings? (Y/n)
? Include tmux configuration? (Y/n)
? Include custom files? (Y/n)

✅ Template 'api-development' saved successfully
```

### Applying Templates

```bash
# Apply template to new worktree
mst create feature/auth --template feature-development

# Apply template to existing configuration
mst template --apply backend-api
```

### Editing Templates

```bash
# Edit template in default editor
mst template --edit feature

# Template file opens for editing
# Changes are saved automatically
```

## Template Locations

### Local Templates

Stored in project directory:
```
.maestro/templates/
├── feature.json
├── bugfix.json
└── experiment.json
```

### Global Templates

Stored in user home directory:
```
~/.maestro/templates/
├── full-stack.json
├── backend-api.json
└── frontend-ui.json
```

## Built-in Templates

### Feature Development

```json
{
  "name": "feature",
  "description": "Standard feature development",
  "config": {
    "branchPrefix": "feature/",
    "autoSetup": true,
    "editor": "cursor",
    "claude": true,
    "hooks": {
      "afterCreate": "npm install"
    }
  }
}
```

### Bug Fix

```json
{
  "name": "bugfix",
  "description": "Bug fix with testing focus",
  "config": {
    "branchPrefix": "bugfix/",
    "autoSetup": true,
    "hooks": {
      "afterCreate": ["npm install", "npm test"]
    }
  }
}
```

### Experimental

```json
{
  "name": "experiment",
  "description": "Experimental development",
  "config": {
    "branchPrefix": "experiment/",
    "tmux": true,
    "editor": "cursor",
    "hooks": {
      "afterCreate": "npm install --no-save"
    }
  }
}
```

## Advanced Features

### Template Inheritance

Templates can inherit from other templates:

```json
{
  "name": "advanced-feature",
  "extends": "feature",
  "config": {
    "claude": true,
    "customFiles": [
      {
        "path": "DEVELOPMENT.md",
        "content": "# Development Notes\n\nThis is an advanced feature branch."
      }
    ]
  }
}
```

### Conditional Configuration

Templates can include conditional logic:

```json
{
  "name": "responsive-template",
  "config": {
    "editor": "${PREFERRED_EDITOR:-cursor}",
    "hooks": {
      "afterCreate": "${NODE_ENV === 'development' ? 'npm run dev' : 'npm install'}"
    }
  }
}
```

### Variables and Substitution

Templates support variable substitution:

```json
{
  "name": "project-template",
  "config": {
    "customFiles": [
      {
        "path": "README.md",
        "content": "# ${PROJECT_NAME}\n\nDeveloped by ${AUTHOR_NAME}"
      }
    ]
  }
}
```

## Integration with Worktree Creation

### Using Templates with Create

```bash
# Create with specific template
mst create feature/auth --template feature-development

# Interactive template selection
mst create feature/auth --template
```

### Template-based Workflows

```bash
# 1. Save current optimal setup
mst template --save optimal-flow

# 2. Use for future worktrees
mst create feature/payments --template optimal-flow

# 3. Share with team (global template)
mst template --save team-standard --global
```

## Best Practices

### 1. Descriptive Names

```bash
# Use clear, descriptive template names
mst template --save frontend-react-ts
mst template --save backend-node-express
mst template --save fullstack-nextjs
```

### 2. Documentation

```json
{
  "name": "template-name",
  "description": "Detailed description of when and how to use this template",
  "config": {
    // Include comments in JSON (if supported)
  }
}
```

### 3. Team Sharing

```bash
# Share useful templates globally
mst template --save team-frontend --global --description "Standard frontend setup for our team"

# Export/import templates
cp ~/.maestro/templates/team-standard.json ./team-templates/
```

## Troubleshooting

### Common Issues

1. **Template not found**
   ```bash
   # Check available templates
   mst template --list
   mst template --list --global
   ```

2. **Template syntax error**
   ```bash
   # Validate JSON syntax
   mst template --edit template-name
   # Fix JSON formatting
   ```

3. **Permission issues with global templates**
   ```bash
   # Check directory permissions
   ls -la ~/.maestro/templates/
   mkdir -p ~/.maestro/templates/
   ```

## Related Commands

- [`mst create`](./create.md) - Create worktrees using templates
- [`mst config`](./config.md) - Base configuration for templates
- [`mst list`](./list.md) - View worktrees created from templates