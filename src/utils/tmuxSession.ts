import { execa } from 'execa'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { setupTmuxStatusLine } from './tmux.js'
import { attachToTmuxWithProperTTY, switchTmuxClientWithProperTTY } from './tty.js'

// tmuxセッション管理のための共通インターフェース
export interface TmuxSessionOptions {
  // セッション名（ブランチ名）
  sessionName: string
  // 作業ディレクトリ
  worktreePath: string
  // tmuxオプション
  tmux?: boolean
  tmuxH?: boolean
  tmuxV?: boolean
  tmuxHPanes?: number
  tmuxVPanes?: number
  tmuxLayout?: 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical' | 'tiled'
  // インタラクティブなアタッチプロンプトを表示するか
  interactiveAttach?: boolean
}

// ペイン設定用のヘルパー関数
export function getPaneConfiguration(
  options?: Pick<TmuxSessionOptions, 'tmuxH' | 'tmuxV' | 'tmuxHPanes' | 'tmuxVPanes'>
) {
  const paneCount = options?.tmuxHPanes || options?.tmuxVPanes || 2
  const isHorizontal = Boolean(options?.tmuxH || options?.tmuxHPanes)
  return { paneCount, isHorizontal }
}

// ペイン数が妥当かどうかを事前検証する関数
export function validatePaneCount(paneCount: number, isHorizontal: boolean): void {
  // 簡易的な画面サイズ検証（より厳密にはtmuxの実際の画面サイズを取得すべき）
  const maxReasonablePanes = isHorizontal ? 10 : 15 // 水平分割の方が制限が厳しい

  if (paneCount > maxReasonablePanes) {
    const splitType = isHorizontal ? '水平' : '垂直'
    throw new Error(
      `画面サイズに対してペイン数（${paneCount}個）が多すぎるため、セッションが作成できませんでした。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（${splitType}分割）`
    )
  }
}

// メッセージ生成用のヘルパー関数
export function generateTmuxMessage(
  options?: Pick<TmuxSessionOptions, 'tmuxHPanes' | 'tmuxVPanes' | 'tmuxH' | 'tmuxLayout'>
) {
  const paneCountMsg =
    options?.tmuxHPanes || options?.tmuxVPanes
      ? `${options.tmuxHPanes || options.tmuxVPanes}つのペインに`
      : ''
  const splitTypeMsg = options?.tmuxH || options?.tmuxHPanes ? '水平' : '垂直'
  const layoutMsg = options?.tmuxLayout ? ` (${options.tmuxLayout}レイアウト)` : ''

  return { paneCountMsg, splitTypeMsg, layoutMsg }
}

// 複数ペインを作成する関数
async function createMultiplePanes(
  sessionName: string | null,
  worktreePath: string,
  paneCount: number,
  isHorizontal: boolean
): Promise<void> {
  for (let i = 1; i < paneCount; i++) {
    const splitArgs = sessionName ? ['split-window', '-t', sessionName] : ['split-window']

    if (isHorizontal) {
      splitArgs.push('-h') // 水平分割（左右）
    } else {
      splitArgs.push('-v') // 垂直分割（上下）
    }

    splitArgs.push('-c', worktreePath)
    const shell = process.env.SHELL || '/bin/bash'
    splitArgs.push(shell, '-l')

    try {
      await execa('tmux', splitArgs)
    } catch (error) {
      // tmuxエラーを解析してユーザーフレンドリーなメッセージを表示
      if (error instanceof Error && error.message.includes('no space for new pane')) {
        const splitType = isHorizontal ? '水平' : '垂直'
        throw new Error(
          `画面サイズに対してペイン数（${paneCount}個）が多すぎます。ターミナルウィンドウを大きくするか、ペイン数を減らしてください。（${splitType}分割）`
        )
      }

      // その他のtmuxエラーの汎用的な処理
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`tmuxペインの作成に失敗しました: ${errorMessage}`)
    }
  }
}

// レイアウトを適用する関数
async function applyTmuxLayout(
  sessionName: string | null,
  options?: Pick<TmuxSessionOptions, 'tmuxLayout'>,
  paneCount?: number,
  isHorizontal?: boolean
): Promise<void> {
  if (options?.tmuxLayout) {
    const layoutArgs = sessionName
      ? ['select-layout', '-t', sessionName, options.tmuxLayout]
      : ['select-layout', options.tmuxLayout]
    await execa('tmux', layoutArgs)
  } else if (paneCount && paneCount > 2) {
    const defaultLayout = isHorizontal ? 'even-horizontal' : 'even-vertical'
    const layoutArgs = sessionName
      ? ['select-layout', '-t', sessionName, defaultLayout]
      : ['select-layout', defaultLayout]
    await execa('tmux', layoutArgs)
  }
}

