import { useState, useCallback, useEffect, useRef } from 'react';
import { AppError, ErrorType, ErrorSeverity, RecoveryAction } from '../types/errors';
import { ErrorHandler, createAppError, convertNativeError, retryWithBackoff } from '../utils/errorHandler';
import { notifications } from '../utils/notifications';

/**
 * 错误处理状态
 */
interface ErrorHandlerState {
  errors: AppError[];
  hasActiveErrors: boolean;
  lastError: AppError | null;
}

/**
 * 错误处理选项
 */
interface ErrorHandlerOptions {
  showNotifications?: boolean;
  maxErrors?: number;
  autoRetry?: boolean;
  autoRetryConfig?: {
    maxAttempts: number;
    baseDelay: number;
  };
}

/**
 * 错误处理 Hook
 */
export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const {
    showNotifications = true,
    maxErrors = 10,
    autoRetry = false,
    autoRetryConfig = { maxAttempts: 3, baseDelay: 1000 }
  } = options;

  const [state, setState] = useState<ErrorHandlerState>({
    errors: [],
    hasActiveErrors: false,
    lastError: null
  });

  const errorHandlerRef = useRef<ErrorHandler>();
  const retryTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 初始化错误处理器
  useEffect(() => {
    errorHandlerRef.current = ErrorHandler.getInstance();
    
    const handleError = (error: AppError) => {
      setState(prev => {
        const newErrors = [...prev.errors, error];
        
        // 限制错误数量
        if (newErrors.length > maxErrors) {
          newErrors.splice(0, newErrors.length - maxErrors);
        }
        
        return {
          errors: newErrors,
          hasActiveErrors: true,
          lastError: error
        };
      });
      
      // 显示通知
      if (showNotifications) {
        notifications.showError(error);
      }
      
      // 自动重试
      if (autoRetry && error.recovery?.some(r => r.id === 'retry')) {
        const retryAction = error.recovery.find(r => r.id === 'retry');
        if (retryAction) {
          scheduleAutoRetry(error.id, retryAction.action);
        }
      }
    };
    
    errorHandlerRef.current.addErrorListener(handleError);
    
    return () => {
      errorHandlerRef.current?.removeErrorListener(handleError);
      // 清理重试定时器
      retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, [showNotifications, maxErrors, autoRetry]);

  /**
   * 调度自动重试
   */
  const scheduleAutoRetry = useCallback((errorId: string, retryAction: () => void | Promise<void>) => {
    const timeout = setTimeout(async () => {
      try {
        await retryAction();
        // 重试成功，移除错误
        clearError(errorId);
      } catch (retryError) {
        console.error('自动重试失败:', retryError);
      }
      retryTimeoutsRef.current.delete(errorId);
    }, autoRetryConfig.baseDelay);
    
    retryTimeoutsRef.current.set(errorId, timeout);
  }, [autoRetryConfig.baseDelay]);

  /**
   * 手动处理错误
   */
  const handleError = useCallback((
    error: Error | AppError | unknown,
    context?: Record<string, any>,
    recoveryActions?: RecoveryAction[]
  ) => {
    let appError: AppError;
    
    if (error instanceof Error) {
      appError = convertNativeError(error, ErrorType.UNKNOWN_ERROR, context);
      if (recoveryActions) {
        appError.recovery = recoveryActions;
      }
    } else if (typeof error === 'object' && error !== null && 'id' in error) {
      appError = error as AppError;
    } else {
      appError = createAppError(
        ErrorType.UNKNOWN_ERROR,
        String(error),
        undefined,
        context,
        recoveryActions
      );
    }
    
    errorHandlerRef.current?.handleError(appError);
  }, []);

  /**
   * 创建并处理应用错误
   */
  const createError = useCallback((
    type: ErrorType,
    customMessage?: string,
    details?: string,
    context?: Record<string, any>,
    recoveryActions?: RecoveryAction[]
  ) => {
    const appError = createAppError(type, customMessage, details, context, recoveryActions);
    errorHandlerRef.current?.handleError(appError);
    return appError;
  }, []);

  /**
   * 清除特定错误
   */
  const clearError = useCallback((errorId: string) => {
    setState(prev => {
      const newErrors = prev.errors.filter(error => error.id !== errorId);
      return {
        errors: newErrors,
        hasActiveErrors: newErrors.length > 0,
        lastError: newErrors.length > 0 ? newErrors[newErrors.length - 1] : null
      };
    });

    // 清除对应的重试定时器
    const timeout = retryTimeoutsRef.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeoutsRef.current.delete(errorId);
    }
  }, []);

  /**
   * 清除所有错误
   */
  const clearAllErrors = useCallback(() => {
    setState({
      errors: [],
      hasActiveErrors: false,
      lastError: null
    });

    // 清除所有重试定时器
    retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();
  }, []);

  /**
   * 按严重程度过滤错误
   */
  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return state.errors.filter(error => error.severity === severity);
  }, [state.errors]);

  /**
   * 获取最新的严重错误
   */
  const getCriticalErrors = useCallback(() => {
    return getErrorsBySeverity(ErrorSeverity.CRITICAL);
  }, [getErrorsBySeverity]);

  /**
   * 带重试的异步操作包装器
   */
  const withRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR,
    context?: Record<string, any>
  ): Promise<T> => {
    try {
      return await retryWithBackoff(operation, {
        maxAttempts: autoRetryConfig.maxAttempts,
        baseDelay: autoRetryConfig.baseDelay,
        maxDelay: 10000,
        backoffFactor: 2
      });
    } catch (error) {
      handleError(error, { ...context, operation: 'withRetry', errorType });
      throw error;
    }
  }, [handleError, autoRetryConfig]);

  /**
   * 安全执行异步操作
   */
  const safeExecute = useCallback(async <T>(
    operation: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR,
    onError?: (error: AppError) => void
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const appError = convertNativeError(error, errorType);
      handleError(appError);
      if (onError) {
        onError(appError);
      }
      return null;
    }
  }, [handleError]);

  return {
    // 状态
    ...state,
    
    // 错误处理方法
    handleError,
    createError,
    clearError,
    clearAllErrors,
    
    // 查询方法
    getErrorsBySeverity,
    getCriticalErrors,
    
    // 实用方法
    withRetry,
    safeExecute,
    
    // 统计信息
    errorCount: state.errors.length,
    hasErrors: state.hasActiveErrors,
    hasCriticalErrors: getCriticalErrors().length > 0
  };
};

/**
 * 表单错误处理 Hook
 */
export const useFormErrorHandler = () => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors(prev => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const hasFieldError = useCallback((fieldName: string) => {
    return fieldName in fieldErrors;
  }, [fieldErrors]);

  const getFieldError = useCallback((fieldName: string) => {
    return fieldErrors[fieldName] || null;
  }, [fieldErrors]);

  return {
    fieldErrors,
    formError,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    setFormError,
    clearFormError: () => setFormError(null),
    hasFieldError,
    getFieldError,
    hasFieldErrors: Object.keys(fieldErrors).length > 0,
    hasFormError: formError !== null
  };
};

/**
 * 异步操作错误处理 Hook
 */
export const useAsyncErrorHandler = <T = any>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (
    operation: () => Promise<T>,
    errorType: ErrorType = ErrorType.UNKNOWN_ERROR
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await operation();
      setData(result);
      return result;
    } catch (err) {
      const appError = convertNativeError(err, errorType);
      setError(appError);
      throw appError;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    reset,
    hasError: error !== null,
    hasData: data !== null
  };
};