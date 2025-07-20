import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { GitWorktreeManager } from '../core/git.js'
import { execa } from 'execa'

interface GraphOptions {
  format?: 'text' | 'mermaid' | 'dot'
  output?: string
  showCommits?: boolean
  showDates?: boolean
  depth?: number
}

interface BranchRelation {
  branch: string
  parent: string
  ahead: number
  behind: number
  lastCommit?: {
    hash: string
    date: Date
    message: string
  }
}

// ブランチの関係性を分析
import { Worktree } from '../types/index.js'

// ブランチとmainとの関係を取得
async function getBranchMainRelation(
  branch: string,
  worktreePath: string
): Promise<{
  ahead: number
  behind: number
  lastCommit?: { hash: string; date: Date; message: string }
} | null> {
  try {
    await execa('git', ['merge-base', branch, 'main'], { cwd: worktreePath })

    const { stdout: ahead } = await execa('git', ['rev-list', '--count', `main..${branch}`], {
      cwd: worktreePath,
    })

    const { stdout: behind } = await execa('git', ['rev-list', '--count', `${branch}..main`], {
      cwd: worktreePath,
    })

    const { stdout: lastCommitInfo } = await execa(
      'git',
      ['log', '-1', '--format=%H|%ai|%s', branch],
      { cwd: worktreePath }
    )

    const [hash, date, message] = lastCommitInfo.split('|')

    return {
      ahead: parseInt(ahead),
      behind: parseInt(behind),
      lastCommit: {
        hash: hash?.substring(0, 7) || '',
        date: new Date(date || ''),
        message: message?.substring(0, 50) || '',
      },
    }
  } catch {
    return null
  }
}

// より正確な親ブランチを検出
async function findBetterParent(
  branch: string,
  worktreePath: string,
  otherWorktrees: Worktree[]
): Promise<string> {
  let parent = 'main'

  for (const otherWorktree of otherWorktrees) {
    if (!otherWorktree.branch) continue

    const otherBranch = otherWorktree.branch.replace('refs/heads/', '')

    try {
      await execa('git', ['merge-base', branch, otherBranch], { cwd: worktreePath })

      const { stdout: isParent } = await execa(
        'git',
        ['rev-list', '--count', `${otherBranch}..${branch}`],
        { cwd: worktreePath }
      )

      if (parseInt(isParent) > 0 && parent === 'main') {
        parent = otherBranch
      }
    } catch {
      // エラーは無視
    }
  }

  return parent
}

async function analyzeBranchRelations(worktrees: Worktree[]): Promise<BranchRelation[]> {
  const relations: BranchRelation[] = []

  for (const worktree of worktrees) {
    if (!worktree.branch) continue

    const branch = worktree.branch.replace('refs/heads/', '')
    const branchRelation = await getBranchMainRelation(branch, worktree.path)

    if (!branchRelation) continue

    const otherWorktrees = worktrees.filter(wt => wt !== worktree)
    const parent = await findBetterParent(branch, worktree.path, otherWorktrees)

    relations.push({
      branch,
      parent,
      ahead: branchRelation.ahead,
      behind: branchRelation.behind,
      lastCommit: branchRelation.lastCommit,
    })
  }

  return relations
}

// テキスト形式でグラフを表示
function renderTextGraph(relations: BranchRelation[], options: GraphOptions): string {
  let output = chalk.bold('🌳 Worktree依存関係グラフ\n\n')

  // mainブランチ
  output += '📍 main\n'

  // 階層構造で表示
  const renderBranch = (branch: string, indent: number = 0) => {
    const relation = relations.find(r => r.branch === branch)
    if (!relation) return

    const prefix = '  '.repeat(indent) + '└─ '
    let line = prefix + chalk.cyan(branch)

    if (relation.ahead > 0 || relation.behind > 0) {
      line += chalk.gray(` (↑${relation.ahead} ↓${relation.behind})`)
    }

    if (options.showDates && relation.lastCommit) {
      const daysAgo = Math.floor(
        (Date.now() - relation.lastCommit.date.getTime()) / (1000 * 60 * 60 * 24)
      )
      line += chalk.gray(` - ${daysAgo}日前`)
    }

    if (options.showCommits && relation.lastCommit) {
      line += chalk.gray(
        `\n${'  '.repeat(indent + 1)}  ${relation.lastCommit.hash}: ${relation.lastCommit.message}`
      )
    }

    output += line + '\n'

    // 子ブランチを再帰的に表示
    const children = relations.filter(r => r.parent === branch)
    children.forEach(child => renderBranch(child.branch, indent + 1))
  }

  // mainから派生したブランチを表示
  const mainChildren = relations.filter(r => r.parent === 'main')
  mainChildren.forEach(child => renderBranch(child.branch, 1))

  return output
}

