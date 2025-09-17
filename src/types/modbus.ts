export interface ConnectionConfig {
  ip: string;
  port: number;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
}

export interface AddressRange {
  start: number;
  count: number;
  data_type?: string;
}

// 地址范围管理相关接口
export interface ManagedAddressRange {
  id: string;
  name?: string;
  startAddress: number;
  length: number;
  dataType: 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32';
  description?: string;
  enabled?: boolean;
}

export interface AddressRangeConfig {
  ranges: ManagedAddressRange[];
  maxRangeLength: number; // 120
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface OverlapResult {
  hasOverlap: boolean;
  conflicts: {
    range1: ManagedAddressRange;
    range2: ManagedAddressRange;
    overlapStart: number;
    overlapEnd: number;
  }[];
}

export interface ReadRequest {
  ip: string;
  port: number;
  ranges: AddressRange[];
}

export interface ReadResult {
  success: boolean;
  data: number[];
  address_range: AddressRange;
  timestamp: string;
  message: string;
}

export interface DataPoint {
  timestamp: string;
  address: number;
  value: number;
}

export interface CollectionStatus {
  isRunning: boolean;
  intervalMs: number;
  dataCount: number;
}

// 数据解析相关类型定义
export type DataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32';
export type DisplayFormat = 'dec' | 'hex' | 'bin';

// 与后端保持一致的数据结构
export interface AddressReadResult {
  address: number;
  raw_value: number;
  parsed_value: string;
  timestamp: string;
  success: boolean;
  error?: string;
  data_type: string;
}

export interface BatchReadResult {
  results: AddressReadResult[];
  total_count: number;
  success_count: number;
  failed_count: number;
  timestamp: string;
  duration_ms: number;
}

// 前端特定的解析数据结构
export interface ParsedData {
  address: number;
  rawValue: number;
  parsedValue: number | string;
  displayValue: string;
  dataType: DataType;
  success: boolean;
  error?: string;
}

// 数据格式化选项
export interface FormatOptions {
  format: DisplayFormat;
  precision?: number; // 浮点数精度
  padZeros?: boolean; // 是否填充前导零
}