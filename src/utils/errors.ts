/**
 * maestro用の統一エラークラス
 */

/* eslint-disable no-unused-vars */
export enum ErrorCode {
  // Git関連
  NOT_GIT_REPOSITORY = 'NOT_GIT_REPOSITORY',
  WORKTREE_NOT_FOUND = 'WORKTREE_NOT_FOUND',
  WORKTREE_ALREADY_EXISTS = 'WORKTREE_ALREADY_EXISTS',

  // 外部ツール関連
  EXTERNAL_TOOL_NOT_FOUND = 'EXTERNAL_TOOL_NOT_FOUND',

  // GitHub関連
  GITHUB_AUTH_REQUIRED = 'GITHUB_AUTH_REQUIRED',

  // 一般的なエラー
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
/* eslint-enable no-unused-vars */

interface SolutionSuggestion {
  message: string
  command?: string
  url?: string
}

export class MaestroError extends Error {
  public readonly code: ErrorCode
  public readonly suggestions: SolutionSuggestion[]
  public readonly originalError?: Error

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    suggestions: SolutionSuggestion[] = [],
    originalError?: Error
  ) {
    super(message)
    this.name = 'MaestroError'
    this.code = code
    this.suggestions = suggestions
    this.originalError = originalError

    // Error.captureStackTraceが利用可能な場合に使用
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MaestroError)
    }
  }

  /**
   * エラーメッセージとその解決策を整形して返す
   */
  getFormattedMessage(): string {
    let message = `エラー: ${this.message}`

    if (this.suggestions.length > 0) {
      message += '\n\n解決方法:'
      this.suggestions.forEach((suggestion, index) => {
        message += `\n  ${index + 1}. ${suggestion.message}`
        if (suggestion.command) {
          message += `\n     実行: ${suggestion.command}`
        }
        if (suggestion.url) {
          message += `\n     参考: ${suggestion.url}`
        }
      })
    }

    return message
  }
}

/**
 * 一般的なエラーパターンのファクトリ関数
 */
export class ErrorFactory {
  static notGitRepository(path?: string): MaestroError {
    return new MaestroError(
      path
        ? `${path} はGitリポジトリではありません`
        : 'このディレクトリはGitリポジトリではありません',
      ErrorCode.NOT_GIT_REPOSITORY,
      [
        {
          message: 'Gitリポジトリを初期化する',
          command: 'git init',
        },
        {
          message: '既存のリポジトリをクローンする',
          command: 'git clone <repository-url>',
        },
      ]
    )
  }

  static worktreeNotFound(branch: string, similar?: string[]): MaestroError {
    const suggestions: SolutionSuggestion[] = [
      {
        message: '演奏者を招集する',
        command: `maestro create ${branch}`,
      },
    ]

    if (similar && similar.length > 0) {
      suggestions.unshift({
        message: `類似した演奏者: ${similar.join(', ')}`,
      })
    }

    return new MaestroError(
      `演奏者 '${branch}' が見つかりません`,
      ErrorCode.WORKTREE_NOT_FOUND,
      suggestions
    )
  }

  static worktreeAlreadyExists(branch: string, path: string): MaestroError {
    return new MaestroError(
      `演奏者 '${branch}' は既に存在します: ${path}`,
      ErrorCode.WORKTREE_ALREADY_EXISTS,
      [
        {
          message: '既存の演奏者を解散してから再招集する',
          command: `maestro delete ${branch}`,
        },
        {
          message: '既存の演奏者に移動する',
          command: `maestro shell ${branch}`,
        },
      ]
    )
  }

  static externalToolNotFound(
    tool: string,
    installCommand?: string,
    url?: string
  ): MaestroError {
    const suggestions: SolutionSuggestion[] = []

    if (installCommand) {
      suggestions.push({
        message: `${tool}をインストールする`,
        command: installCommand,
      })
    }

    if (url) {
      suggestions.push({
        message: '公式サイトからダウンロード',
        url,
      })
    }

    return new MaestroError(
      `${tool} が見つかりません`,
      ErrorCode.EXTERNAL_TOOL_NOT_FOUND,
      suggestions
    )
  }

  static githubAuthRequired(): MaestroError {
    return new MaestroError('GitHub CLIが認証されていません', ErrorCode.GITHUB_AUTH_REQUIRED, [
      {
        message: 'GitHub CLIで認証する',
        command: 'gh auth login',
      },
      {
        message: 'GitHub CLIをインストールする',
        command: 'brew install gh',
        url: 'https://cli.github.com/',
      },
    ])
  }

  static operationCancelled(operation?: string): MaestroError {
    return new MaestroError(
      operation ? `${operation}がキャンセルされました` : '操作がキャンセルされました',
      ErrorCode.OPERATION_CANCELLED
    )
  }

  static validationError(field: string, value: unknown, expected: string): MaestroError {
    return new MaestroError(
      `不正な値: ${field} = '${value}' (期待値: ${expected})`,
      ErrorCode.VALIDATION_ERROR
    )
  }

  static networkError(operation: string, originalError?: Error): MaestroError {
    return new MaestroError(
      `ネットワークエラー: ${operation}`,
      ErrorCode.NETWORK_ERROR,
      [
        {
          message: 'インターネット接続を確認してください',
        },
        {
          message: 'プロキシ設定を確認してください',
        },
      ],
      originalError
    )
  }

  static fromError(error: Error): MaestroError {
    if (error instanceof MaestroError) {
      return error
    }

    // 既知のエラーパターンを検出
    const message = error.message.toLowerCase()

    if (message.includes('not a git repository')) {
      return ErrorFactory.notGitRepository()
    }

    if (message.includes('permission denied')) {
      return new MaestroError(
        `権限エラー: ${error.message}`,
        ErrorCode.PERMISSION_DENIED,
        [
          {
            message: 'ファイル・ディレクトリの権限を確認してください',
          },
        ],
        error
      )
    }

    if (message.includes('command not found') || message.includes('not found')) {
      return new MaestroError(
        `コマンドが見つかりません: ${error.message}`,
        ErrorCode.EXTERNAL_TOOL_NOT_FOUND,
        [],
        error
      )
    }

    // 一般的なエラーとして扱う
    return new MaestroError(error.message, ErrorCode.UNKNOWN_ERROR, [], error)
  }
}

/**
 * エラーハンドリングのユーティリティ関数
 */
export function handleError(error: unknown, context?: string): never {
  const maestroError =
    error instanceof MaestroError
      ? error
      : ErrorFactory.fromError(error instanceof Error ? error : new Error(String(error)))

  if (context) {
    console.error(`[${context}] ${maestroError.getFormattedMessage()}`)
  } else {
    console.error(maestroError.getFormattedMessage())
  }

  process.exit(1)
}

/**
 * エラーをキャッチして適切にハンドリングするデコレーター
 */
/* eslint-disable no-unused-vars */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, context)
    }
  }
}
/* eslint-enable no-unused-vars */
