import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SingleRead } from '../SingleRead';
import { notifications } from '@/utils/notifications';

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/utils/notifications', () => ({
  notifications: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { invoke } = await import('@tauri-apps/api/core');

describe('SingleRead', () => {
  const mockConfig = {
    ip: '192.168.1.100',
    port: 502,
  };

  const mockSuccessResult = {
    success: true,
    data: [1234, 5678],
    address_range: { start: 0, count: 2 },
    timestamp: '2025-09-09T11:00:00Z',
    message: '读取成功',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该正确渲染单次读取组件', () => {
    render(<SingleRead connectionConfig={mockConfig} />);
    
    expect(screen.getByText('单次读取设置')).toBeInTheDocument();
    expect(screen.getByLabelText('起始地址')).toBeInTheDocument();
    expect(screen.getByLabelText('读取数量')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /开始读取/i })).toBeInTheDocument();
  });

  it('应该在禁用状态下禁用所有输入', () => {
    render(<SingleRead connectionConfig={mockConfig} disabled={true} />);
    
    expect(screen.getByLabelText('起始地址')).toBeDisabled();
    expect(screen.getByLabelText('读取数量')).toBeDisabled();
    expect(screen.getByRole('button', { name: /开始读取/i })).toBeDisabled();
  });

  it('应该正确处理快捷设置按钮', async () => {
    const user = userEvent.setup();
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 点击快捷设置按钮 100-120
    const quickButton = screen.getByRole('button', { name: '100-120' });
    await user.click(quickButton);
    
    expect(screen.getByLabelText('起始地址')).toHaveValue(100);
    expect(screen.getByLabelText('读取数量')).toHaveValue(20);
  });

  it('应该验证输入范围', async () => {
    const user = userEvent.setup();
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 设置无效的起始地址
    const startAddressInput = screen.getByLabelText('起始地址');
    await user.clear(startAddressInput);
    await user.type(startAddressInput, '70000');
    
    // 尝试读取
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    expect(screen.getByText('起始地址必须在 0-65535 范围内')).toBeInTheDocument();
  });

  it('应该成功执行读取操作', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(mockSuccessResult);
    const user = userEvent.setup();
    
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 设置读取参数
    const startAddressInput = screen.getByLabelText('起始地址');
    const countInput = screen.getByLabelText('读取数量');
    
    await user.clear(startAddressInput);
    await user.type(startAddressInput, '0');
    await user.clear(countInput);
    await user.type(countInput, '2');
    
    // 执行读取
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    // 验证加载状态
    expect(screen.getByText('读取中...')).toBeInTheDocument();
    
    // 等待读取完成
    await waitFor(() => {
      expect(screen.getByText('读取结果')).toBeInTheDocument();
    });
    
    // 验证调用参数
    expect(invoke).toHaveBeenCalledWith('read_single', {
      request: {
        ip: '192.168.1.100',
        port: 502,
        ranges: [{ start: 0, count: 2 }],
      },
    });
    
    // 验证成功通知
    expect(notifications.success).toHaveBeenCalledWith(
      '读取成功',
      '读取到 2 个寄存器值'
    );
    
    // 验证结果显示
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('[0]')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('5678')).toBeInTheDocument();
  });

  it('应该处理读取失败的情况', async () => {
    const mockErrorResult = {
      success: false,
      data: [],
      address_range: { start: 0, count: 1 },
      timestamp: '2025-09-09T11:00:00Z',
      message: '连接超时',
    };
    
    vi.mocked(invoke).mockResolvedValueOnce(mockErrorResult);
    const user = userEvent.setup();
    
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 执行读取
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    // 等待读取完成
    await waitFor(() => {
      expect(screen.getByText('读取结果')).toBeInTheDocument();
    });
    
    // 验证错误状态
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('连接超时')).toBeInTheDocument();
    
    // 验证错误通知
    expect(notifications.error).toHaveBeenCalledWith('读取失败', '连接超时');
  });

  it('应该处理读取异常', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('网络错误'));
    const user = userEvent.setup();
    
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 执行读取
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    // 等待错误处理
    await waitFor(() => {
      expect(screen.getByText('读取失败: Error: 网络错误')).toBeInTheDocument();
    });
    
    // 验证错误通知
    expect(notifications.error).toHaveBeenCalledWith(
      '读取失败',
      '读取失败: Error: 网络错误'
    );
  });

  it('应该正确显示数据统计', async () => {
    const mockResultWithMultipleValues = {
      ...mockSuccessResult,
      data: [100, 200, 300, 50, 150],
    };
    
    vi.mocked(invoke).mockResolvedValueOnce(mockResultWithMultipleValues);
    const user = userEvent.setup();
    
    render(<SingleRead connectionConfig={mockConfig} />);
    
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    await waitFor(() => {
      expect(screen.getByText('读取结果')).toBeInTheDocument();
    });
    
    // 验证统计信息
    expect(screen.getByText('最小值: 50')).toBeInTheDocument();
    expect(screen.getByText('最大值: 300')).toBeInTheDocument();
    expect(screen.getByText('平均值: 160')).toBeInTheDocument();
  });

  it('应该验证地址范围超出限制', async () => {
    const user = userEvent.setup();
    render(<SingleRead connectionConfig={mockConfig} />);
    
    // 设置会导致超出限制的参数
    const startAddressInput = screen.getByLabelText('起始地址');
    const countInput = screen.getByLabelText('读取数量');
    
    await user.clear(startAddressInput);
    await user.type(startAddressInput, '65530');
    await user.clear(countInput);
    await user.type(countInput, '10');
    
    // 尝试读取
    const readButton = screen.getByRole('button', { name: /开始读取/i });
    await user.click(readButton);
    
    expect(screen.getByText('地址范围超出限制（最大65535）')).toBeInTheDocument();
  });
});