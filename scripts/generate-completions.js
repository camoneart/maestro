#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Create completion directories
const completionDir = join(rootDir, 'completion')
const bashDir = join(completionDir, 'bash')
const zshDir = join(completionDir, 'zsh')
const fishDir = join(completionDir, 'fish')

mkdirSync(completionDir, { recursive: true })
mkdirSync(bashDir, { recursive: true })
mkdirSync(zshDir, { recursive: true })
mkdirSync(fishDir, { recursive: true })

console.log('🎼 Generating shell completions...')

try {
  // Generate completions using the CLI
  const bashCompletion = execSync('node dist/cli.js completion bash', { 
    cwd: rootDir,
    encoding: 'utf-8'
  })
  const zshCompletion = execSync('node dist/cli.js completion zsh', { 
    cwd: rootDir,
    encoding: 'utf-8'
  })
  const fishCompletion = execSync('node dist/cli.js completion fish', { 
    cwd: rootDir,
    encoding: 'utf-8'
  })

  // Write completion files
  writeFileSync(join(bashDir, 'mst'), bashCompletion)
  writeFileSync(join(zshDir, '_mst'), zshCompletion)
  writeFileSync(join(fishDir, 'mst.fish'), fishCompletion)

  console.log('✅ Shell completions generated successfully!')
  console.log('   - completion/bash/mst')
  console.log('   - completion/zsh/_mst')
  console.log('   - completion/fish/mst.fish')
} catch (error) {
  console.error('❌ Failed to generate completions:', error.message)
  process.exit(1)
}