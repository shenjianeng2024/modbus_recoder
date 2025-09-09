import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchCollection } from '../BatchCollection';
import { ManagedAddressRange } from '@/types/modbus';
import { notifications } from '@/utils/notifications';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/utils/notifications', () => ({
  notifications: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const { invoke } = await import('@tauri-apps/api/core');

describe('BatchCollection', () => {
  const mockAddressRanges: ManagedAddressRange[] = [
    {
      id: '1',
      name: '测试范围1',
      startAddress: 0,
      length: 10,
      dataType: 'uint16',
      description: '测试用地址范围1',
      enabled: true,
    },
    {
      id: '2', 
      name: '测试范围2',
      startAddress: 100,
      length: 5,
      dataType: 'int16',
      description: '测试用地址范围2',
      enabled: true,
    },
    {
      id: '3',
      name: '禁用范围',
      startAddress: 200,
      length: 3,
      dataType: 'uint16',
      description: '禁用的地址范围',
      enabled: false,
    },
  ];

  const mockBatchResult = {
    results: [
      {
        address: 0,
        raw_value: 1234,
        parsed_value: '1234',
        timestamp: '2025-09-09T11:00:00Z',
        success: true,
        error: null,
        data_type: 'uint16'
      },
      {
        address: 1,
        raw_value: 5678,
        parsed_value: '5678',
        timestamp: '2025-09-09T11:00:00Z',
        success: true,
        error: null,
        data_type: 'uint16'
      },
    ],
    total_count: 2,
    success_count: 2,
    failed_count: 0,
    timestamp: '2025-09-09T11:00:00Z',
    duration_ms: 150,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该正确渲染批量采集组件', () => {
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    expect(screen.getByText('批量采集设置')).toBeInTheDocument();
    expect(screen.getByLabelText('采集间隔 (ms)')).toBeInTheDocument();
    expect(screen.getByLabelText('显示格式')).toBeInTheDocument();
    expect(screen.getByLabelText('最大记录数')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始采集/i })).toBeInTheDocument();
  });

  it('应该在禁用状态下禁用所有控件', () => {
    render(<BatchCollection addressRanges={mockAddressRanges} disabled={true} />);
    
    expect(screen.getByLabelText('采集间隔 (ms)')).toBeDisabled();
    expect(screen.getByRole('button', { name: /开始采集/i })).toBeDisabled();
  });

  it('应该显示正确的启用范围数量', () => {
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    // 2个启用的范围 + 1个禁用的范围 = 3个总范围，但只显示启用的
    expect(screen.getByText('2 个')).toBeInTheDocument();
  });

  it('应该验证无启用范围时的错误', async () => {
    const emptyRanges: ManagedAddressRange[] = [];
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={emptyRanges} />);
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    expect(screen.getByText('没有启用的地址范围，请在地址管理中启用至少一个范围')).toBeInTheDocument();
  });

  it('应该验证采集间隔的有效性', async () => {
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    // 设置无效的间隔（小于100ms）
    const intervalInput = screen.getByLabelText('采集间隔 (ms)');
    await user.clear(intervalInput);
    await user.type(intervalInput, '50');
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    expect(screen.getByText('采集间隔不能少于100毫秒')).toBeInTheDocument();
  });

  it('应该验证最大记录数的有效性', async () => {
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    // 设置无效的最大记录数（小于10）
    const maxRecordsInput = screen.getByLabelText('最大记录数');
    await user.clear(maxRecordsInput);
    await user.type(maxRecordsInput, '5');
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    expect(screen.getByText('最大记录数不能少于10')).toBeInTheDocument();
  });

  it('应该成功开始采集并显示结果', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockBatchResult);
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    // 验证调用参数
    expect(invoke).toHaveBeenCalledWith('read_modbus_ranges', {
      request: {
        ranges: [
          { start: 0, count: 10 },
          { start: 100, count: 5 },
        ],
        format: 'dec',
      },
    });
    
    // 等待结果显示
    await waitFor(() => {
      expect(screen.getByText('最新采集结果')).toBeInTheDocument();
    });
    
    // 验证结果内容
    expect(screen.getByText('2/2')).toBeInTheDocument(); // 成功率Badge
    expect(screen.getByText('150ms')).toBeInTheDocument(); // 耗时
    expect(screen.getByText('100%')).toBeInTheDocument(); // 成功率
    
    // 验证数据表格
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('5678')).toBeInTheDocument();
    
    // 验证通知
    expect(notifications.info).toHaveBeenCalledWith('开始采集', '每1000ms采集一次');
  });

  it('应该处理部分失败的采集', async () => {
    const partialFailResult = {
      ...mockBatchResult,
      results: [
        ...mockBatchResult.results,
        {
          address: 2,
          raw_value: 0,
          parsed_value: '',
          timestamp: '2025-09-09T11:00:00Z',
          success: false,
          error: '读取超时',
          data_type: 'uint16'
        },
      ],
      total_count: 3,
      success_count: 2,
      failed_count: 1,
    };
    
    vi.mocked(invoke).mockResolvedValueOnce(partialFailResult);
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('最新采集结果')).toBeInTheDocument();
    });
    
    // 验证部分失败的显示
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // 成功率约67%
    
    // 验证警告通知
    expect(notifications.warning).toHaveBeenCalledWith(
      '部分读取失败',
      '成功: 2, 失败: 1'
    );
    
    // 验证失败项的显示
    expect(screen.getByText('失败: 读取超时')).toBeInTheDocument();
  });

  it('应该处理采集异常', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('网络连接失败'));
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('采集失败: Error: 网络连接失败')).toBeInTheDocument();
    });
    
    expect(notifications.error).toHaveBeenCalledWith(
      '采集失败',
      '采集失败: Error: 网络连接失败'
    );
  });

  it('应该正确更新采集统计', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockBatchResult)
      .mockResolvedValueOnce({
        ...mockBatchResult,
        duration_ms: 200,
        success_count: 1,
        failed_count: 1,
        total_count: 2,
      });
    
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    
    // 第一次采集
    await user.click(startButton);
    await waitFor(() => {
      expect(screen.getByText('采集统计')).toBeInTheDocument();
    });
    
    // 验证第一次统计
    expect(screen.getByText('1')).toBeInTheDocument(); // 总采集次数
    expect(screen.getByText('2')).toBeInTheDocument(); // 成功读取数
    expect(screen.getByText('0')).toBeInTheDocument(); // 失败读取数
    expect(screen.getByText('150ms')).toBeInTheDocument(); // 平均耗时
  });

  it('应该支持清空历史数据', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockBatchResult);
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    // 先进行一次采集
    const startButton = screen.getByRole('button', { name: /开始采集/i });
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('最新采集结果')).toBeInTheDocument();
    });
    
    // 清空历史
    const clearButton = screen.getByRole('button', { name: /清空历史/i });
    await user.click(clearButton);
    
    expect(notifications.success).toHaveBeenCalledWith('清理完成', '历史数据已清空');
  });

  it('应该支持不同的显示格式', async () => {
    const user = userEvent.setup();
    
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    // 更改显示格式为十六进制
    const formatSelect = screen.getByRole('combobox');
    await user.click(formatSelect);
    
    const hexOption = screen.getByText('十六进制 (Hex)');
    await user.click(hexOption);
    
    // 验证格式已更改（通过查看trigger显示的值）
    expect(screen.getByText('十六进制 (Hex)')).toBeInTheDocument();
  });

  it('应该在没有数据时禁用导出按钮', () => {
    render(<BatchCollection addressRanges={mockAddressRanges} />);
    
    const exportButton = screen.getByRole('button', { name: /导出数据/i });
    expect(exportButton).toBeDisabled();
  });
});