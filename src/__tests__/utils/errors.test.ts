import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import {
  ErrorCode,
  MaestroError,
  ErrorFactory,
  handleError,
  withErrorHandling,
} from '../../utils/errors.js'

describe('MaestroError', () => {
  describe('constructor', () => {
    it('should create error with basic properties', () => {
      const error = new MaestroError('Test error', ErrorCode.UNKNOWN_ERROR)
      
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('MaestroError')
      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(error.suggestions).toEqual([])
      expect(error.originalError).toBeUndefined()
    })

    it('should create error with all properties', () => {
      const originalError = new Error('Original error')
      const suggestions = [
        { message: 'Try this', command: 'do-something' },
        { message: 'Read docs', url: 'https://example.com' },
      ]
      
      const error = new MaestroError(
        'Test error',
        ErrorCode.VALIDATION_ERROR,
        suggestions,
        originalError
      )
      
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.suggestions).toEqual(suggestions)
      expect(error.originalError).toBe(originalError)
    })
  })

  describe('getFormattedMessage', () => {
    it('should format message without suggestions', () => {
      const error = new MaestroError('Test error')
      expect(error.getFormattedMessage()).toBe('エラー: Test error')
    })

    it('should format message with suggestions', () => {
      const error = new MaestroError(
        'Test error',
        ErrorCode.UNKNOWN_ERROR,
        [
          { message: 'Try this', command: 'do-something' },
          { message: 'Read docs', url: 'https://example.com' },
        ]
      )
      
      const formatted = error.getFormattedMessage()
      expect(formatted).toContain('エラー: Test error')
      expect(formatted).toContain('解決方法:')
      expect(formatted).toContain('1. Try this')
      expect(formatted).toContain('実行: do-something')
      expect(formatted).toContain('2. Read docs')
      expect(formatted).toContain('参考: https://example.com')
    })
  })
})

