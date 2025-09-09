import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
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
    expect(screen.getAllByText('连接配置')).toHaveLength(2) // Card标题和组件内标题
    expect(screen.getByText('连接状态')).toBeInTheDocument()
    expect(screen.getByText('快速开始')).toBeInTheDocument()
    expect(screen.getByText('点击"测试连接"检查设备连接状态')).toBeInTheDocument()
  })

  it('应该显示正确的快速开始按钮状态', () => {
    render(<App />)
    
    expect(screen.getByText('📍 地址管理 ✅')).toBeInTheDocument()
    expect(screen.getByText('📖 单次读取 (开发中)')).toBeInTheDocument()
    expect(screen.getByText('📊 批量采集 (开发中)')).toBeInTheDocument()
    expect(screen.getByText('💾 CSV 导出 (开发中)')).toBeInTheDocument()
    
    // 检查按钮的disabled状态
    const singleReadBtn = screen.getByText('📖 单次读取 (开发中)').closest('button')
    const batchCollectBtn = screen.getByText('📊 批量采集 (开发中)').closest('button')
    const csvExportBtn = screen.getByText('💾 CSV 导出 (开发中)').closest('button')
    
    expect(singleReadBtn).toBeDisabled()
    expect(batchCollectBtn).toBeDisabled() 
    expect(csvExportBtn).toBeDisabled()
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
    await user.click(testButton)
    
    // 等待异步操作完成
    await waitFor(() => {
      expect(screen.getByText('✅ 连接成功')).toBeInTheDocument()
      // 使用getAllByText因为消息可能同时显示在界面和通知中
      expect(screen.getAllByText('连接成功，设备响应正常')).toHaveLength(2)
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
    await user.click(testButton)
    
    await waitFor(() => {
      expect(screen.getByText('❌ 连接失败')).toBeInTheDocument()
      // 使用getAllByText因为消息可能同时显示在界面和通知中
      expect(screen.getAllByText('连接超时，请检查设备状态和网络连接')).toHaveLength(2)
    })
  })

  it('应该在API调用抛出异常时显示错误消息', async () => {
    const user = userEvent.setup()
    
    // Mock API异常
    mockTauriInvoke('test_connection', new Error('网络连接异常'))
    
    render(<App />)
    
    const testButton = screen.getByText('测试连接')
    await user.click(testButton)
    
    await waitFor(() => {
      expect(screen.getByText('❌ 连接失败')).toBeInTheDocument()
      expect(screen.getByText(/连接失败:/)).toBeInTheDocument()
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
    await user.click(testButton)
    
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
    await user.click(testButton)
    
    await waitFor(() => {
      expect(screen.getByText('✅ 连接成功')).toBeInTheDocument()
    })
    
    // 现在修改IP地址（模拟配置变更）
    const ipInput = screen.getByDisplayValue('192.168.1.100')
    await user.clear(ipInput)
    await user.type(ipInput, '192.168.1.101')
    
    // 连接结果应该被清除
    await waitFor(() => {
      expect(screen.queryByText('✅ 连接成功')).not.toBeInTheDocument()
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
    await user.click(testButton)
    
    await waitFor(() => {
      const successDiv = screen.getByText('✅ 连接成功').closest('div')
      expect(successDiv).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300')
    })
    
    // 重置并测试失败状态的样式
    global.mockTauri.resetMocks()
    mockTauriInvoke('test_connection', {
      success: false,
      message: '连接失败'
    })
    
    await user.click(testButton)
    
    await waitFor(() => {
      const failureDiv = screen.getByText('❌ 连接失败').closest('div')
      expect(failureDiv).toHaveClass('bg-red-100', 'text-red-800', 'border-red-300')
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
    await user.click(testButton)
    
    // 在加载过程中，按钮应该被禁用或不响应
    expect(screen.getByText('测试连接中...')).toBeInTheDocument()
    
    // 立即再次点击不应该触发新的调用
    await user.click(testButton)
    
    // 应该只有一次API调用
    expect(global.mockTauri.invoke).toHaveBeenCalledTimes(1)
    
    // 解决Promise以完成测试
    resolvePromise({ success: true, message: 'OK' })
    
    // 等待状态更新
    await waitFor(() => {
      expect(screen.queryByText('测试连接中...')).not.toBeInTheDocument()
    }, { timeout: 200 })
  })
})