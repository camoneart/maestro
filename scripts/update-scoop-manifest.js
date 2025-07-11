#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { execa } from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function getSHA256FromURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const hash = createHash('sha256')
      response.on('data', (chunk) => hash.update(chunk))
      response.on('end', () => resolve(hash.digest('hex')))
      response.on('error', reject)
    }).on('error', reject)
  })
}

async function getSHA256() {
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

async function updateManifest() {
  try {
    // package.jsonからバージョンを取得
    const packageJsonPath = path.join(__dirname, '..', 'package.json')
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
    const version = packageJson.version

    // Scoop manifestのパス
    const manifestPath = path.join(__dirname, '..', 'scoop', 'shadow-clone-jutsu.json')
    const manifestContent = await readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(manifestContent)

    // バージョンを更新
    manifest.version = version

    // URLを更新
    const newUrl = `https://registry.npmjs.org/shadow-clone-jutsu/-/shadow-clone-jutsu-${version}.tgz`
    manifest.architecture['64bit'].url = newUrl

    // SHA256を更新（本番環境では実際のSHA256を計算）
    const sha256 = await getSHA256()
    manifest.architecture['64bit'].hash = sha256

    // ファイルを更新
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

    console.log(`✅ Scoop manifest updated for version ${version}`)
    console.log(`   URL: ${newUrl}`)
    console.log(`   SHA256: ${sha256}`)
  } catch (error) {
    console.error('❌ Failed to update Scoop manifest:', error)
    process.exit(1)
  }
}

updateManifest()