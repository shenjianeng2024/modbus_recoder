import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, mockTauriInvoke, createMockError } from './test-utils'
import App from './App'

// Mock the hooks
vi.mock('./hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn(),
    clearAllErrors: vi.fn(),
    errors: [],
  }),
}))

vi.mock('./hooks/useKeyboardShortcuts', () => ({
  useAppShortcuts: vi.fn(),
}))

describe('App Component', () => {
  beforeEach(() => {
    global.mockTauri.resetMocks()
  })

  it('应该正确渲染基本UI结构', () => {
    render(<App />)
    
    expect(screen.getByText('Modbus Reader')).toBeInTheDocument()
    expect(screen.getByText('连接配置')).toBeInTheDocument() // Card标题
    expect(screen.getByText('连接状态')).toBeInTheDocument()
    expect(screen.getByText('快速上手指南')).toBeInTheDocument()
    expect(screen.getByText('点击"测试连接"检查设备连接状态')).toBeInTheDocument()
  })

  it('应该显示正确的操作步骤', () => {
    render(<App />)
    
    // 验证操作指南中的步骤
    expect(screen.getByText('连接设备')).toBeInTheDocument()
    expect(screen.getByText('配置地址段')).toBeInTheDocument()
    expect(screen.getByText('读取数据')).toBeInTheDocument()
    
    // 验证功能状态显示 - 更新为实际的UI文本
    expect(screen.getByText('地址管理')).toBeInTheDocument()
    expect(screen.getByText('单次读取')).toBeInTheDocument()
    expect(screen.getByText('批量采集')).toBeInTheDocument()
    expect(screen.getByText('CSV 导出')).toBeInTheDocument()
  })

  it('应该在测试连接成功时显示成功消息', async () => {
    const user = userEvent.setup()
    
    // Mock成功的连接测试
    mockTauriInvoke('test_connection', {
      success: true,
      message: '连接成功，设备响应正常'
    })
    
    render(<App />)
    
    // 查找并点击测试连接按钮
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    // 等待异步操作完成
    await waitFor(() => {
      expect(screen.getByText('✅')).toBeInTheDocument() // 成功图标
      expect(screen.getByText('连接成功')).toBeInTheDocument()
    })
    
    // 验证Tauri API调用
    expect(global.mockTauri.invoke).toHaveBeenCalledWith('test_connection', {
      config: expect.objectContaining({
        ip: '192.168.1.199',
        port: 502,
      })
    })
  })

  it('应该在测试连接失败时显示错误消息', async () => {
    const user = userEvent.setup()
    
    // Mock失败的连接测试
    mockTauriInvoke('test_connection', {
      success: false,
      message: '连接超时，请检查设备状态和网络连接'
    })
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    await waitFor(() => {
      expect(screen.getByText('❌')).toBeInTheDocument() // 失败图标
      expect(screen.getByText('连接失败')).toBeInTheDocument()
    })
  })

  it('应该在API调用抛出异常时显示错误消息', async () => {
    const user = userEvent.setup()
    
    // Mock API异常
    mockTauriInvoke('test_connection', new Error('网络连接异常'))
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    await waitFor(() => {
      expect(screen.getByText('❌')).toBeInTheDocument() // 失败图标
      expect(screen.getByText('连接失败')).toBeInTheDocument()
    })
  })

  it('应该在加载过程中显示加载状态', async () => {
    const user = userEvent.setup()
    
    // Mock一个会延迟响应的调用
    global.mockTauri.invoke.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, message: 'OK' }), 100))
    )
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    // 应该立即显示加载状态
    expect(screen.getByText('测试连接中...')).toBeInTheDocument()
    
    // 等待加载完成
    await waitFor(() => {
      expect(screen.queryByText('测试连接中...')).not.toBeInTheDocument()
    }, { timeout: 200 })
  })

  it('应该在配置变更时清除之前的连接结果', async () => {
    const user = userEvent.setup()
    
    // 首先建立一个成功的连接
    mockTauriInvoke('test_connection', {
      success: true,
      message: '连接成功'
    })
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    await waitFor(() => {
      expect(screen.getByText('连接成功')).toBeInTheDocument()
    })
    
    // 现在修改IP地址（模拟配置变更）
    const ipInput = screen.getByDisplayValue('192.168.1.199') // 修正为实际默认值
    
    await act(async () => {
      await user.clear(ipInput)
      await user.type(ipInput, '192.168.1.101')
    })
    
    // 连接结果应该被清除
    await waitFor(() => {
      expect(screen.queryByText('连接成功')).not.toBeInTheDocument()
      expect(screen.getByText('点击"测试连接"检查设备连接状态')).toBeInTheDocument()
    })
  })

  it('应该正确处理连接状态的样式', async () => {
    const user = userEvent.setup()
    
    // 测试成功状态的样式
    mockTauriInvoke('test_connection', {
      success: true,
      message: '连接成功'
    })
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    await waitFor(() => {
      const successElement = screen.getByText('连接成功')
      const parentDiv = successElement.closest('div')
      // 验证存在绿色相关的CSS类
      expect(parentDiv?.className).toMatch(/green/)
    })
    
    // 重置并测试失败状态的样式
    global.mockTauri.resetMocks()
    mockTauriInvoke('test_connection', {
      success: false,
      message: '连接失败'
    })
    
    await act(async () => {
      await user.click(testButton)
    })
    
    await waitFor(() => {
      const failureElement = screen.getByText('连接失败')
      const parentDiv = failureElement.closest('div')
      // 验证存在红色相关的CSS类
      expect(parentDiv?.className).toMatch(/red/)
    })
  })

  it('应该在加载状态时禁用重复的连接测试', async () => {
    const user = userEvent.setup()
    
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise(resolve => {
      resolvePromise = resolve
    })
    
    // Mock一个可控的Promise
    global.mockTauri.invoke.mockImplementation(() => pendingPromise)
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    
    await act(async () => {
      await user.click(testButton)
    })
    
    // 在加载过程中，按钮应该被禁用或不响应
    expect(screen.getByText('测试连接中...')).toBeInTheDocument()
    
    // 立即再次点击不应该触发新的调用
    await act(async () => {
      await user.click(testButton)
    })
    
    // 应该只有一次API调用
    expect(global.mockTauri.invoke).toHaveBeenCalledTimes(1)
    
    // 解决Promise以完成测试
    resolvePromise!({ success: true, message: 'OK' })
    
    // 等待状态更新
    await waitFor(() => {
      expect(screen.queryByText('测试连接中...')).not.toBeInTheDocument()
    }, { timeout: 200 })
  })
})