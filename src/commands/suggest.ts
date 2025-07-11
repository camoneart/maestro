import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'
import fs from 'fs/promises'
import path from 'path'
import { tmpdir } from 'os'

interface SuggestOptions {
  branch?: boolean
  commit?: boolean
  issue?: string
  pr?: string
  description?: string
  diff?: boolean
  review?: boolean
}

// Claude Codeを使ってブランチ名を提案
async function suggestBranchName(
  description: string,
  issueNumber?: string,
  prNumber?: string
): Promise<string[]> {
  const spinner = ora('Claude Codeでブランチ名を生成中...').start()

  try {
    // 一時ファイルにプロンプトを書き込む
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'scj-suggest-'))
    const promptPath = path.join(tempDir, 'prompt.md')

    let prompt = `# ブランチ名の提案\n\n`
    prompt += `以下の情報に基づいて、適切なGitブランチ名を5つ提案してください。\n\n`

    if (issueNumber) {
      prompt += `Issue番号: #${issueNumber}\n`
    }
    if (prNumber) {
      prompt += `PR番号: #${prNumber}\n`
    }
    prompt += `説明: ${description}\n\n`

    prompt += `## ルール:\n`
    prompt += `- 小文字とハイフンのみ使用\n`
    prompt += `- 最大50文字\n`
    prompt += `- 一般的な命名規則に従う（feature/, bugfix/, hotfix/, refactor/）\n`
    prompt += `- わかりやすく簡潔に\n\n`
    prompt += `## 出力形式:\n`
    prompt += `1. feature/auth-system\n`
    prompt += `2. bugfix/login-error\n`
    prompt += `（各行に1つずつ、番号付きで5つ）\n`

    await fs.writeFile(promptPath, prompt)

    // Claudeを起動してブランチ名を生成
    const outputPath = path.join(tempDir, 'suggestions.txt')

    // Claudeコマンドを実行（出力をファイルにリダイレクト）
    await execa('sh', ['-c', `claude "${promptPath}" > "${outputPath}"`], {
      stdio: 'pipe',
    })

    // 結果を読み込む
    const output = await fs.readFile(outputPath, 'utf-8')

    // パース（番号付きリストから抽出）
    const suggestions = output
      .split('\n')
      .filter(line => /^\d+\.\s+/.test(line))
      .map(line => line.replace(/^\d+\.\s+/, '').trim())
      .filter(s => s.length > 0)

    // 一時ファイルを削除
    await fs.rm(tempDir, { recursive: true, force: true })

    spinner.succeed('ブランチ名を生成しました')
    return suggestions
  } catch (error) {
    spinner.fail('ブランチ名の生成に失敗しました')
    throw error
  }
}

// Claude Codeを使ってコミットメッセージを提案
async function suggestCommitMessage(diffOutput?: string): Promise<string[]> {
  const spinner = ora('Claude Codeでコミットメッセージを生成中...').start()

  try {
    // 一時ファイルにプロンプトを書き込む
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'scj-suggest-'))
    const promptPath = path.join(tempDir, 'prompt.md')

    let prompt = `# Conventional Commitメッセージの提案\n\n`

    if (diffOutput) {
      prompt += `## 変更内容:\n\`\`\`diff\n${diffOutput}\n\`\`\`\n\n`
    } else {
      // git diffを実行して変更内容を取得
      const { stdout: diff } = await execa('git', ['diff', '--cached'])
      if (diff) {
        prompt += `## 変更内容:\n\`\`\`diff\n${diff}\n\`\`\`\n\n`
      } else {
        // ステージされていない場合は全体のdiff
        const { stdout: allDiff } = await execa('git', ['diff'])
        prompt += `## 変更内容:\n\`\`\`diff\n${allDiff}\n\`\`\`\n\n`
      }
    }

    prompt += `## ルール:\n`
    prompt += `- Conventional Commits形式を使用\n`
    prompt += `- タイプ: feat, fix, docs, style, refactor, test, chore\n`
    prompt += `- 形式: <type>(<scope>): <subject>\n`
    prompt += `- 日本語で説明を記載\n`
    prompt += `- 1行目は72文字以内\n\n`
    prompt += `## 出力形式:\n`
    prompt += `1. feat(auth): ユーザー認証機能を追加\n`
    prompt += `2. fix(login): ログインエラーを修正\n`
    prompt += `（各行に1つずつ、番号付きで5つ）\n`

    await fs.writeFile(promptPath, prompt)

    // Claudeを起動してコミットメッセージを生成
    const outputPath = path.join(tempDir, 'suggestions.txt')

    await execa('sh', ['-c', `claude "${promptPath}" > "${outputPath}"`], {
      stdio: 'pipe',
    })

    // 結果を読み込む
    const output = await fs.readFile(outputPath, 'utf-8')

    // パース
    const suggestions = output
      .split('\n')
      .filter(line => /^\d+\.\s+/.test(line))
      .map(line => line.replace(/^\d+\.\s+/, '').trim())
      .filter(s => s.length > 0)

    // 一時ファイルを削除
    await fs.rm(tempDir, { recursive: true, force: true })

    spinner.succeed('コミットメッセージを生成しました')
    return suggestions
  } catch (error) {
    spinner.fail('コミットメッセージの生成に失敗しました')
    throw error
  }
}

