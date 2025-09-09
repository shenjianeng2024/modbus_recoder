import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, Trash2, Save, RefreshCw } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  warningMessage?: string;
  details?: string[];
}

const variantConfig = {
  default: {
    icon: Save,
    confirmButtonVariant: 'default' as const,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  warning: {
    icon: AlertTriangle,
    confirmButtonVariant: 'default' as const,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  destructive: {
    icon: Trash2,
    confirmButtonVariant: 'destructive' as const,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-100'
  }
};

/**
 * 通用确认对话框组件
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  warningMessage,
  details
}) => {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-600">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {warningMessage && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium text-yellow-800">
                {warningMessage}
              </AlertDescription>
            </Alert>
          )}

          {details && details.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-2">详细信息：</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming || loading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            variant={config.confirmButtonVariant}
            onClick={handleConfirm}
            disabled={isConfirming || loading}
            className="w-full sm:w-auto"
          >
            {(isConfirming || loading) && (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            )}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * 删除确认对话框
 */
export const DeleteConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  additionalWarnings?: string[];
}> = ({ open, onOpenChange, itemName, onConfirm, loading, additionalWarnings }) => {
  const details = [
    '此操作不可撤销',
    '删除后数据将无法恢复',
    ...(additionalWarnings || [])
  ];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="确认删除"
      description={`您确定要删除 "${itemName}" 吗？`}
      confirmText="删除"
      cancelText="取消"
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
      warningMessage="删除操作不可撤销，请谨慎操作"
      details={details}
    />
  );
};

/**
 * 停止采集确认对话框
 */
export const StopCollectionConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  collectedCount: number;
  loading?: boolean;
}> = ({ open, onOpenChange, onConfirm, collectedCount, loading }) => {
  const details = [
    `已采集 ${collectedCount} 条数据`,
    '停止后可以继续导出已采集的数据',
    '或者稍后重新开始采集'
  ];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="停止数据采集"
      description="您确定要停止当前的数据采集任务吗？"
      confirmText="停止采集"
      cancelText="继续采集"
      variant="warning"
      onConfirm={onConfirm}
      loading={loading}
      warningMessage={collectedCount > 0 ? "已有数据被采集，停止后不会丢失" : "尚未采集到任何数据"}
      details={details}
    />
  );
};

/**
 * 连接断开确认对话框
 */
export const DisconnectConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  deviceInfo: string;
  hasActiveOperations?: boolean;
  loading?: boolean;
}> = ({ open, onOpenChange, onConfirm, deviceInfo, hasActiveOperations, loading }) => {
  const details = hasActiveOperations 
    ? [
        '当前有正在进行的操作',
        '断开连接将中断所有操作',
        '未保存的数据可能会丢失'
      ]
    : [
        '将断开与设备的连接',
        '可以稍后重新连接设备'
      ];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="断开连接"
      description={`确定要断开与设备 "${deviceInfo}" 的连接吗？`}
      confirmText="断开连接"
      cancelText="取消"
      variant={hasActiveOperations ? "warning" : "default"}
      onConfirm={onConfirm}
      loading={loading}
      warningMessage={hasActiveOperations ? "断开连接将中断正在进行的操作" : undefined}
      details={details}
    />
  );
};

/**
 * 重置配置确认对话框
 */
export const ResetConfigConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  configType: string;
  loading?: boolean;
}> = ({ open, onOpenChange, onConfirm, configType, loading }) => {
  const details = [
    '所有自定义设置将被清除',
    '配置将恢复到默认值',
    '需要重新配置设备连接信息'
  ];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="重置配置"
      description={`确定要重置 ${configType} 配置吗？`}
      confirmText="重置"
      cancelText="取消"
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
      warningMessage="重置后需要重新配置所有设置"
      details={details}
    />
  );
};

/**
 * 保存配置确认对话框
 */
export const SaveConfigConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  hasUnsavedChanges: boolean;
  loading?: boolean;
}> = ({ open, onOpenChange, onConfirm, hasUnsavedChanges, loading }) => {
  const details = hasUnsavedChanges
    ? [
        '将保存所有未保存的更改',
        '新配置将立即生效',
        '建议在保存前检查配置的正确性'
      ]
    : [
        '当前配置已是最新状态',
        '确认保存当前配置'
      ];

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="保存配置"
      description="确定要保存当前配置吗？"
      confirmText="保存"
      cancelText="取消"
      variant="default"
      onConfirm={onConfirm}
      loading={loading}
      details={details}
    />
  );
};