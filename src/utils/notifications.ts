import { toast } from 'sonner';
import { NotificationMessage, NotificationType, AppError } from '../types/errors';

/**
 * 通知管理器类
 */
export class NotificationManager {
  private static instance: NotificationManager;
  
  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }
  
  /**
   * 显示成功通知
   */
  public success(title: string, message?: string, duration: number = 4000): string | number {
    return toast.success(title, {
      description: message,
      duration,
      closeButton: true,
    });
  }
  
  /**
   * 显示信息通知
   */
  public info(title: string, message?: string, duration: number = 4000): string | number {
    return toast.info(title, {
      description: message,
      duration,
      closeButton: true,
    });
  }
  
  /**
   * 显示警告通知
   */
  public warning(title: string, message?: string, duration: number = 6000): string | number {
    return toast.warning(title, {
      description: message,
      duration,
      closeButton: true,
    });
  }
  
  /**
   * 显示错误通知
   */
  public error(title: string, message?: string, duration: number = 8000): string | number {
    return toast.error(title, {
      description: message,
      duration,
      closeButton: true,
      action: {
        label: '查看详情',
        onClick: () => {
          // 可以打开错误详情对话框
          console.log('查看错误详情:', { title, message });
        }
      }
    });
  }
  
  /**
   * 显示加载通知
   */
  public loading(title: string, message?: string): string | number {
    return toast.loading(title, {
      description: message,
    });
  }
  
  /**
   * 显示自定义通知
   */
  public custom(notification: NotificationMessage): string | number {
    const { type, title, message, duration, actions } = notification;
    
    const toastOptions: any = {
      description: message,
      duration: duration || this.getDefaultDuration(type),
      closeButton: true,
    };
    
    // 添加操作按钮
    if (actions && actions.length > 0) {
      const primaryAction = actions[0];
      toastOptions.action = {
        label: primaryAction.label,
        onClick: primaryAction.action
      };
    }
    
    switch (type) {
      case NotificationType.SUCCESS:
        return toast.success(title, toastOptions);
      case NotificationType.INFO:
        return toast.info(title, toastOptions);
      case NotificationType.WARNING:
        return toast.warning(title, toastOptions);
      case NotificationType.ERROR:
        return toast.error(title, toastOptions);
      default:
        return toast(title, toastOptions);
    }
  }
  
  /**
   * 显示应用错误通知
   */
  public showError(error: AppError): string | number {
    const duration = this.getErrorDuration(error);
    
    return toast.error(error.title, {
      description: error.message,
      duration,
      closeButton: true,
      action: error.recovery && error.recovery.length > 0 ? {
        label: error.recovery.find(r => r.isPrimary)?.label || error.recovery[0].label,
        onClick: () => {
          const primaryAction = error.recovery?.find(r => r.isPrimary) || error.recovery?.[0];
          if (primaryAction) {
            primaryAction.action();
          }
        }
      } : {
        label: '查看详情',
        onClick: () => {
          this.showErrorDetails(error);
        }
      }
    });
  }
  
  /**
   * 显示带进度的通知
   */
  public progress(title: string, progress: number, message?: string): string | number {
    const progressMessage = message ? `${message} (${Math.round(progress)}%)` : `进度: ${Math.round(progress)}%`;
    
    if (progress >= 100) {
      return toast.success(title, {
        description: '操作完成',
        duration: 3000,
        closeButton: true,
      });
    }
    
    return toast.loading(title, {
      description: progressMessage,
    });
  }
  
  /**
   * 显示确认通知
   */
  public confirm(
    title: string, 
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void
  ): string | number {
    return toast(title, {
      description: message,
      duration: 0, // 不自动关闭
      closeButton: false,
      action: {
        label: '确认',
        onClick: () => {
          onConfirm();
          toast.dismiss();
        }
      },
      cancel: {
        label: '取消',
        onClick: () => {
          if (onCancel) onCancel();
          toast.dismiss();
        }
      }
    });
  }
  
  /**
   * 更新现有通知
   */
  public update(toastId: string, notification: Partial<NotificationMessage>): void {
    // Sonner 不直接支持更新，需要先取消再创建新的
    toast.dismiss(toastId);
    if (notification.title) {
      this.custom({
        id: toastId,
        type: notification.type || NotificationType.INFO,
        title: notification.title,
        message: notification.message,
        duration: notification.duration,
        actions: notification.actions
      });
    }
  }
  
  /**
   * 关闭通知
   */
  public dismiss(toastId?: string | number): void {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }
  
  /**
   * 关闭所有通知
   */
  public dismissAll(): void {
    toast.dismiss();
  }
  
  /**
   * 获取默认持续时间
   */
  private getDefaultDuration(type: NotificationType): number {
    switch (type) {
      case NotificationType.SUCCESS:
        return 4000;
      case NotificationType.INFO:
        return 4000;
      case NotificationType.WARNING:
        return 6000;
      case NotificationType.ERROR:
        return 8000;
      default:
        return 4000;
    }
  }
  
  /**
   * 根据错误严重程度获取显示时间
   */
  private getErrorDuration(error: AppError): number {
    switch (error.severity) {
      case 'low':
        return 4000;
      case 'medium':
        return 6000;
      case 'high':
        return 8000;
      case 'critical':
        return 0; // 不自动关闭
      default:
        return 6000;
    }
  }
  
  /**
   * 显示错误详情
   */
  private showErrorDetails(error: AppError): void {
    // 这里可以打开一个模态框显示错误详情
    console.log('错误详情:', error);
    
    // 创建一个新的通知显示详情
    toast.info('错误详情', {
      description: `错误ID: ${error.id}\n时间: ${error.timestamp.toLocaleString()}\n详情: ${error.details || '无'}`,
      duration: 10000,
      closeButton: true,
    });
  }
}

/**
 * 通知工具函数
 */
export const notify = NotificationManager.getInstance();

/**
 * 便捷的通知函数
 */
export const notifications = {
  success: (title: string, message?: string, duration?: number) => 
    notify.success(title, message, duration),
    
  info: (title: string, message?: string, duration?: number) => 
    notify.info(title, message, duration),
    
  warning: (title: string, message?: string, duration?: number) => 
    notify.warning(title, message, duration),
    
  error: (title: string, message?: string, duration?: number) => 
    notify.error(title, message, duration),
    
  loading: (title: string, message?: string) => 
    notify.loading(title, message),
    
  showError: (error: AppError) => 
    notify.showError(error),
    
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => 
    notify.confirm(title, message, onConfirm, onCancel),
    
  dismiss: (toastId?: string | number) => 
    notify.dismiss(toastId),
    
  dismissAll: () => 
    notify.dismissAll()
};