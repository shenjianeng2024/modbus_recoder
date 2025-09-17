import {
  DataType,
  DisplayFormat,
  ParsedData,
  FormatOptions,
  AddressReadResult,
  BatchReadResult
} from '../types/modbus';

/**
 * 解析不同数据类型的Modbus数据
 * @param rawData 原始数据数组 (16位寄存器值)
 * @param dataType 数据类型
 * @param startAddress 起始地址
 * @returns 解析后的数据数组
 */
export function parseModbusData(
  rawData: number[], 
  dataType: DataType, 
  startAddress: number
): ParsedData[] {
  const results: ParsedData[] = [];
  
  try {
    switch (dataType) {
      case 'uint16':
        rawData.forEach((value, index) => {
          results.push({
            address: startAddress + index,
            rawValue: value,
            parsedValue: value,
            displayValue: value.toString(),
            dataType,
            success: true
          });
        });
        break;

      case 'int16':
        rawData.forEach((value, index) => {
          // 转换无符号16位到有符号16位
          const signedValue = value > 32767 ? value - 65536 : value;
          results.push({
            address: startAddress + index,
            rawValue: value,
            parsedValue: signedValue,
            displayValue: signedValue.toString(),
            dataType,
            success: true
          });
        });
        break;

      case 'uint32':
        // 32位数据需要两个16位寄存器 (高位在前)
        for (let i = 0; i < rawData.length; i += 2) {
          if (i + 1 < rawData.length) {
            const highWord = rawData[i];
            const lowWord = rawData[i + 1];
            const uint32Value = (highWord << 16) | lowWord;
            
            results.push({
              address: startAddress + i,
              rawValue: (highWord << 16) | lowWord,
              parsedValue: uint32Value >>> 0, // 确保无符号
              displayValue: (uint32Value >>> 0).toString(),
              dataType,
              success: true
            });
          }
        }
        break;

      case 'int32':
        // 32位有符号数据需要两个16位寄存器
        for (let i = 0; i < rawData.length; i += 2) {
          if (i + 1 < rawData.length) {
            const highWord = rawData[i];
            const lowWord = rawData[i + 1];
            const int32Value = (highWord << 16) | lowWord;
            
            results.push({
              address: startAddress + i,
              rawValue: int32Value,
              parsedValue: int32Value,
              displayValue: int32Value.toString(),
              dataType,
              success: true
            });
          }
        }
        break;

      case 'float32':
        // IEEE 754 单精度浮点数需要两个16位寄存器
        for (let i = 0; i < rawData.length; i += 2) {
          if (i + 1 < rawData.length) {
            const highWord = rawData[i];
            const lowWord = rawData[i + 1];
            
            // 创建32位整数
            const int32Bits = (highWord << 16) | lowWord;
            
            // 使用DataView转换为浮点数
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint32(0, int32Bits, false); // big-endian
            const floatValue = view.getFloat32(0, false);
            
            results.push({
              address: startAddress + i,
              rawValue: int32Bits,
              parsedValue: floatValue,
              displayValue: floatValue.toFixed(2),
              dataType,
              success: true
            });
          }
        }
        break;

      default:
        throw new Error(`不支持的数据类型: ${dataType}`);
    }
  } catch (error) {
    // 如果解析失败，返回错误结果
    results.push({
      address: startAddress,
      rawValue: rawData[0] || 0,
      parsedValue: 0,
      displayValue: 'Error',
      dataType,
      success: false,
      error: error instanceof Error ? error.message : '解析失败'
    });
  }

  return results;
}

/**
 * 格式化显示数值
 * @param value 数值
 * @param options 格式化选项
 * @returns 格式化后的字符串
 */
export function formatDisplayValue(
  value: number | string, 
  options: FormatOptions = { format: 'dec' }
): string {
  // 如果是字符串或者非数字，直接返回
  if (typeof value === 'string' || isNaN(Number(value))) {
    return value.toString();
  }

  const numValue = Number(value);
  const { format, precision = 2, padZeros = false } = options;

  try {
    switch (format) {
      case 'dec':
        // 十进制格式
        if (Number.isInteger(numValue)) {
          return numValue.toString();
        } else {
          return numValue.toFixed(precision);
        }

      case 'hex':
        // 十六进制格式
        const hexValue = Math.abs(Math.floor(numValue)).toString(16).toUpperCase();
        const prefix = numValue < 0 ? '-0x' : '0x';
        return prefix + (padZeros ? hexValue.padStart(4, '0') : hexValue);

      case 'bin':
        // 二进制格式
        const binValue = Math.abs(Math.floor(numValue)).toString(2);
        const binPrefix = numValue < 0 ? '-0b' : '0b';
        return binPrefix + (padZeros ? binValue.padStart(16, '0') : binValue);

      default:
        return numValue.toString();
    }
  } catch (error) {
    return 'Format Error';
  }
}

