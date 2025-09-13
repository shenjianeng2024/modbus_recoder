/**
 * 用户偏好设置Hook
 * 管理显示格式、主题等用户个性化配置
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  UserDisplayPreferences, 
  DEFAULT_DISPLAY_PREFERENCES,
  TimeFormatOptions,
  NumberFormatOptions
} from '../types/formatting';

const STORAGE_KEY = 'modbus_recorder_display_preferences';

/**
 * 用户偏好设置Hook
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserDisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从本地存储加载偏好设置
  const loadPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserDisplayPreferences;
        
        // 合并默认配置，确保新增的配置项有默认值
        const merged = mergePreferences(DEFAULT_DISPLAY_PREFERENCES, parsed);
        setPreferences(merged);
      }
    } catch (err) {
      setError(`加载用户偏好失败: ${err}`);
      console.error('Failed to load user preferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存偏好设置到本地存储
  const savePreferences = useCallback(async (newPreferences: UserDisplayPreferences) => {
    try {
      setError(null);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (err) {
      setError(`保存用户偏好失败: ${err}`);
      console.error('Failed to save user preferences:', err);
      throw err;
    }
  }, []);

  // 更新时间格式配置
  const updateTimeFormat = useCallback(async (timeOptions: Partial<TimeFormatOptions>) => {
    const updated = {
      ...preferences,
      timeFormat: { ...preferences.timeFormat, ...timeOptions }
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // 更新数值格式配置
  const updateNumberFormat = useCallback(async (numberOptions: Partial<NumberFormatOptions>) => {
    const updated = {
      ...preferences,
      numberFormat: { ...preferences.numberFormat, ...numberOptions }
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // 更新表格样式配置
  const updateTableStyle = useCallback(async (tableOptions: Partial<UserDisplayPreferences['tableStyle']>) => {
    const updated = {
      ...preferences,
      tableStyle: { ...preferences.tableStyle, ...tableOptions }
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // 更新主题配置
  const updateTheme = useCallback(async (themeOptions: Partial<UserDisplayPreferences['theme']>) => {
    const updated = {
      ...preferences,
      theme: { ...preferences.theme, ...themeOptions }
    };
    await savePreferences(updated);
  }, [preferences, savePreferences]);

  // 重置为默认配置
  const resetToDefaults = useCallback(async () => {
    await savePreferences(DEFAULT_DISPLAY_PREFERENCES);
  }, [savePreferences]);

  // 导出配置
  const exportPreferences = useCallback(() => {
    return JSON.stringify(preferences, null, 2);
  }, [preferences]);

  // 导入配置
  const importPreferences = useCallback(async (configJson: string) => {
    try {
      const imported = JSON.parse(configJson) as UserDisplayPreferences;
      const merged = mergePreferences(DEFAULT_DISPLAY_PREFERENCES, imported);
      await savePreferences(merged);
    } catch (err) {
      setError(`导入配置失败: ${err}`);
      throw err;
    }
  }, [savePreferences]);

  // 初始化加载
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // 快捷配置预设
  const applyPreset = useCallback(async (presetName: PresetName) => {
    const preset = getPreset(presetName);
    await savePreferences(preset);
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    error,
    // 更新方法
    updateTimeFormat,
    updateNumberFormat,
    updateTableStyle,
    updateTheme,
    // 完整配置管理
    savePreferences,
    resetToDefaults,
    // 导入导出
    exportPreferences,
    importPreferences,
    // 预设配置
    applyPreset,
    // 工具方法
    loadPreferences
  };
}

/**
 * 合并偏好配置，确保向后兼容性
 */
function mergePreferences(
  defaults: UserDisplayPreferences, 
  user: Partial<UserDisplayPreferences>
): UserDisplayPreferences {
  return {
    timeFormat: { ...defaults.timeFormat, ...user.timeFormat },
    numberFormat: { ...defaults.numberFormat, ...user.numberFormat },
    tableStyle: { ...defaults.tableStyle, ...user.tableStyle },
    theme: { ...defaults.theme, ...user.theme }
  };
}

/**
 * 预设配置类型
 */
type PresetName = 'developer' | 'analyst' | 'operator' | 'compact';

/**
 * 获取预设配置
 */
function getPreset(name: PresetName): UserDisplayPreferences {
  const base = { ...DEFAULT_DISPLAY_PREFERENCES };

  switch (name) {
    case 'developer':
      return {
        ...base,
        timeFormat: {
          ...base.timeFormat,
          format: 'iso',
          showMilliseconds: true
        },
        numberFormat: {
          ...base.numberFormat,
          precision: 6,
          useScientificNotation: true
        },
        tableStyle: {
          ...base.tableStyle,
          compactMode: false,
          showDataTypeIcons: true
        }
      };

    case 'analyst':
      return {
        ...base,
        timeFormat: {
          ...base.timeFormat,
          format: 'local',
          showMilliseconds: false
        },
        numberFormat: {
          ...base.numberFormat,
          precision: 3,
          thousandsSeparator: true,
          showUnit: true
        },
        theme: {
          ...base.theme,
          showValueRangeIndicators: true
        }
      };

    case 'operator':
      return {
        ...base,
        timeFormat: {
          ...base.timeFormat,
          format: 'relative',
          showMilliseconds: false
        },
        numberFormat: {
          ...base.numberFormat,
          precision: 1,
          thousandsSeparator: false
        },
        tableStyle: {
          ...base.tableStyle,
          compactMode: true,
          alternatingRowColors: true
        }
      };

    case 'compact':
      return {
        ...base,
        timeFormat: {
          ...base.timeFormat,
          format: 'short',
          showMilliseconds: false
        },
        numberFormat: {
          ...base.numberFormat,
          precision: 2,
          thousandsSeparator: false
        },
        tableStyle: {
          ...base.tableStyle,
          compactMode: true,
          showDataTypeIcons: false
        }
      };

    default:
      return base;
  }
}

/**
 * 获取可用的预设配置列表
 */
export function getAvailablePresets() {
  return [
    {
      name: 'developer' as PresetName,
      label: '开发者模式',
      description: '详细显示，包含完整时间戳和高精度数值'
    },
    {
      name: 'analyst' as PresetName,
      label: '分析师模式',
      description: '适合数据分析，显示单位和范围指示'
    },
    {
      name: 'operator' as PresetName,
      label: '操作员模式',
      description: '简洁显示，相对时间和紧凑布局'
    },
    {
      name: 'compact' as PresetName,
      label: '紧凑模式',
      description: '最小化显示，适合小屏幕设备'
    }
  ];
}