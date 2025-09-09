import { AppError, ErrorType, ErrorSeverity, RecoveryAction, RetryConfig } from '../types/errors';

/**
 * 生成唯一错误ID
 */
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 错误映射配置
 */
const ERROR_MESSAGES: Record<ErrorType, { title: string; message: string; severity: ErrorSeverity }> = {
  [ErrorType.NETWORK_ERROR]: {
    title: '网络连接错误',
    message: '网络连接出现问题，请检查网络设置',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.CONNECTION_TIMEOUT]: {
    title: '连接超时',
    message: '连接设备超时，请检查设备状态和网络连接',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.CONNECTION_REFUSED]: {
    title: '连接被拒绝',
    message: '设备拒绝连接，请检查IP地址、端口和设备状态',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.DEVICE_ERROR]: {
    title: '设备错误',
    message: '设备响应异常，请检查设备状态',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.DEVICE_UNREACHABLE]: {
    title: '设备不可达',
    message: '无法连接到指定设备，请检查IP地址和网络连接',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.DEVICE_RESPONSE_INVALID]: {
    title: '设备响应无效',
    message: '设备返回的数据格式不正确',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.VALIDATION_ERROR]: {
    title: '输入验证错误',
    message: '输入的数据格式不正确，请检查后重试',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.INVALID_ADDRESS]: {
    title: '地址无效',
    message: '输入的Modbus地址不在有效范围内',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.INVALID_IP_PORT]: {
    title: 'IP或端口无效',
    message: '请输入有效的IP地址和端口号',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.FILE_ERROR]: {
    title: '文件操作错误',
    message: '文件操作失败，请检查文件权限',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.FILE_PERMISSION_DENIED]: {
    title: '文件权限不足',
    message: '没有权限访问指定文件，请检查文件权限',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.FILE_NOT_FOUND]: {
    title: '文件未找到',
    message: '指定的文件不存在',
    severity: ErrorSeverity.MEDIUM
  },
  [ErrorType.DISK_SPACE_INSUFFICIENT]: {
    title: '磁盘空间不足',
    message: '磁盘剩余空间不足，无法保存文件',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.CONFIG_ERROR]: {
    title: '配置错误',
    message: '应用配置存在问题',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.CONFIG_INVALID]: {
    title: '配置无效',
    message: '当前配置格式不正确，请检查配置项',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.CONFIG_MISSING]: {
    title: '配置缺失',
    message: '缺少必要的配置项',
    severity: ErrorSeverity.HIGH
  },
  [ErrorType.SYSTEM_ERROR]: {
    title: '系统错误',
    message: '系统出现异常，请重启应用后重试',
    severity: ErrorSeverity.CRITICAL
  },
  [ErrorType.UNKNOWN_ERROR]: {
    title: '未知错误',
    message: '发生了未知错误，请联系技术支持',
    severity: ErrorSeverity.HIGH
  }
};

/**
 * 根据错误类型创建标准化错误对象
 */
export const createAppError = (
  type: ErrorType,
  customMessage?: string,
  details?: string,
  context?: Record<string, any>,
  recoveryActions?: RecoveryAction[]
): AppError => {
  const errorTemplate = ERROR_MESSAGES[type];
  
  return {
    id: generateErrorId(),
    type,
    severity: errorTemplate.severity,
    title: errorTemplate.title,
    message: customMessage || errorTemplate.message,
    details,
    recovery: recoveryActions,
    timestamp: new Date(),
    context,
    stack: new Error().stack
  };
};

/**
 * 从原生错误转换为应用错误
 */
export const convertNativeError = (
  error: Error | unknown,
  fallbackType: ErrorType = ErrorType.UNKNOWN_ERROR,
  context?: Record<string, any>
): AppError => {
  if (error instanceof Error) {
    // 根据错误消息推断错误类型
    const errorType = inferErrorType(error.message);
    
    return {
      id: generateErrorId(),
      type: errorType,
      severity: ERROR_MESSAGES[errorType].severity,
      title: ERROR_MESSAGES[errorType].title,
      message: error.message || ERROR_MESSAGES[errorType].message,
      timestamp: new Date(),
      context,
      stack: error.stack
    };
  }
  
  return createAppError(fallbackType, String(error), undefined, context);
};