/**
 * 验证读取结果的数据完整性和有效性
 * @param result 批量读取结果
 * @returns 验证结果和详细信息
 */
export function validateReadResult(result: BatchReadResult): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本数据完整性检查
  if (!result) {
    errors.push('读取结果为空');
    return { isValid: false, errors, warnings, summary: '验证失败' };
  }

  if (!Array.isArray(result.results)) {
    errors.push('读取结果数据格式错误');
    return { isValid: false, errors, warnings, summary: '验证失败' };
  }

  // 统计数据一致性检查
  const actualTotal = result.results.length;
  if (result.total_count !== actualTotal) {
    warnings.push(`统计数据不一致: 声明${result.total_count}条，实际${actualTotal}条`);
  }

  const actualSuccessCount = result.results.filter(r => r.success).length;
  if (result.success_count !== actualSuccessCount) {
    warnings.push(`成功统计不一致: 声明${result.success_count}条，实际${actualSuccessCount}条`);
  }

  const actualFailedCount = result.results.filter(r => !r.success).length;
  if (result.failed_count !== actualFailedCount) {
    warnings.push(`失败统计不一致: 声明${result.failed_count}条，实际${actualFailedCount}条`);
  }

  // 数据质量检查
  let invalidDataCount = 0;
  result.results.forEach((item, index) => {
    if (typeof item.address !== 'number' || item.address < 0) {
      errors.push(`第${index + 1}条数据地址无效: ${item.address}`);
    }

    if (!item.success && !item.error) {
      warnings.push(`第${index + 1}条数据失败但未提供错误信息`);
    }

    if (item.success && typeof item.raw_value !== 'number') {
      errors.push(`第${index + 1}条数据原始值类型错误`);
      invalidDataCount++;
    }
  });

  // 数据质量评估
  const successRate = actualTotal > 0 ? (actualSuccessCount / actualTotal) * 100 : 0;
  if (successRate < 50) {
    errors.push(`数据成功率过低: ${successRate.toFixed(1)}%`);
  } else if (successRate < 80) {
    warnings.push(`数据成功率偏低: ${successRate.toFixed(1)}%`);
  }

  // 时间戳有效性检查
  if (!result.timestamp) {
    warnings.push('缺少时间戳信息');
  } else {
    const timestamp = new Date(result.timestamp);
    if (isNaN(timestamp.getTime())) {
      warnings.push('时间戳格式无效');
    }
  }

  // 性能检查
  if (result.duration_ms > 5000) {
    warnings.push(`读取耗时过长: ${result.duration_ms}ms`);
  }

  const isValid = errors.length === 0;
  const summary = isValid 
    ? `验证通过: ${actualSuccessCount}/${actualTotal} 条数据成功，耗时 ${result.duration_ms}ms`
    : `验证失败: ${errors.length} 个错误，${warnings.length} 个警告`;

  return { isValid, errors, warnings, summary };
}

/**
 * 转换后端数据结构为前端解析数据
 * @param addressResult 后端地址读取结果
 * @returns 前端解析数据
 */
export function convertToParsedData(addressResult: AddressReadResult): ParsedData {
  return {
    address: addressResult.address,
    rawValue: addressResult.raw_value,
    parsedValue: addressResult.success ? addressResult.parsed_value : 'Error',
    displayValue: addressResult.success ? addressResult.parsed_value : 'Error',
    dataType: addressResult.data_type as DataType,
    success: addressResult.success,
    error: addressResult.error
  };
}

/**
 * 批量转换后端批次读取结果
 * @param batchResult 后端批次读取结果
 * @param displayFormat 显示格式
 * @returns 前端解析数据数组
 */
export function convertBatchResult(
  batchResult: BatchReadResult,
  displayFormat: DisplayFormat = 'dec'
): ParsedData[] {
  return batchResult.results.map(result => {
    const parsed = convertToParsedData(result);
    
    // 应用显示格式 - 尝试将parsed_value转换为数字
    if (parsed.success && result.parsed_value) {
      const numValue = Number(result.parsed_value);
      if (!isNaN(numValue)) {
        parsed.parsedValue = numValue;
        parsed.displayValue = formatDisplayValue(numValue, { format: displayFormat });
      }
    }
    
    return parsed;
  });
}