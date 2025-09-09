import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { vi } from 'vitest'

// 测试用的Wrapper组件
const AllTheProviders = ({ children }: { children: ReactNode }) => {
  return (
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
      </ThemeProvider>
    </BrowserRouter>
  )
}

// 自定义render函数
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock Tauri API calls
export const mockTauriInvoke = (command: string, response?: any) => {
  global.mockTauri.invoke.mockImplementation((cmd: string) => {
    if (cmd === command) {
      if (response instanceof Error) {
        return Promise.reject(response)
      }
      return Promise.resolve(response)
    }
    return Promise.resolve(null)
  })
}

// Mock Tauri events
export const mockTauriEvent = (event: string, payload?: any) => {
  global.mockTauri.listen.mockImplementation((eventName: string, handler: (event: any) => void) => {
    if (eventName === event) {
      setTimeout(() => handler({ payload }), 10)
      return Promise.resolve(() => {})
    }
    return Promise.resolve(() => {})
  })
}

// 创建模拟的Modbus连接配置
export const createMockConnectionConfig = () => ({
  host: '192.168.1.199',
  port: 502,
  timeout: 5000,
  retries: 3,
})

// 创建模拟的地址范围
export const createMockAddressRange = (overrides = {}) => ({
  id: 'test-range-1',
  name: 'Test Range',
  startAddress: 0,
  count: 10,
  registerType: 'holding' as const,
  enabled: true,
  ...overrides,
})

// 创建模拟的Modbus数据
export const createMockModbusData = (count = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    address: i,
    value: Math.floor(Math.random() * 65536),
    timestamp: new Date().toISOString(),
  }))
}

// 用于测试错误处理的工具函数
export const createMockError = (message = 'Test error', type = 'CONNECTION_ERROR') => ({
  message,
  type,
  details: 'Mock error for testing',
  timestamp: new Date().toISOString(),
})

// 等待异步操作完成
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))

// 模拟文件操作
export const mockFileOperations = {
  save: vi.fn().mockResolvedValue('test-file-path.csv'),
  open: vi.fn().mockResolvedValue('test-file-path.csv'),
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue('test,content\n1,2\n3,4'),
}

// 重新导出testing-library的所有函数
export * from '@testing-library/react'

// 重新导出自定义render
export { customRender as render }