/**
 * 根据错误消息推断错误类型
 */
const inferErrorType = (message: string): ErrorType => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('timeout')) {
    return ErrorType.CONNECTION_TIMEOUT;
  }
  if (lowerMessage.includes('refused') || lowerMessage.includes('connection refused')) {
    return ErrorType.CONNECTION_REFUSED;
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('dns')) {
    return ErrorType.NETWORK_ERROR;
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('access denied')) {
    return ErrorType.FILE_PERMISSION_DENIED;
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('enoent')) {
    return ErrorType.FILE_NOT_FOUND;
  }
  if (lowerMessage.includes('space') || lowerMessage.includes('enospc')) {
    return ErrorType.DISK_SPACE_INSUFFICIENT;
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return ErrorType.VALIDATION_ERROR;
  }
  
  return ErrorType.UNKNOWN_ERROR;
};

/**
 * 检查错误是否可以重试
 */
export const isRetryableError = (error: AppError): boolean => {
  const retryableTypes = [
    ErrorType.NETWORK_ERROR,
    ErrorType.CONNECTION_TIMEOUT,
    ErrorType.DEVICE_UNREACHABLE,
    ErrorType.DEVICE_ERROR
  ];
  
  return retryableTypes.includes(error.type);
};

/**
 * 带指数退避的重试机制
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  }
): Promise<T> => {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === config.maxAttempts) {
        throw error;
      }
      
      // 检查是否是可重试的错误
      if (error instanceof Error) {
        const appError = convertNativeError(error);
        if (!isRetryableError(appError)) {
          throw error;
        }
      }
      
      // 计算延迟时间
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );
      
      // 添加随机抖动避免同时重试
      const jitter = Math.random() * 0.1 * delay;
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
};

/**
 * 创建常用的恢复操作
 */
export const createRecoveryActions = {
  retry: (onRetry: () => void | Promise<void>): RecoveryAction => ({
    id: 'retry',
    label: '重试',
    description: '重新尝试操作',
    action: onRetry,
    isPrimary: true
  }),
  
  reconnect: (onReconnect: () => void | Promise<void>): RecoveryAction => ({
    id: 'reconnect',
    label: '重新连接',
    description: '尝试重新连接设备',
    action: onReconnect,
    isPrimary: true
  }),
  
  checkNetwork: (): RecoveryAction => ({
    id: 'check-network',
    label: '检查网络',
    description: '检查网络连接状态',
    action: () => {
      // 可以实现网络检查逻辑
      console.log('检查网络连接...');
    }
  }),
  
  dismiss: (): RecoveryAction => ({
    id: 'dismiss',
    label: '忽略',
    description: '忽略此错误',
    action: () => {
      // 什么都不做，只是关闭错误提示
    }
  }),
  
  reset: (onReset: () => void | Promise<void>): RecoveryAction => ({
    id: 'reset',
    label: '重置',
    description: '重置到默认状态',
    action: onReset
  })
};

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Array<(error: AppError) => void> = [];
  
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * 添加错误监听器
   */
  public addErrorListener(listener: (error: AppError) => void): void {
    this.errorListeners.push(listener);
  }
  
  /**
   * 移除错误监听器
   */
  public removeErrorListener(listener: (error: AppError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }
  
  /**
   * 处理错误
   */
  public handleError(error: AppError): void {
    // 记录错误到控制台（生产环境可以发送到日志服务）
    console.error('应用错误:', {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      timestamp: error.timestamp,
      context: error.context,
      stack: error.stack
    });
    
    // 通知所有监听器
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('错误监听器执行失败:', listenerError);
      }
    });
  }
  
  /**
   * 处理原生错误
   */
  public handleNativeError(
    error: Error | unknown,
    context?: Record<string, any>
  ): void {
    const appError = convertNativeError(error, ErrorType.UNKNOWN_ERROR, context);
    this.handleError(appError);
  }
}