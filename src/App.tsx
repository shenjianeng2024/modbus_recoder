import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ConnectionConfig } from './components/ConnectionConfig';
import { AddressRangeManager } from './components/AddressRangeManager';
import { DataReader } from './components/DataReader';
import { BatchCollection } from './components/BatchCollection';
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              />
            </CardContent>
          </Card>

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

        <Card className="border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] hover:border-purple-400/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                功能状态
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                欢迎使用 Modbus Reader！这是一个专为实验室环境设计的 Modbus TCP/IP 数据采集工具。
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-105">
                  <div className="text-2xl mb-1">📍</div>
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">地址管理</div>
                  <div className="text-xs text-green-600 font-medium">✅ 已启用</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 hover:scale-105">
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">单次读取</div>
                  <div className="text-xs text-green-600 font-medium">✅ 已启用</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-center transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105">
                  <div className="text-2xl mb-1">📈</div>
                  <div className="text-sm font-medium text-purple-700 dark:text-purple-300">批量采集</div>
                  <div className="text-xs text-green-600 font-medium">✅ 已启用</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105">
                  <div className="text-2xl mb-1">💾</div>
                  <div className="text-sm font-medium text-orange-700 dark:text-orange-300">CSV 导出</div>
                  <div className="text-xs text-green-600 font-medium">✅ 已启用</div>
                </div>
              </div>
              {!connectionResult?.success && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-amber-600 dark:text-amber-400 text-xl mt-0.5">💡</div>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">使用提示</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        读取功能需要先成功连接到设备才能使用
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {connectionResult?.success && ranges.length === 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600 dark:text-blue-400 text-xl mt-0.5">💡</div>
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">配置提示</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        批量采集需要先在地址管理中添加并启用地址范围
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AppWithAddressRange;