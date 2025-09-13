import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConnectionConfig } from './components/ConnectionConfig';
import { AddressRangeManager } from './components/AddressRangeManager';
import { DataReader } from './components/DataReader';
import { BatchCollection } from './components/BatchCollection';
import { OperationGuide } from './components/OperationGuide';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectionConfig as ConnectionConfigType, ConnectionResult } from './types/modbus';
import { AddressRangeProvider, useAddressRangeContext } from './contexts/AddressRangeContext';

// UX 组件导入
import { useErrorHandler } from './hooks/useErrorHandler';
import { useAppShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorType } from './types/errors';
import { notifications } from './utils/notifications';


// 地址段管理的包装组件
function AppWithAddressRange() {
  return (
    <AddressRangeProvider>
      <AppContent />
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
      <div className="relative min-h-screen bg-background">
          
        <div className="container mx-auto p-4 space-y-6 relative z-10">
          {/* 标题区域 */}
          <div className="text-center py-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
              Modbus Reader
            </h1>
            <p className="text-muted-foreground text-lg">专业的 Modbus TCP/IP 数据采集工具</p>
          </div>
        
        {/* 操作引导 - 提升到顶部位置 */}
        <OperationGuide
          connectionResult={connectionResult}
          isConnecting={isLoading}
          hasEnabledRanges={ranges.filter(range => range.enabled !== false).length > 0}
          rangesCount={ranges.filter(range => range.enabled !== false).length}
          className="mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] hover:border-purple-400/50"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 连接配置 */}
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] hover:border-blue-400/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  连接配置
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConnectionConfig
                onConfigChange={handleConfigChange}
                onTestConnection={handleTestConnection}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* 连接状态 */}
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02] hover:border-green-400/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  连接状态
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-muted-foreground">测试连接中...</span>
                </div>
              ) : connectionResult ? (
                <div className={`p-6 rounded-lg border-2 ${
                  connectionResult.success 
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`text-2xl ${
                      connectionResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {connectionResult.success ? '✅' : '❌'}
                    </div>
                    <p className="font-semibold text-lg">
                      {connectionResult.success ? '连接成功' : '连接失败'}
                    </p>
                  </div>
                  <p className="text-sm mt-2 text-muted-foreground">{connectionResult.message}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔌</div>
                  <p className="text-muted-foreground">点击"测试连接"检查设备连接状态</p>
                </div>
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

        {/* 应用信息卡片 - 简化版本 */}
        <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                欢迎使用 Modbus Reader！专为实验室环境设计的 Modbus TCP/IP 数据采集工具。
              </p>
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✅</span>
                  地址管理
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✅</span>
                  单次读取
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✅</span>
                  批量采集
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✅</span>
                  CSV 导出
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AppWithAddressRange;