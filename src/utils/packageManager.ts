import { existsSync, readFileSync } from 'fs'
import path from 'path'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'none'

export function detectPackageManager(projectPath: string): PackageManager {
  if (existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  
  if (existsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn'
  }
  
  if (existsSync(path.join(projectPath, 'package-lock.json'))) {
    return 'npm'
  }

  const packageJsonPath = path.join(projectPath, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (packageJson.packageManager) {
        const manager = packageJson.packageManager.split('@')[0]
        if (['pnpm', 'npm', 'yarn'].includes(manager)) {
          return manager as PackageManager
        }
      }
    } catch {
      // package.jsonの読み込みエラーは無視
    }
  }

  return 'npm'
}