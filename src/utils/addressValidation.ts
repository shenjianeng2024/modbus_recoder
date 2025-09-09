import { ManagedAddressRange, ValidationResult, OverlapResult } from '../types/modbus';

// Modbus Holding Registers 地址范围: 40001-49999 (或者 0-9998)
const MIN_HOLDING_REGISTER = 0;
const MAX_HOLDING_REGISTER = 65535;
const MAX_RANGE_LENGTH = 120;

/**
 * 验证单个地址段的有效性
 */
export const validateAddressRange = (range: ManagedAddressRange): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查起始地址是否有效
  if (range.startAddress < MIN_HOLDING_REGISTER) {
    errors.push(`起始地址不能小于 ${MIN_HOLDING_REGISTER}`);
  }
  if (range.startAddress > MAX_HOLDING_REGISTER) {
    errors.push(`起始地址不能大于 ${MAX_HOLDING_REGISTER}`);
  }

  // 检查长度是否有效
  if (range.length <= 0) {
    errors.push('地址段长度必须大于 0');
  }
  if (range.length > MAX_RANGE_LENGTH) {
    errors.push(`地址段长度不能超过 ${MAX_RANGE_LENGTH}`);
  }

  // 检查结束地址是否超出范围
  const endAddress = range.startAddress + range.length - 1;
  if (endAddress > MAX_HOLDING_REGISTER) {
    errors.push(`结束地址 (${endAddress}) 超出最大地址范围 (${MAX_HOLDING_REGISTER})`);
  }

  // 检查名称是否合理
  if (range.name && range.name.trim().length === 0) {
    warnings.push('地址段名称不能为空字符串');
  }

  // 性能警告
  if (range.length > 100) {
    warnings.push('地址段长度较大，可能影响读取性能');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * 检测地址段重叠
 */
export const detectRangeOverlaps = (ranges: ManagedAddressRange[]): OverlapResult => {
  const conflicts: OverlapResult['conflicts'] = [];
  
  // 只检查启用的地址段
  const enabledRanges = ranges.filter(range => range.enabled !== false);

  for (let i = 0; i < enabledRanges.length; i++) {
    for (let j = i + 1; j < enabledRanges.length; j++) {
      const range1 = enabledRanges[i];
      const range2 = enabledRanges[j];
      
      const range1End = range1.startAddress + range1.length - 1;
      const range2End = range2.startAddress + range2.length - 1;
      
      // 检查是否有重叠
      const overlapStart = Math.max(range1.startAddress, range2.startAddress);
      const overlapEnd = Math.min(range1End, range2End);
      
      if (overlapStart <= overlapEnd) {
        conflicts.push({
          range1,
          range2,
          overlapStart,
          overlapEnd,
        });
      }
    }
  }

  return {
    hasOverlap: conflicts.length > 0,
    conflicts,
  };
};

/**
 * 检查地址段长度是否有效
 */
export const isValidRangeLength = (length: number): boolean => {
  return length > 0 && length <= MAX_RANGE_LENGTH;
};

/**
 * 获取地址段的结束地址
 */
export const getEndAddress = (range: ManagedAddressRange): number => {
  return range.startAddress + range.length - 1;
};

/**
 * 格式化地址段显示文本
 */
export const formatAddressRange = (range: ManagedAddressRange): string => {
  const endAddress = getEndAddress(range);
  return `${range.startAddress}-${endAddress}`;
};

/**
 * 计算所有地址段的总地址数
 */
export const calculateTotalAddresses = (ranges: ManagedAddressRange[]): number => {
  return ranges
    .filter(range => range.enabled !== false)
    .reduce((total, range) => total + range.length, 0);
};

/**
 * 生成唯一的地址段ID
 */
export const generateRangeId = (): string => {
  return `range_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 数据类型的显示名称映射
 */
export const DATA_TYPE_LABELS = {
  'uint16': '无符号16位整数',
  'int16': '有符号16位整数', 
  'uint32': '无符号32位整数',
  'int32': '有符号32位整数',
  'float32': '32位浮点数',
} as const;

/**
 * 常用地址段模板
 */
export const ADDRESS_RANGE_TEMPLATES = [
  {
    name: '温度传感器',
    startAddress: 1000,
    length: 10,
    dataType: 'int16' as const,
    description: '温度传感器数据区域',
  },
  {
    name: '压力传感器',
    startAddress: 2000,
    length: 10,
    dataType: 'uint16' as const,
    description: '压力传感器数据区域',
  },
  {
    name: '流量传感器',
    startAddress: 3000,
    length: 20,
    dataType: 'float32' as const,
    description: '流量传感器数据区域',
  },
  {
    name: '控制状态',
    startAddress: 4000,
    length: 5,
    dataType: 'uint16' as const,
    description: '设备控制状态寄存器',
  },
] as const;