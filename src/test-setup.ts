import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Tauri APIs
const mockInvoke = vi.fn()
const mockListen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  unlisten: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// 全局测试工具
global.mockTauri = {
  invoke: mockInvoke,
  listen: mockListen,
  resetMocks: () => {
    mockInvoke.mockReset()
    mockListen.mockReset()
  },
}

// 清理函数，在每个测试前重置mocks
beforeEach(() => {
  global.mockTauri.resetMocks()
})