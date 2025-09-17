import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createMockAddressRange } from '../../test-utils'
import { AddressRangeManager } from '../AddressRangeManager'

// Mock functions
const mockAddRange = vi.fn()
const mockUpdateRange = vi.fn()
const mockRemoveRange = vi.fn()
const mockClearAllRanges = vi.fn()
const mockValidateRange = vi.fn()
const mockCheckOverlaps = vi.fn()
const mockExportConfig = vi.fn()
const mockImportConfig = vi.fn()

// Mock the hooks
const mockUseAddressRanges = vi.fn()
vi.mock('../../hooks/useAddressRanges', () => ({
  useAddressRanges: () => mockUseAddressRanges(),
}))

// Mock the AddressRangeDialog component
vi.mock('../AddressRangeDialog', () => ({
  AddressRangeDialog: ({ open, onOpenChange, onSave, editingRange }: any) => (
    open ? (
      <div data-testid="address-range-dialog">
        <button onClick={() => onOpenChange(false)}>关闭</button>
        <button 
          onClick={() => {
            const mockRange = createMockAddressRange({
              name: editingRange?.name || '新地址段',
              startAddress: editingRange?.startAddress || 1000,
              length: editingRange?.length || 10,
            })
            onSave(mockRange)
            onOpenChange(false)
          }}
        >
          保存
        </button>
      </div>
    ) : null
  ),
}))

describe('AddressRangeManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    mockValidateRange.mockReturnValue({ isValid: true, errors: [] })
    mockCheckOverlaps.mockReturnValue({ hasOverlap: false, conflicts: [] })
    mockExportConfig.mockReturnValue('{"ranges":[]}')
    mockImportConfig.mockReturnValue(true)
    
    // Mock the hook's return value
    mockUseAddressRanges.mockReturnValue({
      ranges: [],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 0,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })
    
    // Mock confirm
    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()
  })

  it('应该正确渲染基本UI结构', () => {
    render(<AddressRangeManager />)
    
    expect(screen.getByText('地址范围管理')).toBeInTheDocument()
    expect(screen.getByText('导入')).toBeInTheDocument()
    expect(screen.getByText('导出')).toBeInTheDocument()
    expect(screen.getByText('添加地址段')).toBeInTheDocument()
  })

  it('应该显示空状态当没有地址段时', () => {
    render(<AddressRangeManager />)
    
    expect(screen.getByText('暂无配置的地址段')).toBeInTheDocument()
    expect(screen.getByText('点击"添加地址段"开始配置 Modbus 地址范围')).toBeInTheDocument()
  })

  it('应该显示地址段统计信息', () => {
    render(<AddressRangeManager />)
    
    expect(screen.getByText(/总地址数: 0\/120/)).toBeInTheDocument()
    expect(screen.getByText('地址段数: 0')).toBeInTheDocument()
  })

  it('应该禁用导出按钮当没有地址段时', () => {
    render(<AddressRangeManager />)
    
    const exportButton = screen.getByText('导出').closest('button')
    expect(exportButton).toBeDisabled()
  })

  it('应该打开对话框当点击添加地址段时', async () => {
    const user = userEvent.setup()
    render(<AddressRangeManager />)
    
    const addButton = screen.getByText('添加地址段')
    await user.click(addButton)
    
    expect(screen.getByTestId('address-range-dialog')).toBeInTheDocument()
  })

  it('应该处理导入文件', async () => {
    const user = userEvent.setup()
    render(<AddressRangeManager />)
    
    // 模拟文件输入
    const file = new File(['{"ranges":[]}'], 'test.json', { type: 'application/json' })
    const fileInput = screen.getByRole('button', { name: '导入' }).parentElement?.querySelector('input[type="file"]')
    
    if (fileInput) {
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      
      fireEvent.change(fileInput)
    }
    
    // Note: 实际测试文件读取需要更复杂的mock
  })

  it('应该处理清空所有地址段', async () => {
    const user = userEvent.setup()
    
    // Mock有地址段的状态
    mockUseAddressRanges.mockReturnValue({
      ranges: [createMockAddressRange()],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 10,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })
    
    render(<AddressRangeManager />)
    
    const clearAllButton = screen.getByText('清空所有地址段')
    await user.click(clearAllButton)
    
    expect(global.confirm).toHaveBeenCalledWith('确认要清空所有地址段吗？此操作不可恢复。')
    expect(mockClearAllRanges).toHaveBeenCalled()
  })
})