describe('ErrorFactory', () => {
  describe('notGitRepository', () => {
    it('should create error without path', () => {
      const error = ErrorFactory.notGitRepository()
      
      expect(error.message).toBe('このディレクトリはGitリポジトリではありません')
      expect(error.code).toBe(ErrorCode.NOT_GIT_REPOSITORY)
      expect(error.suggestions).toHaveLength(2)
      expect(error.suggestions[0].command).toBe('git init')
    })

    it('should create error with path', () => {
      const error = ErrorFactory.notGitRepository('/some/path')
      
      expect(error.message).toBe('/some/path はGitリポジトリではありません')
      expect(error.code).toBe(ErrorCode.NOT_GIT_REPOSITORY)
    })
  })

  describe('worktreeNotFound', () => {
    it('should create error without similar branches', () => {
      const error = ErrorFactory.worktreeNotFound('feature-x')
      
      expect(error.message).toBe('演奏者 \'feature-x\' が見つかりません')
      expect(error.code).toBe(ErrorCode.WORKTREE_NOT_FOUND)
      expect(error.suggestions).toHaveLength(1)
      expect(error.suggestions[0].command).toBe('maestro create feature-x')
    })

    it('should create error with similar branches', () => {
      const error = ErrorFactory.worktreeNotFound('feature-x', ['feature-a', 'feature-b'])
      
      expect(error.suggestions).toHaveLength(2)
      expect(error.suggestions[0].message).toContain('類似した演奏者: feature-a, feature-b')
    })
  })

  describe('worktreeAlreadyExists', () => {
    it('should create error with branch and path', () => {
      const error = ErrorFactory.worktreeAlreadyExists('feature-x', '/path/to/worktree')
      
      expect(error.message).toBe('演奏者 \'feature-x\' は既に存在します: /path/to/worktree')
      expect(error.code).toBe(ErrorCode.WORKTREE_ALREADY_EXISTS)
      expect(error.suggestions).toHaveLength(2)
    })
  })

  describe('externalToolNotFound', () => {
    it('should create error with tool name only', () => {
      const error = ErrorFactory.externalToolNotFound('fzf')
      
      expect(error.message).toBe('fzf が見つかりません')
      expect(error.code).toBe(ErrorCode.EXTERNAL_TOOL_NOT_FOUND)
      expect(error.suggestions).toHaveLength(0)
    })

    it('should create error with install command', () => {
      const error = ErrorFactory.externalToolNotFound('fzf', 'brew install fzf')
      
      expect(error.suggestions).toHaveLength(1)
      expect(error.suggestions[0].command).toBe('brew install fzf')
    })

    it('should create error with install command and URL', () => {
      const error = ErrorFactory.externalToolNotFound(
        'fzf',
        'brew install fzf',
        'https://github.com/junegunn/fzf'
      )
      
      expect(error.suggestions).toHaveLength(2)
      expect(error.suggestions[1].url).toBe('https://github.com/junegunn/fzf')
    })
  })

  describe('githubAuthRequired', () => {
    it('should create GitHub auth error', () => {
      const error = ErrorFactory.githubAuthRequired()
      
      expect(error.message).toBe('GitHub CLIが認証されていません')
      expect(error.code).toBe(ErrorCode.GITHUB_AUTH_REQUIRED)
      expect(error.suggestions).toHaveLength(2)
    })
  })

  describe('operationCancelled', () => {
    it('should create cancellation error without operation', () => {
      const error = ErrorFactory.operationCancelled()
      
      expect(error.message).toBe('操作がキャンセルされました')
      expect(error.code).toBe(ErrorCode.OPERATION_CANCELLED)
    })

    it('should create cancellation error with operation', () => {
      const error = ErrorFactory.operationCancelled('削除')
      
      expect(error.message).toBe('削除がキャンセルされました')
    })
  })

  describe('validationError', () => {
    it('should create validation error', () => {
      const error = ErrorFactory.validationError('branch', '123', '英数字とハイフン')
      
      expect(error.message).toBe('不正な値: branch = \'123\' (期待値: 英数字とハイフン)')
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    })
  })

  describe('networkError', () => {
    it('should create network error without original error', () => {
      const error = ErrorFactory.networkError('API呼び出し')
      
      expect(error.message).toBe('ネットワークエラー: API呼び出し')
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR)
      expect(error.suggestions).toHaveLength(2)
    })

    it('should create network error with original error', () => {
      const originalError = new Error('Connection timeout')
      const error = ErrorFactory.networkError('API呼び出し', originalError)
      
      expect(error.originalError).toBe(originalError)
    })
  })

  describe('fromError', () => {
    it('should return MaestroError as is', () => {
      const shadowError = new MaestroError('Test', ErrorCode.UNKNOWN_ERROR)
      const result = ErrorFactory.fromError(shadowError)
      
      expect(result).toBe(shadowError)
    })

    it('should detect git repository error', () => {
      const error = new Error('fatal: not a git repository')
      const result = ErrorFactory.fromError(error)
      
      expect(result.code).toBe(ErrorCode.NOT_GIT_REPOSITORY)
    })

    it('should detect permission error', () => {
      const error = new Error('Permission denied')
      const result = ErrorFactory.fromError(error)
      
      expect(result.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect(result.message).toContain('権限エラー')
    })

    it('should detect command not found error', () => {
      const error = new Error('command not found: fzf')
      const result = ErrorFactory.fromError(error)
      
      expect(result.code).toBe(ErrorCode.EXTERNAL_TOOL_NOT_FOUND)
      expect(result.message).toContain('コマンドが見つかりません')
    })

    it('should handle unknown error', () => {
      const error = new Error('Something went wrong')
      const result = ErrorFactory.fromError(error)
      
      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR)
      expect(result.message).toBe('Something went wrong')
    })
  })
})

describe('handleError', () => {
  let consoleErrorSpy: Mock
  let processExitSpy: Mock

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exited')
    })
  })

  it('should handle MaestroError', () => {
    const error = new MaestroError('Test error', ErrorCode.UNKNOWN_ERROR)
    
    expect(() => handleError(error)).toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalledWith('エラー: Test error')
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it('should handle MaestroError with context', () => {
    const error = new MaestroError('Test error', ErrorCode.UNKNOWN_ERROR)
    
    expect(() => handleError(error, 'TestContext')).toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[TestContext] エラー: Test error')
  })

  it('should handle regular Error', () => {
    const error = new Error('Regular error')
    
    expect(() => handleError(error)).toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('should handle non-Error objects', () => {
    expect(() => handleError('String error')).toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalledWith('エラー: String error')
  })

  it('should handle null/undefined', () => {
    expect(() => handleError(null)).toThrow('Process exited')
    expect(() => handleError(undefined)).toThrow('Process exited')
  })
})

describe('withErrorHandling', () => {
  let consoleErrorSpy: Mock
  let processExitSpy: Mock

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exited')
    })
  })

  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const wrapped = withErrorHandling(fn)
    
    const result = await wrapped('arg1', 'arg2')
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('should handle errors with context', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'))
    const wrapped = withErrorHandling(fn, 'TestFunction')
    
    await expect(wrapped()).rejects.toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TestFunction]')
    )
  })

  it('should handle errors without context', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'))
    const wrapped = withErrorHandling(fn)
    
    await expect(wrapped()).rejects.toThrow('Process exited')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('エラー: Test error')
    )
  })
})