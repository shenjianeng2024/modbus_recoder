import React from 'react';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { Card, CardContent, CardHeader } from './ui/card';
import { LoadingSpinner } from './LoadingSpinner';

interface ProgressIndicatorProps {
  value: number;
  max?: number;
  label?: string;
  description?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 进度指示器组件
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value,
  max = 100,
  label,
  description,
  showPercentage = true,
  variant = 'default',
  size = 'md'
}) => {
  const percentage = Math.round((value / max) * 100);
  

  const getSize = () => {
    switch (size) {
      case 'sm':
        return 'h-2';
      case 'lg':
        return 'h-4';
      default:
        return 'h-3';
    }
  };

  return (
    <div className="w-full space-y-2">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center">
          {label && (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-500">{percentage}%</span>
          )}
        </div>
      )}
      
      <Progress 
        value={percentage} 
        className={`w-full ${getSize()}`}
        // 应用自定义颜色样式
        style={{
          '--progress-foreground': variant === 'success' ? 'hsl(142, 76%, 36%)' :
                                  variant === 'warning' ? 'hsl(43, 89%, 38%)' :
                                  variant === 'error' ? 'hsl(0, 84%, 60%)' :
                                  'hsl(221, 83%, 53%)'
        } as React.CSSProperties}
      />
      
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
};

/**
 * 表格加载骨架屏
 */
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="space-y-3">
      {/* 表头 */}
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={`cell-${rowIndex}-${colIndex}`} 
              className="h-4 flex-1" 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * 卡片加载骨架屏
 */
export const CardSkeleton: React.FC<{
  showAvatar?: boolean;
  showActions?: boolean;
  lines?: number;
}> = ({ showAvatar = false, showActions = true, lines = 3 }) => {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full" />}
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
        
        {showActions && (
          <div className="flex gap-2 pt-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 列表加载骨架屏
 */
export const ListSkeleton: React.FC<{
  items?: number;
  showAvatar?: boolean;
}> = ({ items = 5, showAvatar = true }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
};

/**
 * 连接状态加载组件
 */
export const ConnectionLoadingState: React.FC<{
  stage: 'connecting' | 'authenticating' | 'established' | 'failed';
  deviceInfo?: string;
}> = ({ stage, deviceInfo }) => {
  const getStageInfo = () => {
    switch (stage) {
      case 'connecting':
        return { text: '正在连接设备...', progress: 25 };
      case 'authenticating':
        return { text: '正在验证连接...', progress: 50 };
      case 'established':
        return { text: '连接已建立', progress: 100, variant: 'success' as const };
      case 'failed':
        return { text: '连接失败', progress: 0, variant: 'error' as const };
      default:
        return { text: '准备连接...', progress: 0 };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <div>
              <p className="font-medium">{stageInfo.text}</p>
              {deviceInfo && (
                <p className="text-sm text-gray-500">{deviceInfo}</p>
              )}
            </div>
          </div>
          
          <ProgressIndicator
            value={stageInfo.progress}
            variant={stageInfo.variant}
            showPercentage={false}
          />
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * 数据采集加载状态组件
 */
export const DataCollectionLoadingState: React.FC<{
  totalAddresses: number;
  processedAddresses: number;
  currentAddress?: number;
  estimatedTimeRemaining?: number;
}> = ({ totalAddresses, processedAddresses, currentAddress, estimatedTimeRemaining }) => {
  const progress = (processedAddresses / totalAddresses) * 100;

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${Math.round(remainingSeconds)}秒`;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" />
              <div>
                <p className="font-medium">正在采集数据</p>
                <p className="text-sm text-gray-500">
                  已处理 {processedAddresses} / {totalAddresses} 个地址
                </p>
              </div>
            </div>
            
            {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
              <div className="text-right text-sm text-gray-500">
                <p>预计剩余时间</p>
                <p className="font-medium">{formatTimeRemaining(estimatedTimeRemaining)}</p>
              </div>
            )}
          </div>
          
          <ProgressIndicator
            value={progress}
            label={`采集进度 ${currentAddress ? `(当前地址: ${currentAddress})` : ''}`}
            showPercentage={true}
          />
        </div>
      </CardContent>
    </Card>
  );
};