// Issueから情報を取得
async function getIssueInfo(issueNumber: string): Promise<{ title: string; body: string }> {
  const { stdout } = await execa('gh', ['issue', 'view', issueNumber, '--json', 'title,body'])
  return JSON.parse(stdout)
}

// PRから情報を取得
async function getPRInfo(prNumber: string): Promise<{ title: string; body: string }> {
  const { stdout } = await execa('gh', ['pr', 'view', prNumber, '--json', 'title,body'])
  return JSON.parse(stdout)
}

export const suggestCommand = new Command('suggest')
  .alias('sg')
  .description('Claude Codeでブランチ名やコミットメッセージを提案')
  .option('-b, --branch', 'ブランチ名を提案')
  .option('-c, --commit', 'コミットメッセージを提案')
  .option('-r, --review', 'git diffをレビューして要約')
  .option('-i, --issue <number>', 'Issue番号を指定')
  .option('-p, --pr <number>', 'PR番号を指定')
  .option('-d, --description <text>', '説明を指定')
  .option('--diff', 'git diffの内容を使用（コミットメッセージ提案時）')
  .action(async (options: SuggestOptions) => {
    try {
      const gitManager = new GitWorktreeManager()

      // Claudeコマンドが使えるか確認
      try {
        await execa('which', ['claude'])
      } catch {
        console.error(chalk.red('Claude Codeがインストールされていません'))
        console.log(chalk.yellow('以下のコマンドでインストールしてください:'))
        console.log(chalk.gray('  brew install claude'))
        process.exit(1)
      }

      // オプションが指定されていない場合はインタラクティブモード
      if (!options.branch && !options.commit && !options.review) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: '何を提案しますか？',
            choices: [
              { name: '🌿 ブランチ名', value: 'branch' },
              { name: '💬 コミットメッセージ', value: 'commit' },
              { name: '👀 差分レビュー', value: 'review' },
              { name: '🎯 ブランチ名とコミットメッセージ', value: 'both' },
            ],
          },
        ])

        options.branch = action === 'branch' || action === 'both'
        options.commit = action === 'commit' || action === 'both'
        options.review = action === 'review'
      }

      // ブランチ名の提案
      if (options.branch) {
        let description = options.description

        // Issue/PRから情報を取得
        if (options.issue) {
          const issueInfo = await getIssueInfo(options.issue)
          description = description || issueInfo.title
        } else if (options.pr) {
          const prInfo = await getPRInfo(options.pr)
          description = description || prInfo.title
        }

        // 説明がない場合は入力を求める
        if (!description) {
          const { inputDescription } = await inquirer.prompt([
            {
              type: 'input',
              name: 'inputDescription',
              message: '作業内容を簡潔に説明してください:',
              validate: input => input.trim().length > 0 || '説明を入力してください',
            },
          ])
          description = inputDescription
        }

        // ブランチ名を生成
        const branchSuggestions = await suggestBranchName(
          description || '',
          options.issue,
          options.pr
        )

        if (branchSuggestions.length > 0) {
          console.log(chalk.bold('\n🌿 提案されたブランチ名:\n'))

          const { selectedBranch } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedBranch',
              message: 'ブランチ名を選択:',
              choices: [
                ...branchSuggestions.map(s => ({ name: s, value: s })),
                { name: chalk.gray('カスタム入力'), value: 'custom' },
              ],
            },
          ])

          let finalBranch = selectedBranch
          if (selectedBranch === 'custom') {
            const { customBranch } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customBranch',
                message: 'ブランチ名を入力:',
                validate: input => input.trim().length > 0 || 'ブランチ名を入力してください',
              },
            ])
            finalBranch = customBranch
          }

          // ブランチを作成するか確認
          const { createBranch } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'createBranch',
              message: `ブランチ '${finalBranch}' を作成しますか？`,
              default: true,
            },
          ])

          if (createBranch) {
            await gitManager.createWorktree(finalBranch)
            console.log(chalk.green(`✨ ブランチ '${finalBranch}' を作成しました`))
          }
        }
      }

      // コミットメッセージの提案
      if (options.commit) {
        let diffOutput

        if (options.diff) {
          // git diffの結果を取得
          const { stdout: diff } = await execa('git', ['diff', '--cached'])
          diffOutput = diff || (await execa('git', ['diff'])).stdout
        }

        const commitSuggestions = await suggestCommitMessage(diffOutput)

        if (commitSuggestions.length > 0) {
          console.log(chalk.bold('\n💬 提案されたコミットメッセージ:\n'))

          const { selectedCommit } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedCommit',
              message: 'コミットメッセージを選択:',
              choices: [
                ...commitSuggestions.map(s => ({ name: s, value: s })),
                { name: chalk.gray('カスタム入力'), value: 'custom' },
              ],
            },
          ])

          let finalCommit = selectedCommit
          if (selectedCommit === 'custom') {
            const { customCommit } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customCommit',
                message: 'コミットメッセージを入力:',
                validate: input => input.trim().length > 0 || 'メッセージを入力してください',
              },
            ])
            finalCommit = customCommit
          }

          // クリップボードにコピー
          try {
            await execa('pbcopy', { input: finalCommit })
            console.log(chalk.green(`\n✨ コミットメッセージをクリップボードにコピーしました`))
            console.log(chalk.gray(`メッセージ: ${finalCommit}`))
          } catch {
            console.log(chalk.green(`\n✨ コミットメッセージ:`))
            console.log(chalk.cyan(finalCommit))
          }
        }
      }

      // 差分レビュー
      if (options.review) {
        const spinner = ora('差分を取得中...').start()

        try {
          // git diffの結果を取得
          const { stdout: stagedDiff } = await execa('git', ['diff', '--cached'])
          const { stdout: unstagedDiff } = await execa('git', ['diff'])
          const diffOutput = stagedDiff || unstagedDiff

          if (!diffOutput) {
            spinner.fail('変更がありません')
            return
          }

          spinner.text = 'Claude Codeで差分をレビュー中...'

          // 一時ファイルにdiffとプロンプトを書き込む
          const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'scj-review-'))
          const diffPath = path.join(tempDir, 'diff.patch')
          const promptPath = path.join(tempDir, 'prompt.md')

          await fs.writeFile(diffPath, diffOutput)

          let prompt = `# コード差分レビュー\n\n`
          prompt += `以下のgit diffをレビューして、変更内容を要約してください。\n\n`
          prompt += `## 要求事項:\n`
          prompt += `1. 変更の概要（1-2文）\n`
          prompt += `2. 主な変更点（箇条書き）\n`
          prompt += `3. 潜在的な問題や改善点\n`
          prompt += `4. セキュリティや性能への影響\n\n`
          prompt += `## 差分:\n`
          prompt += `\`\`\`diff\n${diffOutput}\n\`\`\`\n`

          await fs.writeFile(promptPath, prompt)

          // Claudeコマンドを実行してレビューを取得
          const { stdout } = await execa('claude', [promptPath], {
            env: { ...process.env },
          })

          spinner.succeed('レビュー完了')

          console.log(chalk.bold('\n👀 差分レビュー結果:\n'))
          console.log(stdout)

          // レビュー結果を保存するか確認
          const { saveReview } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'saveReview',
              message: 'レビュー結果をファイルに保存しますか？',
              default: false,
            },
          ])

          if (saveReview) {
            const reviewPath = path.join(
              process.cwd(),
              `review-${new Date().toISOString().split('T')[0]}.md`
            )
            await fs.writeFile(
              reviewPath,
              `# コードレビュー ${new Date().toISOString()}\n\n${stdout}\n\n## 差分\n\`\`\`diff\n${diffOutput}\n\`\`\``
            )
            console.log(chalk.green(`\n✅ レビュー結果を保存しました: ${reviewPath}`))
          }

          // 一時ファイルをクリーンアップ
          await fs.rm(tempDir, { recursive: true })
        } catch (error) {
          spinner.fail('レビューに失敗しました')
          throw error
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
