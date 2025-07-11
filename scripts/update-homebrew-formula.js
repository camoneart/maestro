#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function getSHA256(url) {
  try {
    // npm packコマンドでtarballを作成
    const { stdout } = await execa('npm', ['pack', '--json'])
    const packInfo = JSON.parse(stdout)[0]
    const tarballPath = packInfo.filename

    // tarballのSHA256を計算
    const content = await readFile(tarballPath)
    const hash = createHash('sha256').update(content).digest('hex')

    // tarballを削除
    await execa('rm', [tarballPath])

    return hash
  } catch (error) {
    console.error('Failed to calculate SHA256:', error)
    return 'PLACEHOLDER_SHA256'
  }
}

async function updateFormula() {
  try {
    // package.jsonからバージョンを取得
    const packageJsonPath = path.join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    const version = packageJson.version

    // Homebrew formulaのパス
    const formulaPath = path.join(__dirname, '..', 'homebrew', 'shadow-clone-jutsu.rb')
    let formulaContent = await readFile(formulaPath, 'utf8')

    // URLを更新
    const newUrl = `https://registry.npmjs.org/shadow-clone-jutsu/-/shadow-clone-jutsu-${version}.tgz`
    formulaContent = formulaContent.replace(
      /url ".*"/,
      `url "${newUrl}"`
    )

    // SHA256を更新（本番環境では実際のSHA256を計算）
    const sha256 = await getSHA256(newUrl)
    formulaContent = formulaContent.replace(
      /sha256 ".*"/,
      `sha256 "${sha256}"`
    )

    // ファイルを更新
    await writeFile(formulaPath, formulaContent)

    console.log(`✅ Homebrew formula updated for version ${version}`)
    console.log(`   URL: ${newUrl}`)
    console.log(`   SHA256: ${sha256}`)
  } catch (error) {
    console.error('❌ Failed to update Homebrew formula:', error)
    process.exit(1)
  }
}

updateFormula()