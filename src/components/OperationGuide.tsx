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
  ArrowRight
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

  // 获取状态图标
  const getStatusIcon = (status: OperationStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'current':
        return <Circle className="h-4 w-4 text-blue-600 fill-blue-600" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
      case 'blocked':
        return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: OperationStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'current':
        return 'text-blue-600 font-medium';
      case 'pending':
        return 'text-gray-600';
      case 'blocked':
        return 'text-gray-400';
    }
  };

  return (
    <Card className={`border-border/50 bg-background/80 backdrop-blur-sm ${className}`}>
      <CardContent className="p-4">
        {/* 当前步骤提示 */}
        {currentStep && (
          <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">下一步：{currentStep.title}</span>
                  {currentStep.action && (
                    <span className="ml-2 text-sm">→ {currentStep.action}</span>
                  )}
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  步骤 {currentStepIndex + 1}/3
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 操作步骤列表 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-muted-foreground">操作引导</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3 group">
              {/* 步骤图标 */}
              <div className="flex flex-col items-center">
                {getStatusIcon(step.status)}
                {index < steps.length - 1 && (
                  <div className="w-px h-8 bg-border mt-2" />
                )}
              </div>
              
              {/* 步骤内容 */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {step.icon}
                    <span className={`text-sm font-medium ${getStatusColor(step.status)}`}>
                      {step.title}
                    </span>
                  </div>
                  
                  {step.status === 'completed' && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                      已完成
                    </Badge>
                  )}
                  
                  {step.status === 'current' && (
                    <Badge variant="default" className="text-xs">
                      进行中
                    </Badge>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
                
                {step.action && step.status === 'current' && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">{step.action}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 状态总结 */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                连接状态: 
                <span className={connectionResult?.success ? 'text-green-600 ml-1' : 'text-gray-500 ml-1'}>
                  {isConnecting ? '连接中...' : connectionResult?.success ? '已连接' : '未连接'}
                </span>
              </span>
              <span className="text-muted-foreground">
                地址段: 
                <span className={hasEnabledRanges ? 'text-green-600 ml-1' : 'text-gray-500 ml-1'}>
                  {rangesCount} 个{hasEnabledRanges ? '已启用' : '未启用'}
                </span>
              </span>
            </div>
            
            {connectionResult?.success && hasEnabledRanges && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                ✅ 就绪，可以读取数据
              </Badge>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {connectionResult && !connectionResult.success && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              连接失败：{connectionResult.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}