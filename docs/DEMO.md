# Creating Demo Media

This document explains how to create demo media for shadow-clone-jutsu.

## asciinema Recording

### Installation

```bash
# macOS
brew install asciinema

# Linux
sudo apt-get install asciinema
```

### Recording

```bash
# Start recording
asciinema rec demo.cast

# Run your demo commands
scj create feature-demo
scj list
scj where feature-demo
# ... etc

# Exit to stop recording (Ctrl+D)
```

### Upload and Share

```bash
# Upload to asciinema.org
asciinema upload demo.cast

# Or save locally
asciinema play demo.cast
```

## Creating GIF from Terminal Recording

### Using terminalizer

```bash
# Install terminalizer
npm install -g terminalizer

# Record
terminalizer record demo

# Play recording
terminalizer play demo

# Generate GIF
terminalizer render demo
```

### Using ttygif (macOS)

```bash
# Install dependencies
brew install imagemagick ttyrec

# Record terminal session
ttyrec myrecording

# Convert to GIF
ttygif myrecording
```

## Demo Script Example

```bash
#!/bin/bash

# Clear screen
clear

# Show tool version
echo "$ scj --version"
scj --version
sleep 2

# Create a new worktree
echo "$ scj create feature-awesome"
scj create feature-awesome -y
sleep 3

# List worktrees
echo "$ scj list"
scj list
sleep 2

# Show interactive features
echo "$ scj github"
# (demonstrate interactive selection)

# Clean up
echo "$ scj delete feature-awesome"
scj delete feature-awesome -y
```

## Best Practices

1. **Keep it short**: Aim for 30-60 second demos
2. **Use clear commands**: Show the most common use cases
3. **Add pauses**: Give viewers time to read output
4. **Clean terminal**: Start with a clear screen
5. **Consistent theme**: Use a clean terminal theme

## Adding to README

### asciinema

```markdown
[![asciicast](https://asciinema.org/a/YOUR_ID.svg)](https://asciinema.org/a/YOUR_ID)
```

### GIF

```markdown
![Demo](./docs/demo.gif)
```

## Recommended Terminal Settings

- Font: Monaco or Fira Code (12-14pt)
- Theme: Dark background with good contrast
- Size: 80x24 or 100x30
- Prompt: Simple and clean