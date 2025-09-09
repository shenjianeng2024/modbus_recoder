import { useEffect, useCallback, useRef } from 'react';

/**
 * 键盘快捷键类型定义
 */
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  disabled?: boolean;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

/**
 * 检查快捷键是否匹配当前按键事件
 */
const isShortcutMatch = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  if (shortcut.disabled) return false;
  
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    (shortcut.ctrl ?? false) === (event.ctrlKey || event.metaKey) &&
    (shortcut.alt ?? false) === event.altKey &&
    (shortcut.shift ?? false) === event.shiftKey &&
    (shortcut.meta ?? false) === event.metaKey
  );
};

/**
 * 格式化快捷键显示文本
 */
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const keys: string[] = [];
  
  if (shortcut.meta) keys.push('⌘');
  else if (shortcut.ctrl) keys.push('Ctrl');
  
  if (shortcut.alt) keys.push('Alt');
  if (shortcut.shift) keys.push('Shift');
  
  keys.push(shortcut.key.toUpperCase());
  
  return keys.join(' + ');
};

/**
 * 键盘快捷键 Hook
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  // 更新快捷键引用
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 检查是否在输入框内
    const target = event.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true' ||
                          target.isContentEditable;
    
    // 对于某些快捷键，即使在输入框内也要响应
    const globalShortcuts = ['f1', 'f5', 'escape'];
    const isGlobalShortcut = globalShortcuts.includes(event.key.toLowerCase());
    
    if (isInputElement && !isGlobalShortcut) {
      return;
    }
    
    for (const shortcut of shortcutsRef.current) {
      if (isShortcutMatch(event, shortcut)) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation !== false) {
          event.stopPropagation();
        }
        
        try {
          shortcut.action();
        } catch (error) {
          console.error('执行快捷键操作时发生错误:', error);
        }
        
        break; // 找到匹配的快捷键后停止查找
      }
    }
  }, []);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

/**
 * 应用级快捷键定义
 */
export const useAppShortcuts = (handlers: {
  onSave?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStartCollection?: () => void;
  onStopCollection?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [
    // 保存配置
    {
      key: 's',
      ctrl: true,
      action: () => handlers.onSave?.(),
      description: '保存配置',
      disabled: !handlers.onSave
    },
    
    // 连接/断开设备
    {
      key: 'Enter',
      ctrl: true,
      action: () => handlers.onConnect?.(),
      description: '连接设备',
      disabled: !handlers.onConnect
    },
    {
      key: 'd',
      ctrl: true,
      shift: true,
      action: () => handlers.onDisconnect?.(),
      description: '断开连接',
      disabled: !handlers.onDisconnect
    },
    
    // 数据采集控制
    {
      key: 'r',
      ctrl: true,
      action: () => handlers.onStartCollection?.(),
      description: '开始采集',
      disabled: !handlers.onStartCollection
    },
    {
      key: 'q',
      ctrl: true,
      action: () => handlers.onStopCollection?.(),
      description: '停止采集',
      disabled: !handlers.onStopCollection
    },
    
    // 导出数据
    {
      key: 'e',
      ctrl: true,
      action: () => handlers.onExport?.(),
      description: '导出数据',
      disabled: !handlers.onExport
    },
    
    // 刷新
    {
      key: 'F5',
      action: () => handlers.onRefresh?.(),
      description: '刷新',
      disabled: !handlers.onRefresh,
      preventDefault: true
    },
    
    // 帮助
    {
      key: 'F1',
      action: () => handlers.onHelp?.(),
      description: '显示帮助',
      disabled: !handlers.onHelp
    },
    
    // 设置
    {
      key: ',',
      ctrl: true,
      action: () => handlers.onSettings?.(),
      description: '打开设置',
      disabled: !handlers.onSettings
    }
  ];
  
  useKeyboardShortcuts(shortcuts);
  
  return shortcuts.filter(s => !s.disabled);
};

/**
 * 表单快捷键 Hook
 */
export const useFormShortcuts = (handlers: {
  onSubmit?: () => void;
  onReset?: () => void;
  onCancel?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [
    // 提交表单
    {
      key: 'Enter',
      ctrl: true,
      action: () => handlers.onSubmit?.(),
      description: '提交表单',
      disabled: !handlers.onSubmit
    },
    
    // 重置表单
    {
      key: 'r',
      ctrl: true,
      shift: true,
      action: () => handlers.onReset?.(),
      description: '重置表单',
      disabled: !handlers.onReset
    },
    
    // 取消
    {
      key: 'Escape',
      action: () => handlers.onCancel?.(),
      description: '取消操作',
      disabled: !handlers.onCancel
    }
  ];
  
  useKeyboardShortcuts(shortcuts);
  
  return shortcuts.filter(s => !s.disabled);
};

/**
 * 模态框快捷键 Hook
 */
export const useModalShortcuts = (handlers: {
  onClose?: () => void;
  onConfirm?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [
    // 关闭模态框
    {
      key: 'Escape',
      action: () => handlers.onClose?.(),
      description: '关闭对话框',
      disabled: !handlers.onClose
    },
    
    // 确认操作
    {
      key: 'Enter',
      action: () => handlers.onConfirm?.(),
      description: '确认',
      disabled: !handlers.onConfirm
    }
  ];
  
  useKeyboardShortcuts(shortcuts);
};

/**
 * 快捷键提示组件数据
 */
export interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

/**
 * 获取所有快捷键帮助信息
 */
export const getShortcutHelpData = (): ShortcutGroup[] => {
  return [
    {
      title: '通用操作',
      shortcuts: [
        { keys: 'Ctrl + S', description: '保存配置' },
        { keys: 'F5', description: '刷新页面' },
        { keys: 'F1', description: '显示帮助' },
        { keys: 'Ctrl + ,', description: '打开设置' }
      ]
    },
    {
      title: '设备连接',
      shortcuts: [
        { keys: 'Ctrl + Enter', description: '连接设备' },
        { keys: 'Ctrl + Shift + D', description: '断开连接' }
      ]
    },
    {
      title: '数据采集',
      shortcuts: [
        { keys: 'Ctrl + R', description: '开始采集' },
        { keys: 'Ctrl + Q', description: '停止采集' },
        { keys: 'Ctrl + E', description: '导出数据' }
      ]
    },
    {
      title: '表单操作',
      shortcuts: [
        { keys: 'Ctrl + Enter', description: '提交表单' },
        { keys: 'Ctrl + Shift + R', description: '重置表单' },
        { keys: 'Escape', description: '取消操作' }
      ]
    }
  ];
};