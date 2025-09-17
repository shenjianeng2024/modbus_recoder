import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { ManagedAddressRange, ValidationResult, OverlapResult } from '../types/modbus';
import { 
  validateAddressRange, 
  detectRangeOverlaps, 
  generateRangeId,
  calculateTotalAddresses 
} from '../utils/addressValidation';

interface ConfigPreview {
  isValid: boolean;
  ranges: ManagedAddressRange[];
  metadata?: {
    version?: string;
    export_date?: string;
    description?: string;
    total_ranges?: number;
    total_addresses?: number;
  };
  errors: string[];
  warnings: string[];
}

interface AddressRangeContextType {
  ranges: ManagedAddressRange[];
  refreshTrigger: number;
  triggerRefresh: () => void;
  // 操作方法
  addRange: (range: Omit<ManagedAddressRange, 'id'>) => void;
  updateRange: (id: string, updates: Partial<ManagedAddressRange>) => void;
  removeRange: (id: string) => void;
  clearAllRanges: () => void;
  validateRange: (range: ManagedAddressRange) => ValidationResult;
  checkOverlaps: () => OverlapResult;
  totalAddresses: number;
  exportConfig: () => string;
  importConfig: (jsonConfig: string) => boolean;
  previewConfig: (jsonConfig: string) => ConfigPreview;
  generateTemplate: () => string;
  isLoading: boolean;
  error: string | null;
}

const AddressRangeContext = createContext<AddressRangeContextType | undefined>(undefined);

const STORAGE_KEY = 'modbus_address_ranges';

interface AddressRangeProviderProps {
  children: ReactNode;
  initialRanges?: ManagedAddressRange[];
}

