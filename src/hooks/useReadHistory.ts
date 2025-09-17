import { useState, useCallback, useMemo } from 'react';
import { BatchReadResult, DisplayFormat } from '../types/modbus';

export interface ReadHistoryEntry {
  id: string;
  timestamp: string;
  result: BatchReadResult;
  connectionConfig: {
    ip: string;
    port: number;
  };
  displayFormat: DisplayFormat;
  success: boolean;
  summary: string;
}

export interface ReadHistoryStats {
  totalReads: number;
  successfulReads: number;
  failedReads: number;
  successRate: number;
  totalAddresses: number;
  averageDuration: number;
}

interface UseReadHistoryReturn {
  history: ReadHistoryEntry[];
  stats: ReadHistoryStats;
  addEntry: (
    result: BatchReadResult,
    connectionConfig: { ip: string; port: number },
    displayFormat: DisplayFormat
  ) => void;
  clearHistory: () => void;
  getEntry: (id: string) => ReadHistoryEntry | undefined;
  removeEntry: (id: string) => void;
  exportHistory: () => string;
  importHistory: (jsonData: string) => boolean;
  isLoading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'modbus_read_history';
const MAX_HISTORY_ENTRIES = 100; // 最大保存条目数

/**
 * 读取历史管理 Hook
 * 提供读取历史的存储、查询、统计等功能
 */
export const useReadHistory = (): UseReadHistoryReturn => {
  const [history, setHistory] = useState<ReadHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从localStorage加载历史记录
  const loadHistory = useCallback(() => {
    setIsLoading(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // 按时间倒序排列，最新的在前面
          const sortedHistory = parsed.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setHistory(sortedHistory);
        }
      }
      setError(null);
    } catch (err) {
      console.error('加载读取历史失败:', err);
      setError('加载历史记录失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存历史记录到localStorage
  const saveHistory = useCallback((newHistory: ReadHistoryEntry[]) => {
    try {
      // 限制历史记录数量
      const limitedHistory = newHistory.slice(0, MAX_HISTORY_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
      setError(null);
    } catch (err) {
      console.error('保存读取历史失败:', err);
      setError('保存历史记录失败');
    }
  }, []);

  // 生成读取摘要
  const generateSummary = useCallback((result: BatchReadResult): string => {
    if (result.success_count === 0) {
      return `所有 ${result.total_count} 个地址读取失败`;
    } else if (result.failed_count === 0) {
      return `成功读取全部 ${result.total_count} 个地址`;
    } else {
      return `成功 ${result.success_count}/${result.total_count}，失败 ${result.failed_count}`;
    }
  }, []);

  // 添加历史记录条目
  const addEntry = useCallback((
    result: BatchReadResult,
    connectionConfig: { ip: string; port: number },
    displayFormat: DisplayFormat
  ) => {
    const entry: ReadHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      result,
      connectionConfig,
      displayFormat,
      success: result.success_count > 0,
      summary: generateSummary(result)
    };

    setHistory(prev => {
      const newHistory = [entry, ...prev]; // 新记录添加到开头
      saveHistory(newHistory);
      return newHistory;
    });
  }, [generateSummary, saveHistory]);

  // 清空历史记录
  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, [saveHistory]);

  // 获取指定条目
  const getEntry = useCallback((id: string): ReadHistoryEntry | undefined => {
    return history.find(entry => entry.id === id);
  }, [history]);

  // 删除指定条目
  const removeEntry = useCallback((id: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(entry => entry.id !== id);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // 导出历史记录
  const exportHistory = useCallback((): string => {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      entries: history,
      stats: stats
    };
    return JSON.stringify(exportData, null, 2);
  }, [history]);

  // 导入历史记录
  const importHistory = useCallback((jsonData: string): boolean => {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.entries || !Array.isArray(importData.entries)) {
        setError('导入数据格式不正确：缺少 entries 数组');
        return false;
      }

      // 验证每个条目的基本结构
      const validEntries: ReadHistoryEntry[] = [];
      for (const entry of importData.entries) {
        if (
          typeof entry.id === 'string' &&
          typeof entry.timestamp === 'string' &&
          entry.result &&
          entry.connectionConfig &&
          typeof entry.success === 'boolean'
        ) {
          validEntries.push({
            ...entry,
            summary: entry.summary || generateSummary(entry.result)
          });
        } else {
          console.warn('跳过无效的历史记录条目:', entry);
        }
      }

      if (validEntries.length === 0) {
        setError('导入数据中没有有效的历史记录');
        return false;
      }

      // 按时间排序并限制数量
      const sortedEntries = validEntries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, MAX_HISTORY_ENTRIES);

      setHistory(sortedEntries);
      saveHistory(sortedEntries);
      setError(null);
      return true;
    } catch (err) {
      setError('导入失败：JSON 格式错误');
      return false;
    }
  }, [generateSummary, saveHistory]);

  // 计算统计信息
  const stats: ReadHistoryStats = useMemo(() => {
    const totalReads = history.length;
    const successfulReads = history.filter(entry => entry.success).length;
    const failedReads = totalReads - successfulReads;
    const successRate = totalReads > 0 ? (successfulReads / totalReads) * 100 : 0;
    
    const totalAddresses = history.reduce(
      (sum, entry) => sum + entry.result.total_count, 0
    );
    
    const totalDuration = history.reduce(
      (sum, entry) => sum + entry.result.duration_ms, 0
    );
    const averageDuration = totalReads > 0 ? totalDuration / totalReads : 0;

    return {
      totalReads,
      successfulReads,
      failedReads,
      successRate,
      totalAddresses,
      averageDuration
    };
  }, [history]);

  // 组件挂载时加载历史记录
  useState(() => {
    loadHistory();
  });

  return {
    history,
    stats,
    addEntry,
    clearHistory,
    getEntry,
    removeEntry,
    exportHistory,
    importHistory,
    isLoading,
    error
  };
};