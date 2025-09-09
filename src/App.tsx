import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConnectionConfig } from './components/ConnectionConfig';
import { AddressRangeManager } from './components/AddressRangeManager';
import { DataReader } from './components/DataReader';
import { BatchCollection } from './components/BatchCollection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectionConfig as ConnectionConfigType, ConnectionResult } from './types/modbus';
import { useAddressRanges } from './hooks/useAddressRanges';
import { AddressRangeProvider, useAddressRangeContext } from './contexts/AddressRangeContext';

// UX 组件导入
import { useErrorHandler } from './hooks/useErrorHandler';
import { useAppShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorType } from './types/errors';
import { notifications } from './utils/notifications';

// 地址段管理的包装组件
function AppWithAddressRange() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 处理地址段变化的回调
  const handleRangesChange = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 使用地址范围管理 Hook
  const { ranges } = useAddressRanges({ onRangesChange: handleRangesChange });

  return (
    <AddressRangeProvider ranges={ranges}>
      <AppContent key={refreshKey} />
    </AddressRangeProvider>
  );
}

function AppContent() {
  const [config, setConnectionConfig] = useState<ConnectionConfigType>({
    ip: '192.168.1.199',
    port: 502,
  });
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 使用地址范围 context
  const { ranges } = useAddressRangeContext();

  // 使用错误处理 Hook
  const { handleError, clearAllErrors } = useErrorHandler({
    showNotifications: true,
    maxErrors: 5,
    autoRetry: false
  });

  const handleConfigChange = (newConfig: ConnectionConfigType) => {
    setConnectionConfig(newConfig);
    // 清除之前的连接结果
    setConnectionResult(null);
  };

  const handleTestConnection = async (config: ConnectionConfigType) => {
    setIsLoading(true);
    clearAllErrors();
    
    try {
      // 显示加载通知
      const loadingToastId = notifications.loading('正在连接设备...', `连接到 ${config.ip}:${config.port}`);
      
      const result = await invoke<ConnectionResult>('test_connection', { config });
      setConnectionResult(result);
      
      // 关闭加载通知并显示结果
      notifications.dismiss(loadingToastId);
      
      if (result.success) {
        notifications.success('连接成功', result.message);
      } else {
        notifications.error('连接失败', result.message);
        handleError(
          new Error(result.message),
          { config, operation: 'test_connection' }
        );
      }
    } catch (error) {
      const errorMessage = `连接失败: ${error}`;
      setConnectionResult({
        success: false,
        message: errorMessage,
      });
      
      handleError(error, { 
        config, 
        operation: 'test_connection',
        errorType: ErrorType.NETWORK_ERROR 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 设置键盘快捷键
  useAppShortcuts({
    onSave: () => {
      notifications.info('保存配置', '配置已保存到本地');
    },
    onConnect: () => {
      if (!isLoading && config) {
        handleTestConnection(config);
      }
    },
    onRefresh: () => {
      window.location.reload();
    },
    onHelp: () => {
      notifications.info('键盘快捷键', 'Ctrl+S: 保存配置, Ctrl+Enter: 连接设备, F5: 刷新页面');
    }
  });

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8">Modbus Reader</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>连接配置</CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectionConfig
                onConfigChange={handleConfigChange}
                onTestConnection={handleTestConnection}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>连接状态</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>测试连接中...</p>
              ) : connectionResult ? (
                <div className={`p-4 rounded-lg ${
                  connectionResult.success 
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}>
                  <p className="font-medium">
                    {connectionResult.success ? '✅ 连接成功' : '❌ 连接失败'}
                  </p>
                  <p className="text-sm mt-2">{connectionResult.message}</p>
                </div>
              ) : (
                <p className="text-gray-500">点击"测试连接"检查设备连接状态</p>
              )}
            </CardContent>
          </Card>
        </div>

        <AddressRangeManager />

        {/* 数据读取功能 - 单次读取所有配置的地址段 */}
        <DataReader 
          connectionConfig={config} 
          disabled={!connectionResult?.success} 
        />

        {/* 批量采集功能 */}
        <BatchCollection 
          disabled={!connectionResult?.success} 
        />

        <Card>
          <CardHeader>
            <CardTitle>功能状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                欢迎使用 Modbus Reader！这是一个专为实验室环境设计的 Modbus TCP/IP 数据采集工具。
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  📍 地址管理 ✅
                </Button>
                <Button variant="outline">
                  📊 单次数据读取 ✅
                </Button>
                <Button variant="outline">
                  📈 批量采集 ✅
                </Button>
                <Button variant="outline">
                  💾 CSV 导出 ✅
                </Button>
              </div>
              {!connectionResult?.success && (
                <p className="text-sm text-amber-600">
                  💡 提示：读取功能需要先成功连接到设备才能使用
                </p>
              )}
              {connectionResult?.success && ranges.length === 0 && (
                <p className="text-sm text-blue-600">
                  💡 提示：批量采集需要先在地址管理中添加并启用地址范围
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export default AppWithAddressRange;