export const AddressRangeProvider: React.FC<AddressRangeProviderProps> = ({ 
  children, 
  initialRanges = []
}) => {
  const [ranges, setRanges] = useState<ManagedAddressRange[]>(initialRanges);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计算总地址数
  const totalAddresses = calculateTotalAddresses(ranges);

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // 确保所有range都有enabled字段，默认为true
          const migratedRanges = parsed.map(range => ({
            ...range,
            enabled: range.enabled !== undefined ? range.enabled : true
          }));
          setRanges(migratedRanges);
          // 如果需要迁移，保存回localStorage
          if (migratedRanges.some((range, index) => range.enabled !== parsed[index]?.enabled)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedRanges));
          }
        }
      }
    } catch (err) {
      console.error('加载地址范围配置失败:', err);
      setError('加载配置失败，将使用默认配置');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存到 localStorage
  const saveToStorage = useCallback((newRanges: ManagedAddressRange[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRanges));
      setError(null);
    } catch (err) {
      console.error('保存地址范围配置失败:', err);
      setError('保存配置失败，配置可能不会持久化');
    }
  }, []);

  // 触发刷新
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // 添加地址段
  const addRange = useCallback((range: Omit<ManagedAddressRange, 'id'>) => {
    const newRange: ManagedAddressRange = {
      ...range,
      id: generateRangeId(),
      enabled: range.enabled ?? true,
    };

    setRanges(prev => {
      const updated = [...prev, newRange];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 更新地址段
  const updateRange = useCallback((id: string, updates: Partial<ManagedAddressRange>) => {
    console.log('AddressRangeContext.updateRange called:', { id: id.slice(-4), updates });
    setRanges(prev => {
      const updated = prev.map(range => 
        range.id === id ? { ...range, ...updates } : range
      );
      console.log('AddressRangeContext.updateRange result:', {
        totalRanges: updated.length,
        enabledCount: updated.filter(r => r.enabled !== false).length,
        updatedRange: updated.find(r => r.id === id)
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 删除地址段
  const removeRange = useCallback((id: string) => {
    setRanges(prev => {
      const updated = prev.filter(range => range.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 清空所有地址段
  const clearAllRanges = useCallback(() => {
    setRanges([]);
    saveToStorage([]);
  }, [saveToStorage]);

  // 验证单个地址段
  const validateRange = useCallback((range: ManagedAddressRange): ValidationResult => {
    return validateAddressRange(range);
  }, []);

  // 检查重叠
  const checkOverlaps = useCallback((): OverlapResult => {
    return detectRangeOverlaps(ranges);
  }, [ranges]);

  // 导出配置
  const exportConfig = useCallback((): string => {
    const config = {
      version: '1.0',
      export_date: new Date().toISOString(),
      description: 'Modbus地址段配置文件',
      address_ranges: ranges.map(range => ({
        name: range.name || `地址段 ${range.id.slice(-4)}`,
        start_address: range.startAddress,
        count: range.length,
        data_type: range.dataType,
        description: range.description || '',
        enabled: range.enabled !== false,
        polling_interval: 1000 // 默认轮询间隔
      })),
      metadata: {
        total_ranges: ranges.length,
        total_addresses: totalAddresses,
        enabled_ranges: ranges.filter(r => r.enabled !== false).length,
        export_tool: 'Modbus Recorder v1.0'
      }
    };
    return JSON.stringify(config, null, 2);
  }, [ranges, totalAddresses]);

  // 导入配置
  const importConfig = useCallback((jsonConfig: string): boolean => {
    try {
      const config = JSON.parse(jsonConfig);
      
      // 支持新旧两种格式
      let rangesData: any[] = [];
      
      // 新格式：使用 address_ranges
      if (config.address_ranges && Array.isArray(config.address_ranges)) {
        rangesData = config.address_ranges;
      }
      // 旧格式：使用 ranges
      else if (config.ranges && Array.isArray(config.ranges)) {
        rangesData = config.ranges;
      }
      else {
        setError('导入的配置格式不正确：缺少 address_ranges 或 ranges 数组');
        return false;
      }

      // 验证每个地址段
      const validRanges: ManagedAddressRange[] = [];
      const invalidRanges: any[] = [];
      
      for (const range of rangesData) {
        // 支持新旧两种字段名
        const startAddress = range.start_address || range.startAddress;
        const length = range.count || range.length;
        const dataType = range.data_type || range.dataType;
        const name = range.name;
        const description = range.description;
        const enabled = range.enabled;
        
        if (
          typeof startAddress === 'number' &&
          typeof length === 'number' &&
          dataType &&
          ['uint16', 'int16', 'uint32', 'int32', 'float32'].includes(dataType)
        ) {
          validRanges.push({
            id: range.id || generateRangeId(),
            name: name || '',
            startAddress: startAddress,
            length: length,
            dataType: dataType as 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32',
            description: description || '',
            enabled: enabled !== false,
          });
        } else {
          invalidRanges.push(range);
          console.warn('跳过无效的地址段:', range);
        }
      }

      if (validRanges.length === 0) {
        setError(`导入的配置中没有有效的地址段${invalidRanges.length > 0 ? `，跳过了 ${invalidRanges.length} 个无效项` : ''}`);
        return false;
      }

      setRanges(validRanges);
      saveToStorage(validRanges);
      setError(null);
      
      if (invalidRanges.length > 0) {
        console.warn(`成功导入 ${validRanges.length} 个地址段，跳过了 ${invalidRanges.length} 个无效项`);
      }
      
      return true;
    } catch (err) {
      console.error('导入配置错误:', err);
      setError('导入配置失败：JSON 格式错误');
      return false;
    }
  }, [saveToStorage]);

  // 预览配置（不实际导入）
  const previewConfig = useCallback((jsonConfig: string): ConfigPreview => {
    try {
      const config = JSON.parse(jsonConfig);
      const result: ConfigPreview = {
        isValid: false,
        ranges: [],
        errors: [],
        warnings: []
      };

      // 提取元数据
      if (config.version || config.export_date || config.description) {
        result.metadata = {
          version: config.version,
          export_date: config.export_date,
          description: config.description,
          total_ranges: config.metadata?.total_ranges,
          total_addresses: config.metadata?.total_addresses
        };
      }

      // 支持新旧两种格式
      let rangesData: any[] = [];
      
      if (config.address_ranges && Array.isArray(config.address_ranges)) {
        rangesData = config.address_ranges;
      } else if (config.ranges && Array.isArray(config.ranges)) {
        rangesData = config.ranges;
        result.warnings.push('检测到旧版本格式，建议使用新格式的配置文件');
      } else {
        result.errors.push('缺少 address_ranges 或 ranges 数组');
        return result;
      }

      // 验证每个地址段
      const validRanges: ManagedAddressRange[] = [];
      const invalidCount = { count: 0 };
      
      for (const [index, range] of rangesData.entries()) {
        const startAddress = range.start_address || range.startAddress;
        const length = range.count || range.length;
        const dataType = range.data_type || range.dataType;
        const name = range.name;
        const description = range.description;
        const enabled = range.enabled;
        
        if (
          typeof startAddress === 'number' &&
          typeof length === 'number' &&
          dataType &&
          ['uint16', 'int16', 'uint32', 'int32', 'float32'].includes(dataType)
        ) {
          const validRange: ManagedAddressRange = {
            id: range.id || generateRangeId(),
            name: name || `地址段 ${index + 1}`,
            startAddress: startAddress,
            length: length,
            dataType: dataType as 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32',
            description: description || '',
            enabled: enabled !== false,
          };
          validRanges.push(validRange);

          // 验证单个地址段
          const validation = validateAddressRange(validRange);
          if (!validation.isValid) {
            result.warnings.push(`地址段 "${validRange.name}" 有验证错误: ${validation.errors.join(', ')}`);
          }
        } else {
          invalidCount.count++;
          result.warnings.push(`第 ${index + 1} 个地址段格式无效，将被跳过`);
        }
      }

      // 检查重叠
      if (validRanges.length > 1) {
        const overlapResult = detectRangeOverlaps(validRanges);
        if (overlapResult.hasOverlap) {
          result.warnings.push(`检测到 ${overlapResult.conflicts.length} 个地址段重叠冲突`);
        }
      }

      result.ranges = validRanges;
      result.isValid = validRanges.length > 0 && result.errors.length === 0;
      
      if (validRanges.length === 0) {
        result.errors.push('没有找到有效的地址段');
      } else if (invalidCount.count > 0) {
        result.warnings.push(`共找到 ${validRanges.length} 个有效地址段，跳过了 ${invalidCount.count} 个无效项`);
      }

      return result;
    } catch (err) {
      return {
        isValid: false,
        ranges: [],
        errors: ['JSON 格式错误: ' + (err instanceof Error ? err.message : '未知错误')],
        warnings: []
      };
    }
  }, []);

  // 生成配置模板
  const generateTemplate = useCallback((): string => {
    const template = {
      version: '1.0',
      export_date: new Date().toISOString(),
      description: 'Modbus地址段配置模板 - 请根据实际情况修改',
      address_ranges: [
        {
          name: '温度传感器',
          start_address: 40001,
          count: 10,
          data_type: 'float32',
          description: '锅炉温度传感器读数',
          enabled: true,
          polling_interval: 1000
        },
        {
          name: '压力表读数',
          start_address: 40011,
          count: 5,
          data_type: 'uint16',
          description: '系统压力表读数',
          enabled: true,
          polling_interval: 2000
        },
        {
          name: '状态位',
          start_address: 40020,
          count: 8,
          data_type: 'uint16',
          description: '设备状态位信息',
          enabled: true,
          polling_interval: 500
        }
      ],
      metadata: {
        total_ranges: 3,
        total_addresses: 23,
        enabled_ranges: 3,
        export_tool: 'Modbus Recorder v1.0 Template'
      },
      usage_notes: [
        '修改 start_address 和 count 来匹配您的设备地址',
        '支持的数据类型: uint16, int16, uint32, int32, float32',
        '设置 enabled 为 false 可以禁用某个地址段',
        'polling_interval 仅作为参考，实际轮询间隔由应用程序控制'
      ]
    };
    return JSON.stringify(template, null, 2);
  }, []);

  const value: AddressRangeContextType = {
    ranges,
    refreshTrigger,
    triggerRefresh,
    addRange,
    updateRange,
    removeRange,
    clearAllRanges,
    validateRange,
    checkOverlaps,
    totalAddresses,
    exportConfig,
    importConfig,
    previewConfig,
    generateTemplate,
    isLoading,
    error,
  };

  return (
    <AddressRangeContext.Provider value={value}>
      {children}
    </AddressRangeContext.Provider>
  );
};

export const useAddressRangeContext = () => {
  const context = useContext(AddressRangeContext);
  if (context === undefined) {
    throw new Error('useAddressRangeContext must be used within an AddressRangeProvider');
  }
  return context;
};