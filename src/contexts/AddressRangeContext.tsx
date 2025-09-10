import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { ManagedAddressRange, ValidationResult, OverlapResult } from '../types/modbus';
import { 
  validateAddressRange, 
  detectRangeOverlaps, 
  generateRangeId,
  calculateTotalAddresses 
} from '../utils/addressValidation';

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
      exportTime: new Date().toISOString(),
      ranges: ranges,
      totalAddresses: totalAddresses,
    };
    return JSON.stringify(config, null, 2);
  }, [ranges, totalAddresses]);

  // 导入配置
  const importConfig = useCallback((jsonConfig: string): boolean => {
    try {
      const config = JSON.parse(jsonConfig);
      
      // 验证配置格式
      if (!config.ranges || !Array.isArray(config.ranges)) {
        setError('导入的配置格式不正确：缺少 ranges 数组');
        return false;
      }

      // 验证每个地址段
      const validRanges: ManagedAddressRange[] = [];
      for (const range of config.ranges) {
        if (
          typeof range.startAddress === 'number' &&
          typeof range.length === 'number' &&
          range.dataType &&
          ['uint16', 'int16', 'uint32', 'int32', 'float32'].includes(range.dataType)
        ) {
          validRanges.push({
            ...range,
            id: range.id || generateRangeId(),
            enabled: range.enabled ?? true,
          });
        } else {
          console.warn('跳过无效的地址段:', range);
        }
      }

      if (validRanges.length === 0) {
        setError('导入的配置中没有有效的地址段');
        return false;
      }

      setRanges(validRanges);
      saveToStorage(validRanges);
      setError(null);
      return true;
    } catch (err) {
      setError('导入配置失败：JSON 格式错误');
      return false;
    }
  }, [saveToStorage]);

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