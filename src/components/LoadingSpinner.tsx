import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  fullscreen?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

/**
 * 加载旋转器组件
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  text,
  fullscreen = false
}) => {
  const spinner = (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className={cn("animate-spin text-blue-600", sizeClasses[size])} />
        {text && (
          <p className="text-sm text-gray-600 animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * 内联加载组件
 */
export const InlineLoader: React.FC<{
  text?: string;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ text = '加载中...', size = 'sm', className }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-blue-600", sizeClasses[size])} />
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  );
};

/**
 * 按钮加载状态组件
 */
export const ButtonLoader: React.FC<{
  size?: 'sm' | 'md';
  className?: string;
}> = ({ size = 'sm', className }) => {
  return (
    <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
  );
};