// 全ペインにタイトルを設定する関数
async function setTitleForAllPanes(
  sessionName: string | null,
  branchName: string,
  paneCount: number
): Promise<void> {
  for (let i = 0; i < paneCount; i++) {
    try {
      // 各ペインに直接タイトルを設定
      const titleArgs = sessionName
        ? ['select-pane', '-t', `${sessionName}:0.${i}`, '-T', branchName]
        : ['select-pane', '-t', `${i}`, '-T', branchName]
      await execa('tmux', titleArgs)
    } catch {
      // ペインが存在しない場合はスキップ
    }
  }
}

// tmuxセッションをアタッチする関数（TTY問題を解決）
export function attachToTmuxSession(sessionName: string): Promise<void> {
  return attachToTmuxWithProperTTY(sessionName)
}

// tmuxクライアントをスイッチする関数（TTY問題を解決）
export function switchTmuxClient(sessionName: string): Promise<void> {
  return switchTmuxClientWithProperTTY(sessionName)
}

// 新しいセッションでペイン分割を処理する関数
async function handleNewSessionPaneSplit(
  sessionName: string,
  branchName: string,
  worktreePath: string,
  options?: TmuxSessionOptions
): Promise<void> {
  const { paneCount, isHorizontal } = getPaneConfiguration(options)

  // tmuxセッションを作成（detached mode）
  const shell = process.env.SHELL || '/bin/bash'
  await execa('tmux', ['new-session', '-d', '-s', sessionName, '-c', worktreePath, shell, '-l'])

  // 複数ペインを作成
  await createMultiplePanes(sessionName, worktreePath, paneCount, isHorizontal)

  // レイアウトを適用
  await applyTmuxLayout(sessionName, options, paneCount, isHorizontal)

  // 全ペインにタイトルを設定
  await setTitleForAllPanes(sessionName, branchName, paneCount)

  // 最初のペイン（左上）にフォーカスを移動
  await execa('tmux', ['select-pane', '-t', `${sessionName}:0.0`])
  await execa('tmux', ['rename-window', '-t', sessionName, branchName])
  await setupTmuxStatusLine()
}

// 既存セッション内でペイン分割を処理する関数
async function handleInsideTmuxPaneSplit(
  branchName: string,
  worktreePath: string,
  options?: TmuxSessionOptions
): Promise<void> {
  const { paneCount, isHorizontal } = getPaneConfiguration(options)

  // 複数ペインを作成
  await createMultiplePanes(null, worktreePath, paneCount, isHorizontal)

  // レイアウトを適用
  await applyTmuxLayout(null, options, paneCount, isHorizontal)

  // 全ペインにタイトルを設定
  await setTitleForAllPanes(null, branchName, paneCount)

  // 最初のペイン（左上）にフォーカスを移動
  await execa('tmux', ['select-pane', '-t', '0'])
  await setupTmuxStatusLine()
}

