import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DataReader } from '../DataReader';
import { useAddressRanges } from '../../hooks/useAddressRanges';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { notifications } from '../../utils/notifications';
import { invoke } from '@tauri-apps/api/core';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock dependencies
vi.mock('@tauri-apps/api/core');
vi.mock('../../hooks/useAddressRanges');
vi.mock('../../hooks/useErrorHandler');
vi.mock('../../utils/notifications');

const mockInvoke = vi.mocked(invoke);
const mockUseAddressRanges = vi.mocked(useAddressRanges);
const mockUseErrorHandler = vi.mocked(useErrorHandler);
const mockNotifications = vi.mocked(notifications);

describe('DataReader', () => {
  const mockConnectionConfig = {
    ip: '192.168.1.100',
    port: 502
  };

  const mockHandleError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useErrorHandler
    mockUseErrorHandler.mockReturnValue({
      handleError: mockHandleError,
      clearAllErrors: vi.fn(),
      errors: [],
      errorCount: 0
    });

    // Mock notifications
    mockNotifications.loading.mockReturnValue('loading-toast-id');
    mockNotifications.dismiss.mockImplementation(() => {});
    mockNotifications.success.mockImplementation(() => {});
    mockNotifications.error.mockImplementation(() => {});
    mockNotifications.warning.mockImplementation(() => {});
  });

  describe('Component Rendering', () => {
    it('渲染基本组件结构', () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 0,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      expect(screen.getByText('单次数据读取')).toBeInTheDocument();
      expect(screen.getByText('立即读取')).toBeInTheDocument();
      expect(screen.getByText('格式:')).toBeInTheDocument();
      expect(screen.getByText('状态:')).toBeInTheDocument();
      expect(screen.getByText('空闲')).toBeInTheDocument();
    });

    it('当没有启用地址段时显示警告', () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 10,
            dataType: 'uint16',
            enabled: false
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 10,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      expect(screen.getByText(/无可读取的地址段/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /立即读取/ })).toBeDisabled();
    });

    it('当有启用地址段时显示统计信息', () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 10,
            dataType: 'uint16',
            enabled: true
          },
          {
            id: '2',
            name: 'Range 2',
            startAddress: 2000,
            length: 5,
            dataType: 'float32',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 15,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      expect(screen.getByText('📍 已启用地址段: 2 个')).toBeInTheDocument();
      expect(screen.getByText('📊 总地址数: 15 个')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /立即读取/ })).not.toBeDisabled();
    });

    it('当disabled prop为true时禁用读取按钮', () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 10,
            dataType: 'uint16',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 10,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} disabled={true} />
        </TooltipProvider>
      );

      expect(screen.getByRole('button', { name: /立即读取/ })).toBeDisabled();
    });
  });

  describe('Reading Functionality', () => {
    const mockBatchResult = {
      results: [
        {
          address: 1000,
          raw_value: 12345,
          parsed_value: '12345',
          timestamp: '2025-09-09T12:34:56Z',
          success: true,
          data_type: 'uint16'
        },
        {
          address: 1001,
          raw_value: 23456,
          parsed_value: '123.45',
          timestamp: '2025-09-09T12:34:56Z',
          success: true,
          data_type: 'float32'
        },
        {
          address: 1002,
          raw_value: 0,
          parsed_value: '',
          timestamp: '2025-09-09T12:34:56Z',
          success: false,
          error: '连接超时',
          data_type: 'uint16'
        }
      ],
      total_count: 3,
      success_count: 2,
      failed_count: 1,
      timestamp: '2025-09-09T12:34:56Z',
      duration_ms: 1200
    };

    beforeEach(() => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 3,
            dataType: 'uint16',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 3,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });
    });

    it('成功执行读取操作', async () => {
      mockInvoke.mockResolvedValue(mockBatchResult);

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      // 验证读取中状态
      expect(screen.getByText('读取中...')).toBeInTheDocument();
      expect(screen.getByText('读取中')).toBeInTheDocument();

      // 等待读取完成
      await waitFor(() => {
        expect(screen.getByText('已完成')).toBeInTheDocument();
      });

      // 验证调用了正确的API
      expect(mockInvoke).toHaveBeenCalledWith('read_modbus_ranges', {
        request: {
          ranges: [{ start: 1000, count: 3 }],
          format: 'dec'
        }
      });

      // 验证显示了成功通知
      expect(mockNotifications.success).toHaveBeenCalledWith(
        '数据读取完成',
        '成功读取 2/3 个地址，耗时 1200ms'
      );

      // 验证显示了读取结果
      expect(screen.getByText('读取结果')).toBeInTheDocument();
      expect(screen.getByText('2/3')).toBeInTheDocument();
    });

    it('处理读取失败情况', async () => {
      const errorMessage = '网络连接失败';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByText('错误')).toBeInTheDocument();
      });

      // 验证显示了错误信息
      expect(screen.getByText(`批量读取失败: Error: ${errorMessage}`)).toBeInTheDocument();

      // 验证调用了错误处理
      expect(mockHandleError).toHaveBeenCalled();
      expect(mockNotifications.error).toHaveBeenCalledWith(
        '读取失败',
        `批量读取失败: Error: ${errorMessage}`
      );
    });

    it('处理无启用地址段的情况', async () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 0,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      // 等待事件处理完成
      await waitFor(() => {
        expect(mockNotifications.warning).toHaveBeenCalledWith(
          '无可读取数据',
          '请先在地址范围管理中配置并启用至少一个地址段'
        );
      });

      // 验证没有调用读取API
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('显示读取结果表格', async () => {
      mockInvoke.mockResolvedValue(mockBatchResult);

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByText('已完成')).toBeInTheDocument();
      });

      // 验证表格头
      expect(screen.getByText('地址')).toBeInTheDocument();
      expect(screen.getByText('原始值')).toBeInTheDocument();
      expect(screen.getByText('解析值')).toBeInTheDocument();
      expect(screen.getByText('类型')).toBeInTheDocument();
      expect(screen.getByText('时间戳')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();

      // 验证数据行
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('1002')).toBeInTheDocument();

      // 验证统计信息
      expect(screen.getByText('成功 2')).toBeInTheDocument();
      expect(screen.getByText('失败 1')).toBeInTheDocument();
      expect(screen.getByText('用时 1.20s')).toBeInTheDocument();
    });
  });

  describe('Format Switching', () => {
    const mockResultWithNumbers = {
      results: [
        {
          address: 1000,
          raw_value: 255,
          parsed_value: '255',
          timestamp: '2025-09-09T12:34:56Z',
          success: true,
          data_type: 'uint16'
        }
      ],
      total_count: 1,
      success_count: 1,
      failed_count: 0,
      timestamp: '2025-09-09T12:34:56Z',
      duration_ms: 500
    };

    beforeEach(() => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 1,
            dataType: 'uint16',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 1,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });
    });

    it('切换显示格式', async () => {
      mockInvoke.mockResolvedValue(mockResultWithNumbers);

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      // 首次读取
      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByText('已完成')).toBeInTheDocument();
      });

      // 切换到十六进制格式
      const formatSelect = screen.getByRole('combobox');
      fireEvent.click(formatSelect);
      fireEvent.click(screen.getByText('十六进制'));

      // 再次读取以应用新格式
      fireEvent.click(readButton);

      await waitFor(() => {
        // 验证调用了正确的格式
        expect(mockInvoke).toHaveBeenLastCalledWith('read_modbus_ranges', {
          request: {
            ranges: [{ start: 1000, count: 1 }],
            format: 'hex'
          }
        });
      });
    });

    it('禁用读取时不能切换格式', () => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 1,
            dataType: 'uint16',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 1,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} disabled={true} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      expect(readButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAddressRanges.mockReturnValue({
        ranges: [
          {
            id: '1',
            name: 'Range 1',
            startAddress: 1000,
            length: 1,
            dataType: 'uint16',
            enabled: true
          }
        ],
        addRange: vi.fn(),
        updateRange: vi.fn(),
        removeRange: vi.fn(),
        clearAllRanges: vi.fn(),
        validateRange: vi.fn(),
        checkOverlaps: vi.fn(),
        totalAddresses: 1,
        exportConfig: vi.fn(),
        importConfig: vi.fn(),
        isLoading: false,
        error: null
      });
    });

    it('处理数据验证失败', async () => {
      const invalidResult = {
        results: [],
        total_count: 1, // 不匹配实际结果数量
        success_count: 0,
        failed_count: 0,
        timestamp: '2025-09-09T12:34:56Z',
        duration_ms: 500
      };

      mockInvoke.mockResolvedValue(invalidResult);

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByText('错误')).toBeInTheDocument();
      });
    });

    it('处理全部读取失败的情况', async () => {
      const allFailedResult = {
        results: [
          {
            address: 1000,
            raw_value: 0,
            parsed_value: '',
            timestamp: '2025-09-09T12:34:56Z',
            success: false,
            error: '设备无响应',
            data_type: 'uint16'
          }
        ],
        total_count: 1,
        success_count: 0,
        failed_count: 1,
        timestamp: '2025-09-09T12:34:56Z',
        duration_ms: 5000
      };

      mockInvoke.mockResolvedValue(allFailedResult);

      render(
        <TooltipProvider>
          <DataReader connectionConfig={mockConnectionConfig} />
        </TooltipProvider>
      );

      const readButton = screen.getByRole('button', { name: /立即读取/ });
      fireEvent.click(readButton);

      await waitFor(() => {
        expect(screen.getByText('错误')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockNotifications.warning).toHaveBeenCalledWith(
          '读取完成但无数据',
          '所有 1 个地址读取失败'
        );
      });
    });
  });
});