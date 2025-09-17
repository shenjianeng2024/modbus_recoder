import React from 'react';
import { Toaster } from './ui/sonner';

/**
 * Toast 提供器组件
 * 包装 Sonner Toast 组件，提供全局通知功能
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        expand={true}
        richColors={true}
        closeButton={true}
        toastOptions={{
          style: {
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          },
        }}
        theme="light"
        className="toaster group"
      />
    </>
  );
};