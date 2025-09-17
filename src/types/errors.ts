/**
 * 应用错误类型枚举
 */
export enum ErrorType {
  // 网络相关错误
  NETWORK_ERROR = 'network_error',
  CONNECTION_TIMEOUT = 'connection_timeout',
  CONNECTION_REFUSED = 'connection_refused',
  
  // 设备相关错误
  DEVICE_ERROR = 'device_error',
  DEVICE_UNREACHABLE = 'device_unreachable',
  DEVICE_RESPONSE_INVALID = 'device_response_invalid',
  
  // 验证相关错误
  VALIDATION_ERROR = 'validation_error',
  INVALID_ADDRESS = 'invalid_address',
  INVALID_IP_PORT = 'invalid_ip_port',
  
  // 文件操作错误
  FILE_ERROR = 'file_error',
  FILE_PERMISSION_DENIED = 'file_permission_denied',
  FILE_NOT_FOUND = 'file_not_found',
  DISK_SPACE_INSUFFICIENT = 'disk_space_insufficient',
  
  // 配置相关错误
  CONFIG_ERROR = 'config_error',
  CONFIG_INVALID = 'config_invalid',
  CONFIG_MISSING = 'config_missing',
  
  // 系统错误
  SYSTEM_ERROR = 'system_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'low',        // 低级别 - 用户可以忽略继续操作
  MEDIUM = 'medium',  // 中级别 - 影响部分功能，需要用户注意
  HIGH = 'high',      // 高级别 - 严重影响功能，需要立即处理
  CRITICAL = 'critical' // 严重 - 应用无法正常工作
}

/**
 * 应用错误接口
 */
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  details?: string;
  recovery?: RecoveryAction[];
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
}

/**
 * 错误恢复操作
 */
export interface RecoveryAction {
  id: string;
  label: string;
  description?: string;
  action: () => void | Promise<void>;
  isPrimary?: boolean;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // 毫秒
  maxDelay: number;  // 毫秒
  backoffFactor: number;
  retryableErrors?: ErrorType[];
}

/**
 * 通知类型
 */
export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * 通知消息
 */
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // 毫秒，0 表示不自动关闭
  actions?: {
    label: string;
    action: () => void;
  }[];
}

/**
 * 错误边界状态
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any | null;
  errorId: string | null;
}