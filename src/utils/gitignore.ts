import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import path from 'path'

export async function addToGitignore(projectPath: string, entry: string, comment?: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore')

  let gitignoreContent = ''
  let entryExists = false

  if (existsSync(gitignorePath)) {
    gitignoreContent = readFileSync(gitignorePath, 'utf-8')
    const lines = gitignoreContent.split('\n')
    entryExists = lines.some(line => line.trim() === entry.trim())
  }

  if (!entryExists) {
    let entryToAdd: string
    if (comment) {
      const commentLine = `# ${comment}`
      entryToAdd = gitignoreContent && !gitignoreContent.endsWith('\n') 
        ? `\n\n${commentLine}\n${entry}\n` 
        : `\n${commentLine}\n${entry}\n`
    } else {
      entryToAdd = gitignoreContent && !gitignoreContent.endsWith('\n') ? `\n${entry}\n` : `${entry}\n`
    }

    if (existsSync(gitignorePath)) {
      appendFileSync(gitignorePath, entryToAdd, 'utf-8')
    } else {
      writeFileSync(gitignorePath, entryToAdd, 'utf-8')
    }
  }
}

export function isEntryInGitignore(projectPath: string, entry: string): boolean {
  const gitignorePath = path.join(projectPath, '.gitignore')

  if (!existsSync(gitignorePath)) {
    return false
  }

  const gitignoreContent = readFileSync(gitignorePath, 'utf-8')
  const lines = gitignoreContent.split('\n')

  return lines.some(line => line.trim() === entry.trim())
}
