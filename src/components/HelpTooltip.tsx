import React from 'react';
import { HelpCircle, Info, AlertCircle, Lightbulb } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Button } from './ui/button';
import { cn } from '@/utils';

interface HelpTooltipProps {
  content: string;
  title?: string;
  variant?: 'help' | 'info' | 'warning' | 'tip';
  side?: 'top' | 'right' | 'bottom' | 'left';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  triggerAsChild?: boolean;
  children?: React.ReactNode;
  className?: string;
  maxWidth?: number;
}

const variantConfig = {
  help: {
    icon: HelpCircle,
    iconColor: 'text-gray-500 hover:text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900'
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500 hover:text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900'
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-yellow-500 hover:text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900'
  },
  tip: {
    icon: Lightbulb,
    iconColor: 'text-green-500 hover:text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900'
  }
};

const sizeConfig = {
  sm: {
    icon: 'w-3 h-3',
    button: 'p-1'
  },
  md: {
    icon: 'w-4 h-4',
    button: 'p-1.5'
  },
  lg: {
    icon: 'w-5 h-5',
    button: 'p-2'
  }
};

// Tooltip 组件现在从 ui/tooltip 导入

/**
 * 帮助提示组件
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  variant = 'help',
  side = 'top',
  size = 'md',
  showIcon = true,
  triggerAsChild = false,
  children,
  className,
  maxWidth = 300
}) => {
  const config = variantConfig[variant];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const tooltipContent = (
    <div 
      className={cn(
        'p-3 rounded-lg border shadow-lg',
        config.bgColor,
        config.borderColor,
        'max-w-none'
      )}
      style={{ maxWidth: `${maxWidth}px` }}
    >
      {title && (
        <div className={cn('font-semibold mb-1', config.textColor)}>
          {title}
        </div>
      )}
      <div className={cn('text-sm leading-relaxed', config.textColor)}>
        {content}
      </div>
    </div>
  );

  const trigger = triggerAsChild && children ? (
    children
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'transition-colors rounded-full',
        sizes.button,
        className
      )}
      aria-label="显示帮助信息"
    >
      {showIcon && <Icon className={cn(sizes.icon, config.iconColor)} />}
      {!showIcon && children}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild={triggerAsChild || !!children}>
          {trigger}
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * 字段帮助组件 - 用于表单字段旁边的帮助提示
 */
export const FieldHelp: React.FC<{
  content: string;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ content, title, size = 'sm', className }) => {
  return (
    <HelpTooltip
      content={content}
      title={title}
      variant="help"
      size={size}
      side="right"
      className={cn('ml-1', className)}
    />
  );
};

/**
 * 行内帮助文本组件
 */
export const InlineHelp: React.FC<{
  content: string;
  variant?: 'info' | 'warning' | 'tip';
  className?: string;
}> = ({ content, variant = 'info', className }) => {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-start gap-2 p-3 rounded-lg border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconColor)} />
      <div className={cn('text-sm', config.textColor)}>
        {content}
      </div>
    </div>
  );
};

/**
 * 快速帮助组件 - 包含常用的帮助信息
 */
export const QuickHelp = {
  /**
   * IP地址输入帮助
   */
  ipAddress: () => (
    <FieldHelp
      title="IP地址格式"
      content="请输入有效的IPv4地址，例如：192.168.1.199。确保设备与本机在同一网络中，或网络可达。"
    />
  ),

  /**
   * 端口号输入帮助
   */
  port: () => (
    <FieldHelp
      title="端口号"
      content="Modbus TCP默认端口为502。如果设备使用其他端口，请输入正确的端口号（1-65535）。"
    />
  ),

  /**
   * Modbus地址帮助
   */
  modbusAddress: () => (
    <FieldHelp
      title="Modbus地址"
      content="输入要读取的寄存器地址。地址范围通常为0-65535，具体范围请参考设备手册。"
    />
  ),

  /**
   * 采集间隔帮助
   */
  collectionInterval: () => (
    <FieldHelp
      title="采集间隔"
      content="设置数据采集的时间间隔，单位为秒。间隔过短可能导致设备响应不及时，建议根据设备性能设置合适的间隔。"
    />
  ),

  /**
   * 数据类型帮助
   */
  dataType: () => (
    <FieldHelp
      title="数据类型"
      content="选择寄存器中数据的类型。不同类型影响数据的读取和解析方式。请根据设备文档选择正确的数据类型。"
    />
  )
};

/**
 * 操作指南组件
 */
export const OperationGuide: React.FC<{
  title: string;
  steps: string[];
  tips?: string[];
  className?: string;
}> = ({ title, steps, tips, className }) => {
  return (
    <div className={cn('bg-blue-50 border border-blue-200 rounded-lg p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">{title}</h3>
      </div>
      
      <div className="space-y-3">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="bg-blue-200 text-blue-800 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="text-sm text-blue-900">{step}</span>
            </div>
          ))}
        </div>
        
        {tips && tips.length > 0 && (
          <div className="border-t border-blue-200 pt-3">
            <div className="flex items-center gap-1 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">提示</span>
            </div>
            <ul className="space-y-1">
              {tips.map((tip, index) => (
                <li key={index} className="text-xs text-blue-800 flex items-start gap-1">
                  <span className="text-blue-400">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};