import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Circle, 
  Wifi, 
  Settings, 
  Play, 
  AlertTriangle,
  Info,
  ArrowRight,
  ChevronRight,
  Zap
} from 'lucide-react';
import { ConnectionResult } from '@/types/modbus';

interface OperationGuideProps {
  connectionResult: ConnectionResult | null;
  isConnecting: boolean;
  hasEnabledRanges: boolean;
  rangesCount: number;
  className?: string;
}

type OperationStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending' | 'blocked';
  action?: string;
};

export function OperationGuide({ 
  connectionResult, 
  isConnecting, 
  hasEnabledRanges, 
  rangesCount, 
  className = '' 
}: OperationGuideProps) {
  // 根据当前状态计算操作步骤
  const getSteps = (): OperationStep[] => {
    const isConnected = connectionResult?.success === true;
    
    return [
      {
        id: 'connect',
        title: '连接设备',
        description: '配置IP地址和端口，测试与Modbus设备的连接',
        icon: <Wifi className="h-4 w-4" />,
        status: isConnecting 
          ? 'current' 
          : isConnected 
            ? 'completed' 
            : 'pending',
        action: isConnected ? undefined : '点击"测试连接"按钮'
      },
      {
        id: 'configure',
        title: '配置地址段',
        description: '在地址范围管理中添加并启用需要读取的地址段',
        icon: <Settings className="h-4 w-4" />,
        status: !isConnected 
          ? 'blocked'
          : hasEnabledRanges 
            ? 'completed' 
            : 'current',
        action: hasEnabledRanges ? undefined : '添加并启用地址段'
      },
      {
        id: 'read',
        title: '读取数据',
        description: '执行数据读取操作，查看实时数据',
        icon: <Play className="h-4 w-4" />,
        status: !isConnected || !hasEnabledRanges 
          ? 'blocked' 
          : 'current',
        action: (isConnected && hasEnabledRanges) ? '点击"立即读取"按钮' : undefined
      }
    ];
  };

  const steps = getSteps();
  const currentStepIndex = steps.findIndex(step => step.status === 'current');
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;

  // 获取状态图标 - 更丰富的视觉反馈
  const getStatusIcon = (status: OperationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'current':
        return <Circle className="h-5 w-5 text-blue-600 fill-blue-600 animate-pulse" />;
      case 'pending':
        return <Circle className="h-5 w-5 text-gray-400" />;
      case 'blocked':
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  // 获取状态颜色 - 增强视觉层次
  const getStatusColor = (status: OperationStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 dark:text-green-400';
      case 'current':
        return 'text-blue-700 dark:text-blue-300 font-bold';
      case 'pending':
        return 'text-gray-600 dark:text-gray-400';
      case 'blocked':
        return 'text-gray-400 dark:text-gray-600';
    }
  };

  return (
    <Card className={`border-2 border-gradient-to-r from-purple-200 to-blue-200 dark:from-purple-800 dark:to-blue-800 bg-gradient-to-r from-purple-50/50 via-blue-50/50 to-purple-50/50 dark:from-purple-950/50 dark:via-blue-950/50 dark:to-purple-950/50 backdrop-blur-sm shadow-lg ${className}`}>
      <CardContent className="p-6">
        {/* 主标题区域 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              快速上手指南
            </h2>
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <p className="text-sm text-muted-foreground">
            按照以下步骤完成设备连接和数据读取
          </p>
        </div>

        {/* 当前步骤提示 - 更突出的设计 */}
        {currentStep && (
          <Alert className="mb-6 border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 shadow-md">
            <div className="flex items-center gap-2">
              <div className="animate-pulse">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <AlertDescription className="text-blue-900 dark:text-blue-100 ml-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">当前步骤：{currentStep.title}</span>
                    <Badge variant="default" className="bg-blue-600 text-white font-medium">
                      {currentStepIndex + 1}/3
                    </Badge>
                  </div>
                  {currentStep.action && (
                    <div className="flex items-center gap-2 mt-1">
                      <ChevronRight className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
                        {currentStep.action}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 操作步骤列表 - 更清晰的视觉设计 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent flex-1" />
            <span className="text-lg font-bold text-purple-700 dark:text-purple-300 px-4 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
              操作步骤
            </span>
            <div className="h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent flex-1" />
          </div>
          
          {steps.map((step, index) => (
            <div key={step.id} className={`group transition-all duration-300 ${
              step.status === 'current' ? 'scale-105 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-700 shadow-md' : 'p-2'
            }`}>
              <div className="flex items-start gap-4">
                {/* 步骤图标和连接线 */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-full p-2 transition-all duration-300 ${
                    step.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                    step.status === 'current' ? 'bg-blue-100 dark:bg-blue-900/30 animate-pulse' :
                    step.status === 'pending' ? 'bg-gray-100 dark:bg-gray-800' :
                    'bg-gray-50 dark:bg-gray-900'
                  }`}>
                    {getStatusIcon(step.status)}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-1 h-12 mt-3 rounded-full transition-all duration-300 ${
                      step.status === 'completed' ? 'bg-green-300 dark:bg-green-700' :
                      step.status === 'current' ? 'bg-blue-300 dark:bg-blue-700' :
                      'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
                
                {/* 步骤内容 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {step.icon}
                        <span className={`font-bold text-lg transition-all duration-300 ${
                          step.status === 'current' ? 'text-blue-700 dark:text-blue-300' : getStatusColor(step.status)
                        }`}>
                          {step.title}
                        </span>
                      </div>
                      
                      {step.status === 'completed' && (
                        <Badge variant="outline" className="text-sm text-green-700 border-green-400 bg-green-50 dark:bg-green-950/30 font-medium">
                          ✅ 已完成
                        </Badge>
                      )}
                      
                      {step.status === 'current' && (
                        <Badge variant="default" className="text-sm bg-blue-600 text-white font-medium animate-pulse">
                          🔄 进行中
                        </Badge>
                      )}
                      
                      {step.status === 'blocked' && (
                        <Badge variant="outline" className="text-sm text-gray-500 border-gray-300">
                          🔒 等待中
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      步骤 {index + 1}
                    </div>
                  </div>
                  
                  <p className={`text-sm mb-2 transition-all duration-300 ${
                    step.status === 'current' ? 'text-blue-800 dark:text-blue-200 font-medium' : 'text-muted-foreground'
                  }`}>
                    {step.description}
                  </p>
                  
                  {step.action && step.status === 'current' && (
                    <div className="flex items-center gap-2 mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-l-4 border-blue-500">
                      <ArrowRight className="h-4 w-4 text-blue-600 animate-bounce" />
                      <span className="font-bold text-blue-800 dark:text-blue-200">
                        {step.action}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 状态总结 - 更醒目的设计 */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 rounded-xl border-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  isConnecting ? 'bg-yellow-500' :
                  connectionResult?.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium text-muted-foreground">
                  连接状态: 
                </span>
                <span className={`text-sm font-bold ${
                  connectionResult?.success ? 'text-green-600' : 
                  isConnecting ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {isConnecting ? '连接中...' : connectionResult?.success ? '已连接' : '未连接'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  hasEnabledRanges ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium text-muted-foreground">
                  地址段: 
                </span>
                <span className={`text-sm font-bold ${
                  hasEnabledRanges ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {rangesCount} 个{hasEnabledRanges ? '已启用' : '未启用'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {connectionResult?.success && hasEnabledRanges ? (
                <Badge variant="default" className="bg-green-600 text-white font-bold text-sm px-3 py-1 animate-pulse">
                  ✅ 准备就绪，可以读取数据
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500 border-gray-300 text-sm">
                  ⏳ 等待完成前置步骤
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 错误提示 - 更醒目的错误显示 */}
        {connectionResult && !connectionResult.success && (
          <Alert variant="destructive" className="mt-4 border-2 border-red-300 bg-red-50 dark:bg-red-950/30">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
            <AlertDescription className="text-red-800 dark:text-red-200 font-medium">
              <div className="flex flex-col gap-2">
                <span className="font-bold">❌ 连接失败</span>
                <span className="text-sm">{connectionResult.message}</span>
                <span className="text-xs text-red-600 dark:text-red-400">
                  💡 请检查IP地址和端口是否正确，确保设备在线
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* 成功提示 */}
        {connectionResult && connectionResult.success && (
          <Alert className="mt-4 border-2 border-green-300 bg-green-50 dark:bg-green-950/30">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200 font-medium">
              <div className="flex items-center gap-2">
                <span className="font-bold">🎉 连接成功！</span>
                <span className="text-sm">现在可以配置地址段并读取数据了</span>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}