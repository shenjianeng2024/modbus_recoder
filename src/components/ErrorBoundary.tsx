import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { ErrorBoundaryState } from '../types/errors';
import { ErrorHandler } from '../utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  errorId: string;
  onRetry: () => void;
  onReset: () => void;
}

/**
 * 默认错误回退界面组件
 */
const DefaultErrorFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  errorId,
  onRetry,
  onReset
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  
  const handleReportError = () => {
    // 在实际应用中，这里可以发送错误报告到服务器
    const errorData = {
      errorId,
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    console.log('错误报告数据:', errorData);
    
    // 可以集成错误报告服务，如 Sentry
    // Sentry.captureException(error, { extra: errorData });
    
    alert('错误报告已生成，请联系技术支持');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-red-600">
            应用发生异常
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            很抱歉，应用遇到了意外错误。您可以尝试刷新页面或重置应用状态。
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">错误详情</div>
              <div className="text-sm text-gray-600 mb-2">
                错误ID: <code className="bg-gray-100 px-1 rounded">{errorId}</code>
              </div>
              <div className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded border">
                {error.message}
              </div>
            </AlertDescription>
          </Alert>
          
          {showDetails && error.stack && (
            <Alert>
              <AlertDescription>
                <div className="font-medium mb-2">技术详情</div>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                  {error.stack}
                </pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3">
          <div className="flex gap-2 w-full">
            <Button
              onClick={onRetry}
              className="flex-1"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </Button>
            <Button
              onClick={onReset}
              variant="outline"
              className="flex-1"
              size="sm"
            >
              <Home className="w-4 h-4 mr-2" />
              重置应用
            </Button>
          </div>
          
          <div className="flex gap-2 w-full">
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              {showDetails ? '隐藏' : '显示'}技术详情
            </Button>
            <Button
              onClick={handleReportError}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              <Bug className="w-4 h-4 mr-2" />
              报告错误
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

/**
 * React 错误边界组件
 * 捕获子组件中的 JavaScript 错误，显示友好的错误界面
 */
export class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  private errorHandler: ErrorHandler;
  
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
    
    this.errorHandler = ErrorHandler.getInstance();
  }
  
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 更新 state 使得下一次渲染能够显示降级后的 UI
    const errorId = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    this.setState({
      errorInfo
    });
    
    // 调用自定义错误处理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // 使用全局错误处理器处理错误
    this.errorHandler.handleNativeError(error, {
      component: 'ErrorBoundary',
      errorInfo,
      errorId: this.state.errorId
    });
    
    // 在开发环境下输出详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 ErrorBoundary 捕获到错误');
      console.error('错误:', error);
      console.error('组件堆栈:', errorInfo.componentStack);
      console.groupEnd();
    }
  }
  
  /**
   * 重试操作 - 重新渲染子组件
   */
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };
  
  /**
   * 重置操作 - 刷新整个页面
   */
  private handleReset = () => {
    window.location.reload();
  };
  
  render() {
    if (this.state.hasError && this.state.error && this.state.errorId) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
        />
      );
    }
    
    return this.props.children;
  }
}

/**
 * 简化的错误边界 Hook
 * 用于函数组件中处理错误边界
 */
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);
  
  const resetError = React.useCallback(() => {
    setError(null);
  }, []);
  
  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);
  
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);
  
  return {
    captureError,
    resetError
  };
};

/**
 * 错误边界高阶组件
 * 为任何组件添加错误边界保护
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};