// Mermaid形式でグラフを生成
function renderMermaidGraph(relations: BranchRelation[]): string {
  let output = '```mermaid\ngraph TD\n'
  output += '  main[main]\n'

  relations.forEach(relation => {
    const label = `${relation.branch}<br/>↑${relation.ahead} ↓${relation.behind}`
    output += `  ${relation.branch.replace(/[^a-zA-Z0-9]/g, '_')}[${label}]\n`
    output += `  ${relation.parent.replace(/[^a-zA-Z0-9]/g, '_')} --> ${relation.branch.replace(/[^a-zA-Z0-9]/g, '_')}\n`
  })

  output += '```\n'
  return output
}

// Graphviz DOT形式でグラフを生成
function renderDotGraph(relations: BranchRelation[]): string {
  let output = 'digraph worktree_dependencies {\n'
  output += '  rankdir=TB;\n'
  output += '  node [shape=box, style=rounded];\n'
  output += '  main [label="main", style="filled", fillcolor="lightblue"];\n'

  relations.forEach(relation => {
    const label = `${relation.branch}\\n↑${relation.ahead} ↓${relation.behind}`
    const color = relation.behind > 10 ? 'lightpink' : 'lightgreen'
    output += `  "${relation.branch}" [label="${label}", style="filled", fillcolor="${color}"];\n`
    output += `  "${relation.parent}" -> "${relation.branch}";\n`
  })

  output += '}\n'
  return output
}

export const graphCommand = new Command('graph')
  .alias('g')
  .description('worktree間の依存関係をグラフで可視化')
  .option('-f, --format <type>', '出力形式（text, mermaid, dot）', 'text')
  .option('-o, --output <file>', '出力ファイル')
  .option('--show-commits', '最新コミットを表示')
  .option('--show-dates', '最終更新日を表示')
  .option('-d, --depth <number>', '表示する階層の深さ', '3')
  .action(async (options: GraphOptions) => {
    const spinner = ora('worktree関係を分析中...').start()

    try {
      const gitManager = new GitWorktreeManager()

      // Gitリポジトリかチェック
      const isGitRepo = await gitManager.isGitRepository()
      if (!isGitRepo) {
        spinner.fail('このディレクトリはGitリポジトリではありません')
        process.exit(1)
      }

      // worktreeを取得
      const worktrees = await gitManager.listWorktrees()
      const orchestraMembers = worktrees.filter(wt => !wt.path.endsWith('.'))

      if (orchestraMembers.length === 0) {
        spinner.fail('演奏者が存在しません')
        process.exit(0)
      }

      spinner.text = 'ブランチ関係を分析中...'

      // ブランチ関係を分析
      const relations = await analyzeBranchRelations(orchestraMembers)

      spinner.stop()

      // グラフを生成
      let graphOutput: string

      switch (options.format) {
        case 'mermaid':
          graphOutput = renderMermaidGraph(relations)
          break
        case 'dot':
          graphOutput = renderDotGraph(relations)
          break
        default:
          graphOutput = renderTextGraph(relations, options)
      }

      // 出力
      if (options.output) {
        const fs = await import('fs/promises')
        await fs.writeFile(options.output, graphOutput)
        console.log(chalk.green(`✨ グラフを ${options.output} に保存しました`))

        // Graphvizがインストールされている場合、画像を生成
        if (options.format === 'dot' && options.output.endsWith('.dot')) {
          try {
            const pngOutput = options.output.replace('.dot', '.png')
            await execa('dot', ['-Tpng', options.output, '-o', pngOutput])
            console.log(chalk.green(`🖼️  画像を ${pngOutput} に生成しました`))
          } catch {
            console.log(chalk.yellow('💡 ヒント: Graphvizをインストールすると画像を生成できます'))
            console.log(chalk.gray('  brew install graphviz'))
          }
        }
      } else {
        console.log(graphOutput)
      }

      // 統計情報
      console.log(chalk.bold('\n📊 統計情報:\n'))
      console.log(chalk.gray(`総worktree数: ${orchestraMembers.length + 1}`))
      console.log(chalk.gray(`アクティブなブランチ: ${relations.length}`))

      const outdated = relations.filter(r => r.behind > 10)
      if (outdated.length > 0) {
        console.log(chalk.yellow(`\n⚠️  10コミット以上遅れているブランチ: ${outdated.length}個`))
        outdated.forEach(r => {
          console.log(chalk.gray(`  - ${r.branch} (${r.behind}コミット遅れ)`))
        })
      }
    } catch (error) {
      spinner.fail('グラフの生成に失敗しました')
      console.error(chalk.red(error instanceof Error ? error.message : '不明なエラー'))
      process.exit(1)
    }
  })