describe('AddressRangeManager with Data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateRange.mockReturnValue({ isValid: true, errors: [] })
    mockCheckOverlaps.mockReturnValue({ hasOverlap: false, conflicts: [] })
    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()
  })

  it('应该渲染地址段列表', () => {
    const mockRanges = [
      createMockAddressRange({
        id: 'range-1',
        name: '测试地址段1',
        startAddress: 1000,
        length: 10,
        enabled: true,
      }),
      createMockAddressRange({
        id: 'range-2',
        name: '测试地址段2',
        startAddress: 2000,
        length: 20,
        enabled: false,
      }),
    ]

    // 重新mock useAddressRanges返回有数据的状态
    mockUseAddressRanges.mockReturnValue({
      ranges: mockRanges,
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 30,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })

    render(<AddressRangeManager />)
    
    expect(screen.getByText('测试地址段1')).toBeInTheDocument()
    expect(screen.getByText('测试地址段2')).toBeInTheDocument()
    expect(screen.getByText('1000-1009')).toBeInTheDocument()
    expect(screen.getByText('2000-2019')).toBeInTheDocument()
    expect(screen.getByText('总地址数: 30/120')).toBeInTheDocument()
    expect(screen.getByText('地址段数: 2')).toBeInTheDocument()
  })

  it('应该显示重叠警告', () => {
    const mockRanges = [
      createMockAddressRange({ id: 'range-1', name: '地址段1' }),
      createMockAddressRange({ id: 'range-2', name: '地址段2' }),
    ]
    
    mockCheckOverlaps.mockReturnValue({
      hasOverlap: true,
      conflicts: [{
        range1: mockRanges[0],
        range2: mockRanges[1],
        overlapStart: 1005,
        overlapEnd: 1009,
      }],
    })

    mockUseAddressRanges.mockReturnValue({
      ranges: mockRanges,
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 20,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })

    render(<AddressRangeManager />)
    
    expect(screen.getByText('地址段重叠警告：')).toBeInTheDocument()
    expect(screen.getByText('发现 1 个重叠冲突')).toBeInTheDocument()
    expect(screen.getByText(/地址段1.*与.*地址段2.*重叠/)).toBeInTheDocument()
  })

  it('应该显示错误信息', () => {
    mockUseAddressRanges.mockReturnValue({
      ranges: [],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 0,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: '配置加载失败',
    })

    render(<AddressRangeManager />)
    
    expect(screen.getByText('配置加载失败')).toBeInTheDocument()
  })

  it('应该显示加载状态', () => {
    mockUseAddressRanges.mockReturnValue({
      ranges: [],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 0,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: true,
      error: null,
    })

    render(<AddressRangeManager />)
    
    expect(screen.getByText('加载配置中...')).toBeInTheDocument()
  })

  it('应该处理删除地址段', async () => {
    const user = userEvent.setup()
    const mockRange = createMockAddressRange({ id: 'range-1', name: '测试地址段' })

    mockUseAddressRanges.mockReturnValue({
      ranges: [mockRange],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 10,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })

    render(<AddressRangeManager />)
    
    const deleteButton = screen.getByRole('button', { name: /删除/ })
    await user.click(deleteButton)
    
    expect(global.confirm).toHaveBeenCalledWith('确认要删除这个地址段吗？')
    expect(mockRemoveRange).toHaveBeenCalledWith('range-1')
  })

  it('应该处理启用/禁用切换', async () => {
    const user = userEvent.setup()
    const mockRange = createMockAddressRange({ 
      id: 'range-1', 
      name: '测试地址段',
      enabled: true,
    })

    mockUseAddressRanges.mockReturnValue({
      ranges: [mockRange],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 10,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })

    render(<AddressRangeManager />)
    
    const toggleButton = screen.getByText('启用')
    await user.click(toggleButton)
    
    expect(mockUpdateRange).toHaveBeenCalledWith('range-1', { enabled: false })
  })

  it('应该处理编辑地址段', async () => {
    const user = userEvent.setup()
    const mockRange = createMockAddressRange({ 
      id: 'range-1', 
      name: '测试地址段',
    })

    mockUseAddressRanges.mockReturnValue({
      ranges: [mockRange],
      addRange: mockAddRange,
      updateRange: mockUpdateRange,
      removeRange: mockRemoveRange,
      clearAllRanges: mockClearAllRanges,
      validateRange: mockValidateRange,
      checkOverlaps: mockCheckOverlaps,
      totalAddresses: 10,
      exportConfig: mockExportConfig,
      importConfig: mockImportConfig,
      isLoading: false,
      error: null,
    })

    render(<AddressRangeManager />)
    
    const editButton = screen.getByRole('button', { name: /编辑/ })
    await user.click(editButton)
    
    expect(screen.getByTestId('address-range-dialog')).toBeInTheDocument()
  })
})