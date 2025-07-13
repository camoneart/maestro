/**
 * プロセス管理とクリーンアップのユーティリティ
 */

type CleanupHandler = () => void | Promise<void>

class ProcessManager {
  private static instance: ProcessManager
  private cleanupHandlers: Set<CleanupHandler> = new Set()
  private isExiting = false
  private readonly listeners: Map<string, NodeJS.SignalListener> = new Map()

  constructor() {
    this.setupSignalHandlers()
  }

  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager()
    }
    return ProcessManager.instance
  }

  /**
   * クリーンアップハンドラーを登録
   */
  addCleanupHandler(handler: CleanupHandler): void {
    this.cleanupHandlers.add(handler)
  }

  /**
   * クリーンアップハンドラーを削除
   */
  removeCleanupHandler(handler: CleanupHandler): void {
    this.cleanupHandlers.delete(handler)
  }

  /**
   * 全てのクリーンアップハンドラーを実行
   */
  private async executeCleanup(): Promise<void> {
    if (this.isExiting) return
    this.isExiting = true

    const cleanupPromises = Array.from(this.cleanupHandlers).map(async handler => {
      try {
        await handler()
      } catch (error) {
        console.error('Cleanup handler failed:', error)
      }
    })

    await Promise.all(cleanupPromises)
    this.cleanupHandlers.clear()
  }

  /**
   * シグナルハンドラーをセットアップ
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

    signals.forEach(signal => {
      // 既存のリスナーを削除
      if (this.listeners.has(signal)) {
        process.removeListener(signal, this.listeners.get(signal)!)
      }

      const listener: NodeJS.SignalListener = async () => {
        console.log(`\n受信したシグナル: ${signal}`)
        await this.executeCleanup()
        process.exit(0)
      }

      this.listeners.set(signal, listener)
      process.on(signal, listener)
    })
  }

  /**
   * EventEmitterのmaxListenersを適切に設定
   */
  setMaxListeners(count: number): void {
    process.setMaxListeners(count)
  }

  /**
   * プロセス終了
   */
  async exit(code = 0): Promise<void> {
    await this.executeCleanup()
    process.exit(code)
  }

  /**
   * すべてのシグナルリスナーを削除
   */
  removeAllListeners(): void {
    this.listeners.forEach((listener, signal) => {
      process.removeListener(signal, listener)
    })
    this.listeners.clear()
    this.cleanupHandlers.clear()
    this.isExiting = false
  }
}

// シングルトンインスタンス
export const processManager = ProcessManager.getInstance()

/**
 * リソースの自動クリーンアップのためのヘルパー関数
 */
export function withCleanup<T>(
  resource: T & { close?: () => void | Promise<void> },
  handler: CleanupHandler
): T {
  processManager.addCleanupHandler(handler)

  // リソースがclose メソッドを持つ場合は自動的に登録
  if (resource.close) {
    const originalClose = resource.close.bind(resource)
    processManager.addCleanupHandler(async () => {
      try {
        await originalClose()
      } catch (error) {
        console.error('Resource cleanup failed:', error)
      }
    })
  }

  return resource
}

/**
 * EventEmitterリソース用のヘルパー
 */
export function createManagedEventEmitter<T extends { removeAllListeners?: () => void }>(
  emitter: T
): T {
  if (emitter.removeAllListeners) {
    processManager.addCleanupHandler(() => {
      emitter.removeAllListeners!()
    })
  }
  return emitter
}