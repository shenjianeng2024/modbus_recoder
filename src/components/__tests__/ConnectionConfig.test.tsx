import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test-utils'
import { ConnectionConfig } from '../ConnectionConfig'
import { ConnectionConfig as ConnectionConfigType } from '../../types/modbus'

describe('ConnectionConfig Component', () => {
  const mockOnConfigChange = vi.fn()
  const mockOnTestConnection = vi.fn()

  beforeEach(() => {
    mockOnConfigChange.mockReset()
    mockOnTestConnection.mockReset()
  })

  const renderComponent = () => {
    return render(
      <ConnectionConfig
        onConfigChange={mockOnConfigChange}
        onTestConnection={mockOnTestConnection}
      />
    )
  }

  it('应该正确渲染基本UI结构', () => {
    renderComponent()
    
    expect(screen.getByText('连接配置')).toBeInTheDocument()
    expect(screen.getByLabelText('IP 地址')).toBeInTheDocument()
    expect(screen.getByLabelText('端口')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '测试连接' })).toBeInTheDocument()
  })

  it('应该显示默认配置值', () => {
    renderComponent()
    
    const ipInput = screen.getByDisplayValue('192.168.1.100') as HTMLInputElement
    const portInput = screen.getByDisplayValue('502') as HTMLInputElement
    
    expect(ipInput).toBeInTheDocument()
    expect(portInput).toBeInTheDocument()
    expect(ipInput.value).toBe('192.168.1.100')
    expect(portInput.value).toBe('502')
  })

  it('应该在IP地址变更时调用onConfigChange', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const ipInput = screen.getByLabelText('IP 地址')
    
    await user.clear(ipInput)
    await user.type(ipInput, '192.168.1.101')
    
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.101',
      port: 502,
    })
  })

  it('应该在端口变更时调用onConfigChange', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const portInput = screen.getByLabelText('端口')
    
    await user.clear(portInput)
    await user.type(portInput, '1234')
    
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.100',
      port: 1234,
    })
  })

  it('应该处理无效的端口输入', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const portInput = screen.getByLabelText('端口')
    
    await user.clear(portInput)
    await user.type(portInput, 'invalid')
    
    // 应该使用默认值502
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.100',
      port: 502,
    })
  })

  it('应该处理空的端口输入', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const portInput = screen.getByLabelText('端口')
    
    await user.clear(portInput)
    
    // 应该使用默认值502
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.100',
      port: 502,
    })
  })

  it('应该在点击测试连接时调用onTestConnection', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const testButton = screen.getByRole('button', { name: '测试连接' })
    await user.click(testButton)
    
    expect(mockOnTestConnection).toHaveBeenCalledWith({
      ip: '192.168.1.100',
      port: 502,
    })
  })

  it('应该在配置变更后测试连接时使用新配置', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    // 修改配置
    const ipInput = screen.getByLabelText('IP 地址')
    const portInput = screen.getByLabelText('端口')
    
    await user.clear(ipInput)
    await user.type(ipInput, '10.0.0.1')
    
    await user.clear(portInput)
    await user.type(portInput, '1502')
    
    // 测试连接
    const testButton = screen.getByRole('button', { name: '测试连接' })
    await user.click(testButton)
    
    expect(mockOnTestConnection).toHaveBeenCalledWith({
      ip: '10.0.0.1',
      port: 1502,
    })
  })

  it('应该有正确的输入属性', () => {
    renderComponent()
    
    const ipInput = screen.getByLabelText('IP 地址') as HTMLInputElement
    const portInput = screen.getByLabelText('端口') as HTMLInputElement
    
    expect(ipInput.type).toBe('text')
    expect(ipInput.placeholder).toBe('192.168.1.100')
    
    expect(portInput.type).toBe('number')
    expect(portInput.placeholder).toBe('502')
    expect(portInput.min).toBe('1')
    expect(portInput.max).toBe('65535')
  })

  it('应该正确处理多次配置变更', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const ipInput = screen.getByLabelText('IP 地址')
    
    // 第一次变更
    await user.clear(ipInput)
    await user.type(ipInput, '192.168.1.101')
    
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.101',
      port: 502,
    })
    
    // 第二次变更
    await user.clear(ipInput)
    await user.type(ipInput, '192.168.1.102')
    
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.102',
      port: 502,
    })
    
    expect(mockOnConfigChange).toHaveBeenCalledTimes(8) // 2次清空 + 6次输入
  })

  it('应该处理边界值的端口输入', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const portInput = screen.getByLabelText('端口')
    
    // 测试最小值
    await user.clear(portInput)
    await user.type(portInput, '1')
    
    expect(mockOnConfigChange).toHaveBeenCalledWith({
      ip: '192.168.1.100',
      port: 1,
    })
    
    // 测试最大值
    await user.clear(portInput)
    await user.type(portInput, '65535')
    
    expect(mockOnConfigChange).toHaveBeenLastCalledWith({
      ip: '192.168.1.100',
      port: 65535,
    })
  })

  it('应该保持组件的状态一致性', async () => {
    const user = userEvent.setup()
    renderComponent()
    
    const ipInput = screen.getByLabelText('IP 地址')
    const portInput = screen.getByLabelText('端口')
    
    // 修改IP
    await user.clear(ipInput)
    await user.type(ipInput, '10.0.0.1')
    
    // 修改端口
    await user.clear(portInput)
    await user.type(portInput, '9999')
    
    // 验证当前状态
    expect((ipInput as HTMLInputElement).value).toBe('10.0.0.1')
    expect((portInput as HTMLInputElement).value).toBe('9999')
    
    // 测试连接应该使用当前状态
    const testButton = screen.getByRole('button', { name: '测试连接' })
    await user.click(testButton)
    
    expect(mockOnTestConnection).toHaveBeenCalledWith({
      ip: '10.0.0.1',
      port: 9999,
    })
  })
})