/**
 * 数据格式化相关类型定义
 */

// 时间格式选项
export type TimeFormat = 'iso' | 'local' | 'short' | 'relative';

// 数值精度选项
export type NumberPrecision = 1 | 2 | 3 | 4 | 5 | 6;

// 时间显示配置
export interface TimeFormatOptions {
  format: TimeFormat;
  showMilliseconds: boolean;
  showTimezone: boolean;
  locale: string;
}

// 数值格式化配置
export interface NumberFormatOptions {
  precision: NumberPrecision;
  showUnit: boolean;
  useScientificNotation: boolean;
  thousandsSeparator: boolean;
}

// 用户显示偏好
export interface UserDisplayPreferences {
  timeFormat: TimeFormatOptions;
  numberFormat: NumberFormatOptions;
  tableStyle: {
    alternatingRowColors: boolean;
    compactMode: boolean;
    showDataTypeIcons: boolean;
  };
  theme: {
    colorScheme: 'light' | 'dark' | 'auto';
    highlightErrorValues: boolean;
    showValueRangeIndicators: boolean;
  };
}

// 格式化结果接口
export interface FormattedValue {
  display: string;
  raw: number | string;
  unit?: string;
  isError?: boolean;
  tooltip?: string;
}

// 时间格式化结果
export interface FormattedTime {
  display: string;
  iso: string;
  relative?: string;
  tooltip?: string;
}

// 默认配置
export const DEFAULT_DISPLAY_PREFERENCES: UserDisplayPreferences = {
  timeFormat: {
    format: 'local',
    showMilliseconds: false,
    showTimezone: false,
    locale: 'zh-CN'
  },
  numberFormat: {
    precision: 2,
    showUnit: false,
    useScientificNotation: false,
    thousandsSeparator: true
  },
  tableStyle: {
    alternatingRowColors: true,
    compactMode: false,
    showDataTypeIcons: true
  },
  theme: {
    colorScheme: 'auto',
    highlightErrorValues: true,
    showValueRangeIndicators: true
  }
};