/**
 * 显示设置面板组件 - 简化版本
 * 允许用户配置基础的数据显示格式
 */

import { useState } from 'react';
import { Settings } from 'lucide-react';

// 临时简化版本，等待UI组件库解决后再完善
export function DisplaySettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Settings className="h-4 w-4" />
        显示设置
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">显示格式设置</h3>
            <p className="text-xs text-gray-500">
              显示设置功能正在开发中...
              <br />
              目前可以通过格式选择器切换十进制、十六进制和二进制显示。
            </p>
            <button 
              onClick={() => setIsOpen(false)}
              className="mt-3 w-full px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}