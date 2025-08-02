import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPaneConfiguration,
  validatePaneCount,
  generateTmuxMessage,
  validateTmuxOptions,
  createTmuxSession,
  TmuxSessionOptions,
} from '../../utils/tmuxSession.js'
import { execa } from 'execa'
import chalk from 'chalk'
import inquirer from 'inquirer'

vi.mock('execa')
vi.mock('inquirer')
vi.mock('../../utils/tmux.js', () => ({
  setupTmuxStatusLine: vi.fn(),
}))
vi.mock('../../utils/tty.js', () => ({
  attachToTmuxWithProperTTY: vi.fn(),
  switchTmuxClientWithProperTTY: vi.fn(),
}))

const mockExeca = vi.mocked(execa)
const mockInquirer = vi.mocked(inquirer)

describe('tmuxSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.TMUX
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPaneConfiguration', () => {
    it('should return default configuration when no options provided', () => {
      const result = getPaneConfiguration()
      expect(result).toEqual({ paneCount: 2, isHorizontal: false })
    })

    it('should return horizontal configuration with tmuxH', () => {
      const result = getPaneConfiguration({ tmuxH: true })
      expect(result).toEqual({ paneCount: 2, isHorizontal: true })
    })

    it('should return custom pane count with tmuxHPanes', () => {
      const result = getPaneConfiguration({ tmuxHPanes: 4 })
      expect(result).toEqual({ paneCount: 4, isHorizontal: true })
    })

    it('should return custom pane count with tmuxVPanes', () => {
      const result = getPaneConfiguration({ tmuxVPanes: 3 })
      expect(result).toEqual({ paneCount: 3, isHorizontal: false })
    })
  })

  describe('validatePaneCount', () => {
    it('should not throw for reasonable pane counts', () => {
      expect(() => validatePaneCount(5, true)).not.toThrow()
      expect(() => validatePaneCount(10, false)).not.toThrow()
    })

    it('should throw for too many horizontal panes', () => {
      expect(() => validatePaneCount(15, true)).toThrow(
        '画面サイズに対してペイン数（15個）が多すぎるため、セッションが作成できませんでした'
      )
    })

    it('should throw for too many vertical panes', () => {
      expect(() => validatePaneCount(20, false)).toThrow(
        '画面サイズに対してペイン数（20個）が多すぎるため、セッションが作成できませんでした'
      )
    })
  })

  describe('generateTmuxMessage', () => {
    it('should generate message without pane count', () => {
      const result = generateTmuxMessage({ tmuxH: true })
      expect(result).toEqual({
        paneCountMsg: '',
        splitTypeMsg: '水平',
        layoutMsg: '',
      })
    })

    it('should generate message with pane count', () => {
      const result = generateTmuxMessage({ tmuxHPanes: 4 })
      expect(result).toEqual({
        paneCountMsg: '4つのペインに',
        splitTypeMsg: '水平',
        layoutMsg: '',
      })
    })

    it('should generate message with layout', () => {
      const result = generateTmuxMessage({ tmuxVPanes: 3, tmuxLayout: 'tiled' })
      expect(result).toEqual({
        paneCountMsg: '3つのペインに',
        splitTypeMsg: '垂直',
        layoutMsg: ' (tiledレイアウト)',
      })
    })
  })

  describe('validateTmuxOptions', () => {
    it('should not throw for valid options', () => {
      expect(() =>
        validateTmuxOptions({
          sessionName: 'test',
          worktreePath: '/path/to/worktree',
          tmuxH: true,
        })
      ).not.toThrow()
    })

    it('should throw for invalid pane count', () => {
      expect(() =>
        validateTmuxOptions({
          sessionName: 'test',
          worktreePath: '/path/to/worktree',
          tmuxHPanes: 20,
        })
      ).toThrow()
    })
  })

  describe('createTmuxSession', () => {
    const defaultOptions: TmuxSessionOptions = {
      sessionName: 'test-session',
      worktreePath: '/path/to/worktree',
      interactiveAttach: false,
    }

    it('should create a simple tmux session', async () => {
      mockExeca
        .mockRejectedValueOnce(new Error('no session')) // has-session fails
        .mockResolvedValue({} as any)

      await createTmuxSession(defaultOptions)

      expect(mockExeca).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'test-session'])
      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'new-session',
        '-d',
        '-s',
        'test-session',
        '-c',
        '/path/to/worktree',
        expect.any(String),
        '-l',
      ])
    })

    it('should create session with horizontal panes', async () => {
      mockExeca
        .mockRejectedValueOnce(new Error('no session')) // has-session fails
        .mockResolvedValue({} as any)

      await createTmuxSession({
        ...defaultOptions,
        tmuxH: true,
        tmuxHPanes: 3,
      })

      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-t',
        'test-session',
        '-h',
        '-c',
        '/path/to/worktree',
        expect.any(String),
        '-l',
      ])
    })

    it('should create session with vertical panes inside tmux', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,1234,0'
      mockExeca.mockResolvedValue({} as any)

      await createTmuxSession({
        ...defaultOptions,
        tmuxV: true,
        tmuxVPanes: 2,
      })

      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'split-window',
        '-v',
        '-c',
        '/path/to/worktree',
        expect.any(String),
        '-l',
      ])
    })

    it('should apply custom layout', async () => {
      mockExeca
        .mockRejectedValueOnce(new Error('no session')) // has-session fails
        .mockResolvedValue({} as any)

      await createTmuxSession({
        ...defaultOptions,
        tmuxLayout: 'tiled',
        tmuxHPanes: 4,
      })

      expect(mockExeca).toHaveBeenCalledWith('tmux', [
        'select-layout',
        '-t',
        'test-session',
        'tiled',
      ])
    })

    it('should handle existing session', async () => {
      mockExeca
        .mockResolvedValueOnce({} as any) // has-session succeeds
        .mockResolvedValue({} as any)

      await createTmuxSession(defaultOptions)

      expect(console.log).toHaveBeenCalledWith(
        chalk.yellow(`tmuxセッション 'test-session' は既に存在します`)
      )
    })

    it('should handle interactive attach prompt', async () => {
      mockExeca.mockRejectedValueOnce(new Error('no session')) // has-session fails
      mockExeca.mockResolvedValue({} as any)
      mockInquirer.prompt.mockResolvedValue({ shouldAttach: true })

      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
      })
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
      })

      await createTmuxSession({
        ...defaultOptions,
        interactiveAttach: true,
      })

      expect(mockInquirer.prompt).toHaveBeenCalled()
    })

    it('should handle pane creation errors', async () => {
      mockExeca.mockRejectedValueOnce(new Error('no session')) // has-session fails
      mockExeca.mockResolvedValueOnce({} as any) // new-session succeeds
      mockExeca.mockRejectedValueOnce(
        Object.assign(new Error('no space for new pane'), {
          stderr: 'no space for new pane',
        })
      )

      await expect(
        createTmuxSession({
          ...defaultOptions,
          tmuxHPanes: 3,
        })
      ).rejects.toThrow('画面サイズに対してペイン数')
    })
  })
})
