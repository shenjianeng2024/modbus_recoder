import React from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  Activity,
  Pause,
  Play,
  Square
} from 'lucide-react';
import { cn } from '@/utils';
import { Badge } from './ui/badge';

export type StatusType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'pending' 
  | 'idle'
  | 'active'
  | 'inactive';

export type ConnectionStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'connecting' 
  | 'error';

export type CollectionStatus = 
  | 'idle'
  | 'running' 
  | 'paused' 
  | 'stopped' 
  | 'error'
  | 'completed';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showPulse?: boolean;
  className?: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    badgeVariant: 'default' as const
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
    badgeVariant: 'destructive' as const
  },
  warning: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    dotColor: 'bg-yellow-500',
    badgeVariant: 'secondary' as const
  },
  info: {
    icon: AlertCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
    badgeVariant: 'secondary' as const
  },
  pending: {
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-500',
    badgeVariant: 'outline' as const
  },
  idle: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400',
    badgeVariant: 'outline' as const
  },
  active: {
    icon: Activity,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    badgeVariant: 'default' as const
  },
  inactive: {
    icon: Pause,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400',
    badgeVariant: 'outline' as const
  }
};

const sizeConfig = {
  sm: {
    icon: 'w-3 h-3',
    dot: 'w-2 h-2',
    text: 'text-xs',
    badge: 'text-xs px-1.5 py-0.5'
  },
  md: {
    icon: 'w-4 h-4',
    dot: 'w-3 h-3',
    text: 'text-sm',
    badge: 'text-sm px-2 py-1'
  },
  lg: {
    icon: 'w-5 h-5',
    dot: 'w-4 h-4',
    text: 'text-base',
    badge: 'text-base px-3 py-1.5'
  }
};

/**
 * 通用状态指示器组件
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  showPulse = false,
  className
}) => {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  if (label) {
    return (
      <Badge
        variant={config.badgeVariant}
        className={cn(
          'flex items-center gap-1.5',
          sizes.badge,
          config.bgColor,
          config.color,
          className
        )}
      >
        {showIcon && (
          <Icon className={cn(sizes.icon, showPulse && 'animate-pulse')} />
        )}
        {label}
      </Badge>
    );
  }

  return (
    <div 
      className={cn(
        'flex items-center gap-2',
        className
      )}
      aria-label={`状态: ${status}`}
    >
      <div 
        className={cn(
          'rounded-full flex items-center justify-center',
          config.bgColor,
          config.borderColor,
          'border',
          showPulse && 'animate-pulse'
        )}
        style={{ 
          width: size === 'sm' ? '20px' : size === 'md' ? '24px' : '28px',
          height: size === 'sm' ? '20px' : size === 'md' ? '24px' : '28px'
        }}
      >
        {showIcon ? (
          <Icon className={cn(sizes.icon, config.color)} />
        ) : (
          <div className={cn('rounded-full', sizes.dot, config.dotColor)} />
        )}
      </div>
    </div>
  );
};

/**
 * 连接状态指示器
 */
export const ConnectionStatusIndicator: React.FC<{
  status: ConnectionStatus;
  deviceInfo?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}> = ({ status, deviceInfo, size = 'md', showLabel = true, className }) => {
  const getStatusProps = (): { 
    status: StatusType; 
    label: string; 
    icon: React.ComponentType<any>;
    showPulse: boolean;
  } => {
    switch (status) {
      case 'connected':
        return {
          status: 'success',
          label: showLabel ? (deviceInfo ? `已连接 (${deviceInfo})` : '已连接') : '',
          icon: Wifi,
          showPulse: false
        };
      case 'disconnected':
        return {
          status: 'inactive',
          label: showLabel ? '未连接' : '',
          icon: WifiOff,
          showPulse: false
        };
      case 'connecting':
        return {
          status: 'pending',
          label: showLabel ? '连接中...' : '',
          icon: Wifi,
          showPulse: true
        };
      case 'error':
        return {
          status: 'error',
          label: showLabel ? '连接错误' : '',
          icon: WifiOff,
          showPulse: false
        };
    }
  };

  const props = getStatusProps();

  return (
    <StatusIndicator
      status={props.status}
      label={props.label}
      size={size}
      showPulse={props.showPulse}
      className={className}
    />
  );
};

/**
 * 数据采集状态指示器
 */
export const CollectionStatusIndicator: React.FC<{
  status: CollectionStatus;
  progress?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}> = ({ status, progress, size = 'md', showLabel = true, className }) => {
  const getStatusProps = (): { 
    status: StatusType; 
    label: string; 
    icon: React.ComponentType<any>;
    showPulse: boolean;
  } => {
    switch (status) {
      case 'idle':
        return {
          status: 'idle',
          label: showLabel ? '待机' : '',
          icon: Square,
          showPulse: false
        };
      case 'running':
        return {
          status: 'active',
          label: showLabel ? 
            (progress !== undefined ? `采集中 (${Math.round(progress)}%)` : '采集中...') : '',
          icon: Play,
          showPulse: true
        };
      case 'paused':
        return {
          status: 'warning',
          label: showLabel ? '已暂停' : '',
          icon: Pause,
          showPulse: false
        };
      case 'stopped':
        return {
          status: 'inactive',
          label: showLabel ? '已停止' : '',
          icon: Square,
          showPulse: false
        };
      case 'completed':
        return {
          status: 'success',
          label: showLabel ? '采集完成' : '',
          icon: CheckCircle,
          showPulse: false
        };
      case 'error':
        return {
          status: 'error',
          label: showLabel ? '采集错误' : '',
          icon: XCircle,
          showPulse: false
        };
    }
  };

  const props = getStatusProps();

  return (
    <StatusIndicator
      status={props.status}
      label={props.label}
      size={size}
      showPulse={props.showPulse}
      className={className}
    />
  );
};

/**
 * 状态点指示器（不带文字，只显示颜色点）
 */
export const StatusDot: React.FC<{
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}> = ({ status, size = 'md', showPulse = false, className }) => {
  const config = statusConfig[status];
  const sizeClass = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }[size];

  return (
    <div
      className={cn(
        'rounded-full',
        config.dotColor,
        sizeClass,
        showPulse && 'animate-pulse',
        className
      )}
      aria-label={`状态: ${status}`}
    />
  );
};

/**
 * 状态文本组件（只显示文字状态）
 */
export const StatusText: React.FC<{
  status: StatusType;
  text: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ status, text, size = 'md', className }) => {
  const config = statusConfig[status];
  const sizeClass = sizeConfig[size].text;

  return (
    <span 
      className={cn(
        config.color,
        sizeClass,
        'font-medium',
        className
      )}
    >
      {text}
    </span>
  );
};