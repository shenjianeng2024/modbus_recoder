import { DisplayFormat, ParsedData, FormatOptions } from '@/types/modbus';

/**
 * 格式化数值为指定格式
 */
export function formatValue(value: number, format: DisplayFormat, options?: FormatOptions): string {
  const { padZeros = true } = options || {};

  switch (format) {
    case 'hex':
      const hexValue = value.toString(16).toUpperCase();
      return padZeros ? `0x${hexValue.padStart(4, '0')}` : `0x${hexValue}`;
    
    case 'bin':
      const binValue = value.toString(2);
      return padZeros ? `0b${binValue.padStart(16, '0')}` : `0b${binValue}`;
    
    case 'dec':
    default:
      return value.toString();
  }
}

/**
 * 解析16位寄存器值为指定数据类型
 */
export function parseRegisterValue(
  rawValue: number, 
  dataType: string = 'uint16'
): number | string {
  switch (dataType.toLowerCase()) {
    case 'uint16':
      return rawValue;
    
    case 'int16':
      // 转换为有符号16位整数
      return rawValue > 32767 ? rawValue - 65536 : rawValue;
    
    case 'uint32':
      // 需要两个寄存器，这里只是单个寄存器的处理
      return rawValue;
    
    case 'int32':
      // 需要两个寄存器，这里只是单个寄存器的处理
      return rawValue > 32767 ? rawValue - 65536 : rawValue;
    
    case 'float32':
      // Float32需要两个寄存器，这里返回原始值
      return rawValue;
    
    default:
      return rawValue;
  }
}

/**
 * 将32位数据组合为浮点数（IEEE 754）
 */
export function combineToFloat32(highWord: number, lowWord: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  
  // 组合为32位整数（大端序）
  view.setUint16(0, highWord);
  view.setUint16(2, lowWord);
  
  // 读取为浮点数
  return view.getFloat32(0);
}

/**
 * 将两个16位寄存器组合为32位整数
 */
export function combineTo32Bit(highWord: number, lowWord: number, signed: boolean = false): number {
  const combined = (highWord << 16) | lowWord;
  
  if (signed && combined > 2147483647) {
    return combined - 4294967296;
  }
  
  return combined;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: string, includeMs: boolean = true): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  let formatted = date.toLocaleString('zh-CN', options);
  
  if (includeMs) {
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    formatted += `.${ms}`;
  }
  
  return formatted;
}

/**
 * 计算数据统计信息
 */
export function calculateStats(values: number[]): {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round((sum / values.length) * 100) / 100;

  return { min, max, avg, sum, count: values.length };
}

/**
 * 验证地址范围是否有效
 */
export function validateAddressRange(start: number, count: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (start < 0 || start > 65535) {
    errors.push('起始地址必须在 0-65535 范围内');
  }

  if (count < 1 || count > 125) {
    errors.push('读取数量必须在 1-125 范围内');
  }

  if (start + count > 65536) {
    errors.push('地址范围超出限制（最大地址65535）');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 生成CSV数据
 */
export function generateCSV(data: ParsedData[], includeHeaders: boolean = true): string {
  const headers = ['时间戳', '地址', '原始值', '解析值', '数据类型', '状态'];
  const rows: string[] = [];

  if (includeHeaders) {
    rows.push(headers.join(','));
  }

  data.forEach(item => {
    const row = [
      `"${formatTimestamp(new Date().toISOString())}"`,
      item.address.toString(),
      item.rawValue.toString(),
      `"${item.displayValue}"`,
      `"${item.dataType}"`,
      item.success ? '成功' : `失败: ${item.error || ''}`
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * 颜色编码工具 - 根据数值范围生成颜色
 */
export function getValueColor(value: number, min: number, max: number): string {
  if (min === max) return 'text-gray-500';
  
  const normalized = (value - min) / (max - min);
  
  if (normalized < 0.33) return 'text-blue-600';
  if (normalized < 0.66) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * 数据质量评估
 */
export function assessDataQuality(
  successCount: number, 
  totalCount: number, 
  avgResponseTime: number
): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  score: number;
  description: string;
} {
  const successRate = totalCount > 0 ? successCount / totalCount : 0;
  let score = successRate * 70; // 成功率占70%权重
  
  // 响应时间影响（30%权重）
  if (avgResponseTime <= 50) {
    score += 30;
  } else if (avgResponseTime <= 100) {
    score += 25;
  } else if (avgResponseTime <= 200) {
    score += 20;
  } else if (avgResponseTime <= 500) {
    score += 15;
  } else {
    score += 10;
  }

  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  let description: string;

  if (score >= 90) {
    quality = 'excellent';
    description = '数据质量优秀';
  } else if (score >= 75) {
    quality = 'good';
    description = '数据质量良好';
  } else if (score >= 60) {
    quality = 'fair';
    description = '数据质量一般';
  } else {
    quality = 'poor';
    description = '数据质量较差';
  }

  return { quality, score: Math.round(score), description };
}