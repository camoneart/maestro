import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execCommand } from '../../commands/exec.js'

// 外部依存をモック
vi.mock('../../core/git.js')
vi.mock('../../utils/tmux.js')
vi.mock('../../utils/fzf.js')
vi.mock('execa')
vi.mock('ora')

describe('exec command new options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  describe('command definition', () => {
    it('should have the correct command configuration', () => {
      expect(execCommand.name()).toBe('exec')
      expect(execCommand.alias()).toBe('e')
      expect(execCommand.description()).toBe('演奏者でコマンドを実行')
    })

    it('should have all required options defined', () => {
      const options = execCommand.options
      const optionLongs = options.map(opt => opt.long)
      const optionFlags = options.map(opt => opt.flags)

      expect(optionLongs).toContain('--silent')
      expect(optionLongs).toContain('--all')
      expect(optionLongs).toContain('--fzf')
      expect(optionLongs).toContain('--tmux')

      // Commanderでは複数フラグは.flagsに含まれる
      expect(optionFlags.some(flag => flag && flag.includes('--tmux-vertical'))).toBe(true)
      expect(optionFlags.some(flag => flag && flag.includes('--tmux-horizontal'))).toBe(true)
    })

    it('should have correct option flags and descriptions', () => {
      const options = execCommand.options

      const fzfOption = options.find(opt => opt.long === '--fzf')
      expect(fzfOption?.description).toBe('fzfで演奏者を選択')

      const tmuxOption = options.find(opt => opt.long === '--tmux')
      expect(tmuxOption?.description).toBe('tmuxの新しいウィンドウで実行')
      expect(tmuxOption?.short).toBe('-t')

      // 複数フラグをもつオプションをflagsで検索
      const tmuxVerticalOption = options.find(
        opt => opt.flags && opt.flags.includes('--tmux-vertical')
      )
      expect(tmuxVerticalOption?.description).toBe('tmuxの縦分割ペインで実行')

      const tmuxHorizontalOption = options.find(
        opt => opt.flags && opt.flags.includes('--tmux-horizontal')
      )
      expect(tmuxHorizontalOption?.description).toBe('tmuxの横分割ペインで実行')
    })
  })

  describe('argument configuration', () => {
    it('should have optional branch name argument', () => {
      const args = execCommand._args
      expect(args).toHaveLength(2)

      const branchArg = args[0]
      expect(branchArg.name()).toBe('branch-name')
      expect(branchArg.required).toBe(false) // optional argument
      expect(branchArg.description).toBe('ブランチ名（省略時またはfzfオプション時は選択）')
    })

    it('should have variadic command arguments', () => {
      const args = execCommand._args
      const commandArg = args[1]

      expect(commandArg.name()).toBe('command')
      expect(commandArg.variadic).toBe(true)
      expect(commandArg.required).toBe(false)
      expect(commandArg.description).toBe('実行するコマンド')
    })
  })

  describe('option combinations validation', () => {
    it('should support multiple tmux options being defined', () => {
      // This test verifies that the command definition allows for
      // multiple tmux options, even though runtime logic prevents
      // using them simultaneously
      const tmuxOptions = execCommand.options.filter(opt => opt.long?.includes('tmux'))

      expect(tmuxOptions).toHaveLength(3) // --tmux, --tmux-vertical, --tmux-horizontal
    })

    it('should support fzf option for interactive selection', () => {
      const fzfOption = execCommand.options.find(opt => opt.long === '--fzf')
      expect(fzfOption).toBeDefined()
      expect(fzfOption?.description).toBe('fzfで演奏者を選択')
    })
  })

  describe('integration with existing options', () => {
    it('should maintain backward compatibility with existing options', () => {
      const options = execCommand.options
      const existingOptions = ['--silent', '--all']

      for (const optionFlag of existingOptions) {
        const option = options.find(opt => opt.long === optionFlag)
        expect(option).toBeDefined()
      }
    })

    it('should have correct short flag for tmux option', () => {
      const tmuxOption = execCommand.options.find(opt => opt.long === '--tmux')
      expect(tmuxOption?.short).toBe('-t')
    })
  })
})
