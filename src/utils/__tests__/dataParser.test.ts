import { describe, it, expect } from 'vitest';
import {
  parseModbusData,
  formatDisplayValue,
  validateReadResult,
  convertToParsedData,
  convertBatchResult
} from '../dataParser';
import {
  DataType,
  DisplayFormat,
  AddressReadResult,
  BatchReadResult
} from '../../types/modbus';

describe('dataParser', () => {
  describe('parseModbusData', () => {
    describe('uint16 parsing', () => {
      it('应该正确解析uint16数据', () => {
        const rawData = [100, 200, 65535, 0];
        const result = parseModbusData(rawData, 'uint16', 1000);

        expect(result).toHaveLength(4);
        expect(result[0]).toEqual({
          address: 1000,
          rawValue: 100,
          parsedValue: 100,
          displayValue: '100',
          dataType: 'uint16',
          success: true
        });
        expect(result[3]).toEqual({
          address: 1003,
          rawValue: 0,
          parsedValue: 0,
          displayValue: '0',
          dataType: 'uint16',
          success: true
        });
      });

      it('应该处理uint16边界值', () => {
        const rawData = [0, 65535];
        const result = parseModbusData(rawData, 'uint16', 2000);

        expect(result[0].parsedValue).toBe(0);
        expect(result[1].parsedValue).toBe(65535);
      });
    });

    describe('int16 parsing', () => {
      it('应该正确解析int16数据', () => {
        const rawData = [100, 32767, 32768, 65535];
        const result = parseModbusData(rawData, 'int16', 1000);

        expect(result).toHaveLength(4);
        expect(result[0].parsedValue).toBe(100);
        expect(result[1].parsedValue).toBe(32767);
        expect(result[2].parsedValue).toBe(-32768); // 32768转换为有符号
        expect(result[3].parsedValue).toBe(-1); // 65535转换为-1
      });

      it('应该处理int16负数', () => {
        const rawData = [65000, 60000]; // 大于32767的值应该转为负数
        const result = parseModbusData(rawData, 'int16', 1000);

        expect(result[0].parsedValue).toBeLessThan(0);
        expect(result[1].parsedValue).toBeLessThan(0);
      });
    });

    describe('uint32 parsing', () => {
      it('应该正确解析uint32数据', () => {
        const rawData = [0x1234, 0x5678]; // 高位在前
        const result = parseModbusData(rawData, 'uint32', 1000);

        expect(result).toHaveLength(1);
        expect(result[0].address).toBe(1000);
        expect(result[0].parsedValue).toBe(0x12345678);
        expect(result[0].rawValue).toBe(0x12345678);
      });

      it('应该处理奇数长度数据', () => {
        const rawData = [0x1234, 0x5678, 0xABCD]; // 3个值，只能解析1个uint32
        const result = parseModbusData(rawData, 'uint32', 1000);

        expect(result).toHaveLength(1);
        expect(result[0].parsedValue).toBe(0x12345678);
      });

      it('应该处理uint32边界值', () => {
        const rawData = [0xFFFF, 0xFFFF]; // 最大值
        const result = parseModbusData(rawData, 'uint32', 1000);

        expect(result[0].parsedValue).toBe(0xFFFFFFFF);
      });
    });

    describe('int32 parsing', () => {
      it('应该正确解析int32数据', () => {
        const rawData = [0x0000, 0x1000, 0xFFFF, 0xFFFF];
        const result = parseModbusData(rawData, 'int32', 1000);

        expect(result).toHaveLength(2);
        expect(result[0].parsedValue).toBe(0x1000);
        expect(result[1].parsedValue).toBe(-1); // 0xFFFFFFFF as signed int32
      });

      it('应该处理int32负数', () => {
        const rawData = [0x8000, 0x0000]; // -2147483648
        const result = parseModbusData(rawData, 'int32', 1000);

        expect(result[0].parsedValue).toBe(-2147483648);
      });
    });

    describe('float32 parsing', () => {
      it('应该正确解析float32数据', () => {
        // IEEE 754: 3.14159 ≈ 0x40490FD0
        const rawData = [0x4049, 0x0FD0];
        const result = parseModbusData(rawData, 'float32', 1000);

        expect(result).toHaveLength(1);
        expect(result[0].parsedValue).toBeCloseTo(3.14159, 4);
        expect(result[0].displayValue).toBe('3.14');
      });

      it('应该处理特殊float值', () => {
        const tests = [
          { data: [0x0000, 0x0000], expected: 0.0 }, // 正零
          { data: [0x8000, 0x0000], expected: -0.0 }, // 负零
          { data: [0x7F80, 0x0000], expected: Infinity }, // 正无穷
          { data: [0xFF80, 0x0000], expected: -Infinity }, // 负无穷
        ];

        tests.forEach(({ data, expected }) => {
          const result = parseModbusData(data, 'float32', 1000);
          expect(result[0].parsedValue).toBe(expected);
        });
      });

      it('应该处理NaN值', () => {
        const rawData = [0x7FC0, 0x0000]; // NaN
        const result = parseModbusData(rawData, 'float32', 1000);

        expect(Number.isNaN(result[0].parsedValue)).toBe(true);
      });
    });

    describe('错误处理', () => {
      it('应该处理不支持的数据类型', () => {
        const rawData = [100];
        const result = parseModbusData(rawData, 'unknown' as DataType, 1000);

        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(false);
        expect(result[0].error).toContain('不支持的数据类型');
      });

      it('应该处理空数据', () => {
        const rawData: number[] = [];
        const result = parseModbusData(rawData, 'uint16', 1000);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('formatDisplayValue', () => {
    describe('十进制格式', () => {
      it('应该格式化整数', () => {
        expect(formatDisplayValue(123, { format: 'dec' })).toBe('123');
        expect(formatDisplayValue(-456, { format: 'dec' })).toBe('-456');
        expect(formatDisplayValue(0, { format: 'dec' })).toBe('0');
      });

      it('应该格式化浮点数', () => {
        expect(formatDisplayValue(123.456, { format: 'dec' })).toBe('123.46');
        expect(formatDisplayValue(123.456, { format: 'dec', precision: 3 })).toBe('123.456');
        expect(formatDisplayValue(-0.1, { format: 'dec', precision: 1 })).toBe('-0.1');
      });
    });

    describe('十六进制格式', () => {
      it('应该格式化正数', () => {
        expect(formatDisplayValue(255, { format: 'hex' })).toBe('0xFF');
        expect(formatDisplayValue(4096, { format: 'hex' })).toBe('0x1000');
        expect(formatDisplayValue(0, { format: 'hex' })).toBe('0x0');
      });

      it('应该格式化负数', () => {
        expect(formatDisplayValue(-255, { format: 'hex' })).toBe('-0xFF');
        expect(formatDisplayValue(-1, { format: 'hex' })).toBe('-0x1');
      });

      it('应该支持零填充', () => {
        expect(formatDisplayValue(15, { format: 'hex', padZeros: true })).toBe('0x000F');
        expect(formatDisplayValue(255, { format: 'hex', padZeros: true })).toBe('0x00FF');
      });
    });

    describe('二进制格式', () => {
      it('应该格式化正数', () => {
        expect(formatDisplayValue(5, { format: 'bin' })).toBe('0b101');
        expect(formatDisplayValue(255, { format: 'bin' })).toBe('0b11111111');
        expect(formatDisplayValue(0, { format: 'bin' })).toBe('0b0');
      });

      it('应该格式化负数', () => {
        expect(formatDisplayValue(-5, { format: 'bin' })).toBe('-0b101');
        expect(formatDisplayValue(-1, { format: 'bin' })).toBe('-0b1');
      });

      it('应该支持零填充', () => {
        expect(formatDisplayValue(5, { format: 'bin', padZeros: true })).toBe('0b0000000000000101');
        expect(formatDisplayValue(255, { format: 'bin', padZeros: true })).toBe('0b0000000011111111');
      });
    });

    describe('特殊值处理', () => {
      it('应该处理字符串输入', () => {
        expect(formatDisplayValue('error', { format: 'dec' })).toBe('error');
        expect(formatDisplayValue('123abc', { format: 'hex' })).toBe('123abc');
      });

      it('应该处理NaN', () => {
        expect(formatDisplayValue(NaN, { format: 'dec' })).toBe('NaN');
        expect(formatDisplayValue(NaN, { format: 'hex' })).toBe('NaN');
      });

      it('应该处理Infinity', () => {
        expect(formatDisplayValue(Infinity, { format: 'dec' })).toBe('Infinity');
        expect(formatDisplayValue(-Infinity, { format: 'dec' })).toBe('-Infinity');
      });
    });
  });

  describe('validateReadResult', () => {
    const createValidBatchResult = (): BatchReadResult => ({
      results: [
        {
          address: 1000,
          raw_value: 123,
          parsed_value: '123',
          timestamp: new Date().toISOString(),
          success: true,
          data_type: 'uint16'
        },
        {
          address: 1001,
          raw_value: 0,
          parsed_value: '',
          timestamp: new Date().toISOString(),
          success: false,
          error: '读取超时',
          data_type: 'uint16'
        }
      ],
      total_count: 2,
      success_count: 1,
      failed_count: 1,
      timestamp: new Date().toISOString(),
      duration_ms: 1000
    });

    it('应该验证有效的读取结果', () => {
      const result = validateReadResult(createValidBatchResult());

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary).toContain('验证通过');
    });

    it('应该检测空结果', () => {
      const result = validateReadResult(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('读取结果为空');
    });

    it('应该检测数据格式错误', () => {
      const invalidResult = { ...createValidBatchResult(), results: null } as any;
      const result = validateReadResult(invalidResult);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('读取结果数据格式错误');
    });

    it('应该检测统计数据不一致', () => {
      const batchResult = createValidBatchResult();
      batchResult.total_count = 5; // 与实际不符

      const result = validateReadResult(batchResult);

      expect(result.warnings.some(w => w.includes('统计数据不一致'))).toBe(true);
    });

    it('应该检测成功率过低', () => {
      const batchResult = createValidBatchResult();
      batchResult.results = batchResult.results.map(r => ({ ...r, success: false }));
      batchResult.success_count = 0;
      batchResult.failed_count = 2;

      const result = validateReadResult(batchResult);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('数据成功率过低'))).toBe(true);
    });

    it('应该检测无效地址', () => {
      const batchResult = createValidBatchResult();
      batchResult.results[0].address = -1;

      const result = validateReadResult(batchResult);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('地址无效'))).toBe(true);
    });

    it('应该检测读取耗时过长', () => {
      const batchResult = createValidBatchResult();
      batchResult.duration_ms = 6000; // 超过5秒

      const result = validateReadResult(batchResult);

      expect(result.warnings.some(w => w.includes('读取耗时过长'))).toBe(true);
    });

    it('应该检测无效时间戳', () => {
      const batchResult = createValidBatchResult();
      batchResult.timestamp = 'invalid-timestamp';

      const result = validateReadResult(batchResult);

      expect(result.warnings.some(w => w.includes('时间戳格式无效'))).toBe(true);
    });
  });

  describe('convertToParsedData', () => {
    it('应该转换成功的读取结果', () => {
      const addressResult: AddressReadResult = {
        address: 1000,
        raw_value: 123,
        parsed_value: '123',
        timestamp: new Date().toISOString(),
        success: true,
        data_type: 'uint16'
      };

      const result = convertToParsedData(addressResult);

      expect(result).toEqual({
        address: 1000,
        rawValue: 123,
        parsedValue: '123',
        displayValue: '123',
        dataType: 'uint16',
        success: true,
        error: undefined
      });
    });

    it('应该转换失败的读取结果', () => {
      const addressResult: AddressReadResult = {
        address: 1001,
        raw_value: 0,
        parsed_value: '',
        timestamp: new Date().toISOString(),
        success: false,
        error: '连接超时',
        data_type: 'int16'
      };

      const result = convertToParsedData(addressResult);

      expect(result).toEqual({
        address: 1001,
        rawValue: 0,
        parsedValue: 'Error',
        displayValue: 'Error',
        dataType: 'int16',
        success: false,
        error: '连接超时'
      });
    });
  });

  describe('convertBatchResult', () => {
    it('应该转换批量结果为解析数据', () => {
      const batchResult: BatchReadResult = {
        results: [
          {
            address: 1000,
            raw_value: 123,
            parsed_value: '123',
            timestamp: new Date().toISOString(),
            success: true,
            data_type: 'uint16'
          },
          {
            address: 1001,
            raw_value: 0,
            parsed_value: '',
            timestamp: new Date().toISOString(),
            success: false,
            error: '读取失败',
            data_type: 'int16'
          }
        ],
        total_count: 2,
        success_count: 1,
        failed_count: 1,
        timestamp: new Date().toISOString(),
        duration_ms: 500
      };

      const result = convertBatchResult(batchResult, 'dec');

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[0].displayValue).toBe('123');
      expect(result[1].success).toBe(false);
      expect(result[1].displayValue).toBe('Error');
    });

    it('应该应用显示格式', () => {
      const batchResult: BatchReadResult = {
        results: [
          {
            address: 1000,
            raw_value: 255,
            parsed_value: '255',
            timestamp: new Date().toISOString(),
            success: true,
            data_type: 'uint16'
          }
        ],
        total_count: 1,
        success_count: 1,
        failed_count: 0,
        timestamp: new Date().toISOString(),
        duration_ms: 100
      };

      const hexResult = convertBatchResult(batchResult, 'hex');
      const binResult = convertBatchResult(batchResult, 'bin');

      expect(hexResult[0].displayValue).toBe('0xFF');
      expect(binResult[0].displayValue).toBe('0b11111111');
    });
  });

  describe('边界条件和性能测试', () => {
    it('应该处理大量数据', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => i);
      const result = parseModbusData(largeData, 'uint16', 0);

      expect(result).toHaveLength(1000);
      expect(result[0].address).toBe(0);
      expect(result[999].address).toBe(999);
    });

    it('应该处理极值数据', () => {
      const extremeValues = [0, 65535, 32767, 32768];
      const result = parseModbusData(extremeValues, 'int16', 0);

      expect(result[0].parsedValue).toBe(0);
      expect(result[1].parsedValue).toBe(-1);
      expect(result[2].parsedValue).toBe(32767);
      expect(result[3].parsedValue).toBe(-32768);
    });
  });
});