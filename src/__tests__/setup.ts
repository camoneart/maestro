import { vi } from 'vitest'

// グローバルモックの設定
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    text: '',
    isSpinning: false,
  })),
}))

// process.exit のモック
vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit called with code ${code}`)
})

// console のモック（必要に応じて）
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})