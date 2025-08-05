# 🔸 completion

Command to generate shell completion scripts for maestro. Provides intelligent tab completion for commands, options, and context-aware suggestions across bash, zsh, and fish shells.

## Overview

```bash
mst completion [shell]
```

## Usage Examples

### Basic Usage

```bash
# Display available shells and usage instructions
mst completion

# Generate bash completion script
mst completion bash

# Generate zsh completion script
mst completion zsh

# Generate fish completion script
mst completion fish
```

### Installation Examples

```bash
# Install bash completion
mst completion bash >> ~/.bashrc
source ~/.bashrc

# Install zsh completion
mkdir -p ~/.zsh/completions
mst completion zsh > ~/.zsh/completions/_maestro

# Install fish completion
mkdir -p ~/.config/fish/completions
mst completion fish > ~/.config/fish/completions/maestro.fish
```

## Supported Shells

| Shell | File Location | Installation Method |
|-------|---------------|-------------------|
| **bash** | `~/.bashrc` | Append to bashrc file |
| **zsh** | `~/.zsh/completions/_maestro` | Save to completions directory |
| **fish** | `~/.config/fish/completions/maestro.fish` | Save to completions directory |

## Completion Features

### Command Completion

All main commands and aliases are completed:

```bash
mst <TAB>
# Suggests: create, list, delete, shell, exec, attach, github,
#          config, completion, tmux, where
#          ls, rm, sh, e, a, gh, t, w (aliases)
```

### Intelligent Context Completion

#### Worktree-based Commands

Commands that operate on existing worktrees automatically suggest available worktree branches:

```bash
mst shell <TAB>
# Suggests existing worktree branches: feature/auth, bugfix/login, etc.

mst delete <TAB>
# Suggests existing worktree branches: feature/auth, bugfix/login, etc.
```

#### Branch-based Commands

Commands that create new worktrees suggest existing Git branches:

```bash
mst create <TAB>
# Suggests existing local branches: main, develop, feature/existing, etc.
```

#### GitHub Integration

```bash
mst github <TAB>
# Suggests: checkout, pr, issue
```

#### Configuration Commands

```bash
mst config <TAB>
# Suggests: init, show, path, get, set, reset
```

## Shell-Specific Setup

### Bash Setup

```bash
# Method 1: Direct append to bashrc
maestro completion bash >> ~/.bashrc
source ~/.bashrc

# Method 2: Create separate completion file
maestro completion bash > ~/.local/share/bash-completion/completions/maestro
```

### Zsh Setup

```bash
# 1. Create completions directory
mkdir -p ~/.zsh/completions

# 2. Save completion script
maestro completion zsh > ~/.zsh/completions/_maestro

# 3. Add to ~/.zshrc (if not already present)
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc

# 4. Restart shell or source zshrc
source ~/.zshrc
```

### Fish Setup

```bash
# 1. Create completions directory
mkdir -p ~/.config/fish/completions

# 2. Save completion script
maestro completion fish > ~/.config/fish/completions/maestro.fish

# 3. Completion is automatically available in new fish sessions
```

## Troubleshooting

### Common Issues

1. **Completion not working after installation**
   ```bash
   # Restart shell or source configuration
   source ~/.bashrc      # bash
   source ~/.zshrc       # zsh
   exec fish            # fish
   ```

2. **Command not found errors**
   ```bash
   # Ensure maestro is in PATH
   which maestro
   ```

3. **Git-based completions not working**
   ```bash
   # Ensure you're in a Git repository
   git status
   ```

## Related Commands

- [`mst config`](./config.md) - Configure maestro settings
- [`mst list`](./list.md) - View available worktrees for completion context