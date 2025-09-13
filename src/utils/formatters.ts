/**
 * 统一的格式化工具函数库
 * 整合数值、时间、表格显示的所有格式化需求
 */

import { 
  TimeFormatOptions, 
  NumberFormatOptions, 
  FormattedValue, 
  FormattedTime
} from '../types/formatting';
import { DisplayFormat, DataType } from '../types/modbus';

/**
 * 格式化时间戳 - 统一时间显示标准
 */
export function formatTimestamp(
  timestamp: string | Date,
  options?: Partial<TimeFormatOptions>
): FormattedTime {
  const date = new Date(timestamp);
  
  // 默认选项
  const opts: TimeFormatOptions = {
    format: 'local',
    showMilliseconds: false,
    showTimezone: false,
    locale: 'zh-CN',
    ...options
  };

  if (isNaN(date.getTime())) {
    return {
      display: '无效时间',
      iso: '',
      tooltip: '时间戳格式错误'
    };
  }

  const iso = date.toISOString();
  let display = '';
  let relative = '';

  switch (opts.format) {
    case 'iso':
      display = iso;
      break;
    
    case 'local':
      const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      
      if (opts.showTimezone) {
        formatOptions.timeZoneName = 'short';
      }
      
      display = date.toLocaleString(opts.locale, formatOptions);
      
      if (opts.showMilliseconds) {
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        display += `.${ms}`;
      }
      break;
    
    case 'short':
      display = date.toLocaleString(opts.locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      break;
    
    case 'relative':
      relative = getRelativeTime(date);
      display = relative;
      break;
  }

  // 生成相对时间（用于tooltip）
  if (opts.format !== 'relative') {
    relative = getRelativeTime(date);
  }

  return {
    display,
    iso,
    relative: opts.format !== 'relative' ? relative : undefined,
    tooltip: opts.format === 'relative' 
      ? date.toLocaleString(opts.locale)
      : relative
  };
}

/**
 * 获取相对时间显示
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return '刚刚';
  if (diffSec < 60) return `${diffSec}秒前`;
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  
  return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化数值 - 统一数值显示标准
 */
export function formatNumber(
  value: number | string,
  dataType: DataType,
  displayFormat: DisplayFormat = 'dec',
  options?: Partial<NumberFormatOptions>
): FormattedValue {
  // 默认选项
  const opts: NumberFormatOptions = {
    precision: 2,
    showUnit: false,
    useScientificNotation: false,
    thousandsSeparator: true,
    ...options
  };

  // 如果是字符串或者非数字，直接返回
  if (typeof value === 'string' || isNaN(Number(value))) {
    return {
      display: value.toString(),
      raw: value,
      isError: true,
      tooltip: '非数值类型'
    };
  }

  const numValue = Number(value);
  let display = '';
  let unit = '';
  let tooltip = '';

  try {
    switch (displayFormat) {
      case 'hex':
        display = formatHexValue(numValue);
        break;
      
      case 'bin':
        display = formatBinaryValue(numValue);
        break;
      
      case 'dec':
      default:
        display = formatDecimalValue(numValue, dataType, opts);
        break;
    }

    // 添加单位（如果启用）
    if (opts.showUnit) {
      unit = getDataTypeUnit(dataType);
    }

    // 生成tooltip信息
    tooltip = generateValueTooltip(numValue, dataType, displayFormat);

  } catch (error) {
    return {
      display: 'Format Error',
      raw: value,
      isError: true,
      tooltip: `格式化错误: ${error}`
    };
  }

  return {
    display: unit ? `${display} ${unit}` : display,
    raw: numValue,
    unit,
    tooltip
  };
}

/**
 * 格式化十进制数值
 */
function formatDecimalValue(
  value: number, 
  dataType: DataType, 
  options: NumberFormatOptions
): string {
  // 处理科学计数法
  if (options.useScientificNotation && (Math.abs(value) >= 1e6 || Math.abs(value) < 1e-3)) {
    return value.toExponential(options.precision);
  }

  // 根据数据类型判断是否需要小数
  const needsDecimal = dataType === 'float32';
  
  if (needsDecimal) {
    let formatted = value.toFixed(options.precision);
    
    // 移除不必要的尾随零
    formatted = formatted.replace(/\.?0+$/, '');
    
    return options.thousandsSeparator ? addThousandsSeparator(formatted) : formatted;
  } else {
    // 整数类型
    const intValue = Math.floor(value);
    return options.thousandsSeparator ? addThousandsSeparator(intValue.toString()) : intValue.toString();
  }
}

/**
 * 格式化十六进制值
 */
function formatHexValue(value: number): string {
  const hexValue = Math.abs(Math.floor(value)).toString(16).toUpperCase();
  const prefix = value < 0 ? '-0x' : '0x';
  return prefix + hexValue.padStart(4, '0');
}

/**
 * 格式化二进制值
 */
function formatBinaryValue(value: number): string {
  const binValue = Math.abs(Math.floor(value)).toString(2);
  const prefix = value < 0 ? '-0b' : '0b';
  return prefix + binValue.padStart(16, '0');
}

/**
 * 添加千分位分隔符
 */
function addThousandsSeparator(value: string): string {
  const parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

/**
 * 获取数据类型单位
 */
function getDataTypeUnit(dataType: DataType): string {
  switch (dataType) {
    case 'uint16':
    case 'int16':
      return '';
    case 'uint32':
    case 'int32':
      return '';
    case 'float32':
      return '';
    default:
      return '';
  }
}

/**
 * 生成数值tooltip信息
 */
function generateValueTooltip(
  value: number, 
  dataType: DataType, 
  currentFormat: DisplayFormat
): string {
  const formats = ['dec', 'hex', 'bin'] as DisplayFormat[];
  const tooltipLines: string[] = [];
  
  tooltipLines.push(`数据类型: ${dataType}`);
  
  formats.forEach(format => {
    if (format !== currentFormat) {
      let formatted = '';
      switch (format) {
        case 'dec':
          formatted = value.toString();
          break;
        case 'hex':
          formatted = formatHexValue(value);
          break;
        case 'bin':
          formatted = formatBinaryValue(value);
          break;
      }
      tooltipLines.push(`${getFormatName(format)}: ${formatted}`);
    }
  });
  
  return tooltipLines.join('\n');
}

/**
 * 获取格式名称
 */
function getFormatName(format: DisplayFormat): string {
  switch (format) {
    case 'dec': return '十进制';
    case 'hex': return '十六进制';
    case 'bin': return '二进制';
    default: return format;
  }
}

/**
 * 格式化数据表格行 - 专门用于表格显示
 */
export function formatTableRow(
  address: number,
  rawValue: number,
  parsedValue: number | string,
  dataType: DataType,
  timestamp: string,
  success: boolean,
  error?: string,
  displayFormat: DisplayFormat = 'dec',
  options?: {
    timeOptions?: Partial<TimeFormatOptions>;
    numberOptions?: Partial<NumberFormatOptions>;
  }
) {
  const timeFormatted = formatTimestamp(timestamp, options?.timeOptions);
  const valueFormatted = formatNumber(parsedValue, dataType, displayFormat, options?.numberOptions);
  
  return {
    address: address.toString(),
    rawValue: rawValue.toString(),
    parsedValue: valueFormatted,
    timestamp: timeFormatted,
    dataType,
    success,
    error,
    // 用于排序和过滤的原始值
    _sort: {
      address,
      rawValue,
      parsedValue: typeof parsedValue === 'number' ? parsedValue : 0,
      timestamp: new Date(timestamp).getTime()
    }
  };
}

/**
 * 批量格式化表格数据
 */
export function formatTableData(
  data: Array<{
    address: number;
    rawValue: number;
    parsedValue: number | string;
    dataType: DataType;
    timestamp: string;
    success: boolean;
    error?: string;
  }>,
  displayFormat: DisplayFormat = 'dec',
  options?: {
    timeOptions?: Partial<TimeFormatOptions>;
    numberOptions?: Partial<NumberFormatOptions>;
  }
) {
  return data.map(item => formatTableRow(
    item.address,
    item.rawValue,
    item.parsedValue,
    item.dataType,
    item.timestamp,
    item.success,
    item.error,
    displayFormat,
    options
  ));
}