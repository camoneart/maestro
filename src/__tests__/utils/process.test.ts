import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { processManager, withCleanup, createManagedEventEmitter } from '../../utils/process.js'

describe('ProcessManager', () => {
  let consoleLogSpy: Mock
  let consoleErrorSpy: Mock
  let processExitSpy: Mock
  let processOnSpy: Mock
  let processRemoveListenerSpy: Mock

  beforeEach(() => {
    // Clear all handlers before each test
    processManager.removeAllListeners()

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exited')
    })
    processOnSpy = vi.spyOn(process, 'on')
    processRemoveListenerSpy = vi.spyOn(process, 'removeListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('singleton instance', () => {
    it('should return same instance', () => {
      const instance1 = processManager
      const instance2 = processManager
      expect(instance1).toBe(instance2)
    })
  })

  describe('cleanup handlers', () => {
    it('should add and execute cleanup handler', async () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).toHaveBeenCalled()
    })

    it('should remove cleanup handler', () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)
      processManager.removeCleanupHandler(handler)

      processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).not.toHaveBeenCalled()
    })

    it('should execute multiple handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      processManager.addCleanupHandler(handler1)
      processManager.addCleanupHandler(handler2)

      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should handle async cleanup handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      processManager.addCleanupHandler(handler)

      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).toHaveBeenCalled()
    })

    it('should handle cleanup handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Cleanup error'))
      processManager.addCleanupHandler(handler)

      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Cleanup handler failed:',
        expect.any(Error)
      )
    })

    it('should prevent double cleanup execution', async () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      // First exit
      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      // Reset mock
      handler.mockClear()

      // Second exit should not execute handlers
      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('signal handling', () => {
    it.skip('should setup signal handlers for SIGINT and SIGTERM', () => {
      // ProcessManagerインスタンスは既に作成されているので、
      // シグナルハンドラーが設定されていることを確認
      const sigintCalls = processOnSpy.mock.calls.filter(call => call[0] === 'SIGINT')
      const sigtermCalls = processOnSpy.mock.calls.filter(call => call[0] === 'SIGTERM')
      
      expect(sigintCalls.length).toBeGreaterThan(0)
      expect(sigtermCalls.length).toBeGreaterThan(0)
    })

    it.skip('should handle SIGINT signal', async () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      // Find and call the SIGINT listener
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT')
      const sigintListener = sigintCall?.[1] as Function

      // SIGINTリスナーが存在することを確認
      expect(sigintListener).toBeDefined()
      
      // リスナーを実行
      try {
        await sigintListener()
      } catch (error) {
        // process.exitが呼ばれることを期待
        expect(error).toEqual(new Error('Process exited'))
      }
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\n受信したシグナル: SIGINT')
      expect(handler).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it.skip('should handle SIGTERM signal', async () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      // Find and call the SIGTERM listener
      const sigtermCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGTERM')
      const sigtermListener = sigtermCall?.[1] as Function

      // SIGTERMリスナーが存在することを確認
      expect(sigtermListener).toBeDefined()
      
      // リスナーを実行
      try {
        await sigtermListener()
      } catch (error) {
        // process.exitが呼ばれることを期待
        expect(error).toEqual(new Error('Process exited'))
      }
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\n受信したシグナル: SIGTERM')
      expect(handler).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('setMaxListeners', () => {
    it('should set max listeners on process', () => {
      const setMaxListenersSpy = vi.spyOn(process, 'setMaxListeners')
      
      processManager.setMaxListeners(20)
      
      expect(setMaxListenersSpy).toHaveBeenCalledWith(20)
    })
  })

  describe('exit', () => {
    it('should execute cleanup and exit with code', async () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      await expect(processManager.exit(1)).rejects.toThrow('Process exited')
      
      expect(handler).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should exit with code 0 by default', async () => {
      await expect(processManager.exit()).rejects.toThrow('Process exited')
      
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('removeAllListeners', () => {
    it.skip('should remove all signal listeners', () => {
      // removeAllListenersを呼び出す前にスパイをクリア
      processRemoveListenerSpy.mockClear()
      
      processManager.removeAllListeners()
      
      // SIGINTとSIGTERMのリスナーが削除されたことを確認
      const sigintRemoveCalls = processRemoveListenerSpy.mock.calls.filter(
        call => call[0] === 'SIGINT'
      )
      const sigtermRemoveCalls = processRemoveListenerSpy.mock.calls.filter(
        call => call[0] === 'SIGTERM'
      )
      
      expect(sigintRemoveCalls.length).toBeGreaterThan(0)
      expect(sigtermRemoveCalls.length).toBeGreaterThan(0)
    })

    it('should clear all cleanup handlers', () => {
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)
      
      processManager.removeAllListeners()
      
      // Try to exit - handler should not be called
      processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error
      
      expect(handler).not.toHaveBeenCalled()
    })

    it('should reset exit state', async () => {
      // First exit
      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      // Remove all listeners (resets state)
      processManager.removeAllListeners()

      // Add new handler
      const handler = vi.fn()
      processManager.addCleanupHandler(handler)

      // Second exit should execute new handler
      await processManager.exit(0)
        .catch(() => {}) // Ignore process.exit error

      expect(handler).toHaveBeenCalled()
    })
  })
})

describe('withCleanup', () => {
  beforeEach(() => {
    processManager.removeAllListeners()
  })

  it('should register cleanup handler', () => {
    const resource = { data: 'test' }
    const handler = vi.fn()
    
    const result = withCleanup(resource, handler)
    
    expect(result).toBe(resource)
    
    processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
    
    expect(handler).toHaveBeenCalled()
  })

  it('should auto-register close method', () => {
    const resource = {
      data: 'test',
      close: vi.fn(),
    }
    const handler = vi.fn()
    
    withCleanup(resource, handler)
    
    processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
    
    expect(handler).toHaveBeenCalled()
    expect(resource.close).toHaveBeenCalled()
  })

  it('should handle async close method', async () => {
    const resource = {
      data: 'test',
      close: vi.fn().mockResolvedValue(undefined),
    }
    const handler = vi.fn()
    
    withCleanup(resource, handler)
    
    await processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
    
    expect(resource.close).toHaveBeenCalled()
  })

  it('should handle close method errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const resource = {
      data: 'test',
      close: vi.fn().mockRejectedValue(new Error('Close error')),
    }
    const handler = vi.fn()
    
    withCleanup(resource, handler)
    
    await processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Resource cleanup failed:',
      expect.any(Error)
    )
  })
})

describe('createManagedEventEmitter', () => {
  beforeEach(() => {
    processManager.removeAllListeners()
  })

  it('should register removeAllListeners cleanup', () => {
    const emitter = {
      removeAllListeners: vi.fn(),
    }
    
    const result = createManagedEventEmitter(emitter)
    
    expect(result).toBe(emitter)
    
    processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
    
    expect(emitter.removeAllListeners).toHaveBeenCalled()
  })

  it('should handle emitter without removeAllListeners', () => {
    const emitter = { data: 'test' }
    
    const result = createManagedEventEmitter(emitter)
    
    expect(result).toBe(emitter)
    
    // Should not throw
    processManager.exit(0)
      .catch(() => {}) // Ignore process.exit error
  })
})