// tmuxセッションを作成してClaude Codeを起動する関数（共通化）
export async function createTmuxSession(options: TmuxSessionOptions): Promise<void> {
  const { sessionName: branchName, worktreePath, interactiveAttach = true } = options
  const sessionName = branchName.replace(/[^a-zA-Z0-9_-]/g, '-')

  try {
    // ペイン分割オプションの場合
    if (
      options.tmuxH ||
      options.tmuxV ||
      options.tmuxHPanes ||
      options.tmuxVPanes ||
      options.tmuxLayout
    ) {
      const isInsideTmux = process.env.TMUX !== undefined

      if (!isInsideTmux) {
        // 既存セッションチェック
        try {
          await execa('tmux', ['has-session', '-t', sessionName])
          console.log(chalk.yellow(`tmuxセッション '${sessionName}' は既に存在します`))
          await attachToTmuxSession(sessionName)
          return
        } catch {
          // セッションが存在しない場合は作成
        }

        await handleNewSessionPaneSplit(sessionName, branchName, worktreePath, options)

        const { paneCountMsg, splitTypeMsg, layoutMsg } = generateTmuxMessage(options)
        console.log(
          chalk.green(
            `✨ tmuxセッション '${sessionName}' を作成し、${paneCountMsg}${splitTypeMsg}分割しました${layoutMsg}`
          )
        )

        // アタッチメント処理
        if (interactiveAttach && process.stdout.isTTY && process.stdin.isTTY) {
          try {
            const { shouldAttach } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'shouldAttach',
                message: 'セッションにアタッチしますか？',
                default: true,
              },
            ])

            if (shouldAttach) {
              console.log(chalk.cyan(`🎵 tmuxセッション '${sessionName}' にアタッチしています...`))
              await attachToTmuxSession(sessionName)
            } else {
              console.log(
                chalk.yellow(`\n📝 後でアタッチするには以下のコマンドを実行してください:`)
              )
              console.log(chalk.white(`   tmux attach -t ${sessionName}`))
              console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
            }
          } catch {
            // Ctrl+Cでキャンセルされた場合も正常な終了として扱う
            console.log(chalk.yellow(`\n📝 後でアタッチするには以下のコマンドを実行してください:`))
            console.log(chalk.white(`   tmux attach -t ${sessionName}`))
            console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
          }
        } else {
          console.log(
            chalk.yellow(`\n📝 tmuxセッションにアタッチするには以下のコマンドを実行してください:`)
          )
          console.log(chalk.white(`   tmux attach -t ${sessionName}`))
          console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
        }
        return
      } else {
        await handleInsideTmuxPaneSplit(branchName, worktreePath, options)

        const { paneCountMsg, splitTypeMsg, layoutMsg } = generateTmuxMessage(options)
        console.log(
          chalk.green(
            `✅ tmuxペインを${paneCountMsg}${splitTypeMsg}分割しました${layoutMsg}: ${branchName}`
          )
        )
        return
      }
    }

    // 通常のtmuxセッション作成
    try {
      await execa('tmux', ['has-session', '-t', sessionName])
      console.log(chalk.yellow(`tmuxセッション '${sessionName}' は既に存在します`))
      return
    } catch {
      // セッションが存在しない場合は作成
    }

    const shell = process.env.SHELL || '/bin/bash'
    await execa('tmux', ['new-session', '-d', '-s', sessionName, '-c', worktreePath, shell, '-l'])

    await execa('tmux', ['rename-window', '-t', sessionName, branchName])
    // ペインタイトルを設定
    await setTitleForAllPanes(sessionName, branchName, 1)
    console.log(chalk.green(`✨ tmuxセッション '${sessionName}' を作成しました`))

    if (interactiveAttach && process.stdout.isTTY && process.stdin.isTTY) {
      try {
        const { shouldAttach } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldAttach',
            message: 'セッションにアタッチしますか？',
            default: true,
          },
        ])

        if (shouldAttach) {
          console.log(chalk.cyan(`🎵 tmuxセッション '${sessionName}' にアタッチしています...`))
          const isInsideTmux = process.env.TMUX !== undefined
          if (isInsideTmux) {
            await switchTmuxClient(sessionName)
          } else {
            await attachToTmuxSession(sessionName)
          }
        } else {
          console.log(chalk.yellow(`\n📝 後でアタッチするには以下のコマンドを実行してください:`))
          console.log(chalk.white(`   tmux attach -t ${sessionName}`))
          console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
        }
      } catch {
        // Ctrl+Cでキャンセルされた場合も正常な終了として扱う
        console.log(chalk.yellow(`\n📝 後でアタッチするには以下のコマンドを実行してください:`))
        console.log(chalk.white(`   tmux attach -t ${sessionName}`))
        console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
      }
    } else {
      console.log(
        chalk.yellow(`\n📝 tmuxセッションにアタッチするには以下のコマンドを実行してください:`)
      )
      console.log(chalk.white(`   tmux attach -t ${sessionName}`))
      console.log(chalk.gray(`\n💡 ヒント: Ctrl+B, D でセッションからデタッチできます`))
    }
  } catch (error) {
    // エラーメッセージの重複を避けるため、詳細なエラーメッセージのみ表示
    if (error instanceof Error) {
      console.error(chalk.red(`✖ ${error.message}`))
    } else {
      console.error(chalk.red(`✖ tmuxセッションの作成に失敗しました: ${error}`))
    }
    throw error
  }
}

// tmuxオプションの検証
export function validateTmuxOptions(options: TmuxSessionOptions): void {
  const { paneCount, isHorizontal } = getPaneConfiguration(options)
  if (paneCount > 2) {
    validatePaneCount(paneCount, isHorizontal)
  }
}
