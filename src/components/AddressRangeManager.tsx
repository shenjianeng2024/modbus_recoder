import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddressRangeDialog } from './AddressRangeDialog';
import { useAddressRangeContext } from '../contexts/AddressRangeContext';
import { ManagedAddressRange } from '../types/modbus';
import { 
  formatAddressRange, 
  DATA_TYPE_LABELS 
} from '../utils/addressValidation';

export const AddressRangeManager: React.FC = () => {
  const {
    ranges,
    addRange,
    updateRange,
    removeRange,
    clearAllRanges,
    validateRange,
    checkOverlaps,
    totalAddresses,
    exportConfig,
    importConfig,
    isLoading,
    error,
  } = useAddressRangeContext();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<ManagedAddressRange | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取重叠检测结果
  const overlapResult = checkOverlaps();

  // 添加地址段
  const handleAdd = () => {
    setEditingRange(undefined);
    setDialogOpen(true);
  };

  // 编辑地址段
  const handleEdit = (range: ManagedAddressRange) => {
    setEditingRange(range);
    setDialogOpen(true);
  };

  // 删除地址段
  const handleDelete = (id: string) => {
    if (confirm('确认要删除这个地址段吗？')) {
      removeRange(id);
    }
  };

  // 清空所有地址段
  const handleClearAll = () => {
    if (confirm('确认要清空所有地址段吗？此操作不可恢复。')) {
      clearAllRanges();
    }
  };

  // 切换启用状态
  const handleToggleEnabled = (id: string, enabled: boolean) => {
    console.log('AddressRangeManager toggling enabled:', { id: id.slice(-4), enabled });
    updateRange(id, { enabled });
  };

  // 保存地址段
  const handleSaveRange = (range: Omit<ManagedAddressRange, 'id'>) => {
    if (editingRange) {
      updateRange(editingRange.id, range);
    } else {
      addRange(range);
    }
  };

  // 导出配置
  const handleExport = () => {
    const config = exportConfig();
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modbus_ranges_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入配置
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const success = importConfig(content);
        if (success) {
          alert('配置导入成功！');
        } else {
          alert('配置导入失败，请检查文件格式。');
        }
      };
      reader.readAsText(file);
    }
    // 清空输入，允许重新选择相同文件
    event.target.value = '';
  };

  // 获取地址段的状态样式
  const getRangeStatusStyle = (range: ManagedAddressRange) => {
    if (range.enabled === false) {
      return 'text-muted-foreground';
    }
    
    const validation = validateRange(range);
    if (!validation.isValid) {
      return 'text-red-600';
    }
    
    // 检查是否有重叠
    const hasConflict = overlapResult.conflicts.some(
      conflict => conflict.range1.id === range.id || conflict.range2.id === range.id
    );
    if (hasConflict) {
      return 'text-orange-600';
    }
    
    return 'text-green-600';
  };

  // 获取地址段的状态图标
  const getRangeStatusIcon = (range: ManagedAddressRange) => {
    if (range.enabled === false) {
      return null;
    }
    
    const validation = validateRange(range);
    if (!validation.isValid) {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    
    const hasConflict = overlapResult.conflicts.some(
      conflict => conflict.range1.id === range.id || conflict.range2.id === range.id
    );
    if (hasConflict) {
      return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    }
    
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>地址范围管理</CardTitle>
        </CardHeader>
        <CardContent>
          <p>加载配置中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] hover:border-purple-400/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                地址范围管理
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleImport} className="transition-all duration-200 hover:shadow-md hover:scale-105 hover:bg-blue-50 hover:border-blue-300">
                <Upload className="w-4 h-4 mr-2" />
                导入
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport} disabled={ranges.length === 0} className="transition-all duration-200 hover:shadow-md hover:scale-105 hover:bg-green-50 hover:border-green-300 disabled:hover:scale-100 disabled:hover:shadow-none">
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
              <Button 
                size="sm" 
                onClick={handleAdd}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加地址段
              </Button>
            </div>
          </div>
          
          {/* 状态信息 */}
          <div className="flex flex-wrap gap-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5 transition-all duration-300 hover:shadow-md hover:shadow-blue-500/20 hover:scale-105">
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                总地址数: <span className="text-blue-900 dark:text-blue-100">{totalAddresses}</span>
              </span>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-1.5 transition-all duration-300 hover:shadow-md hover:shadow-purple-500/20 hover:scale-105">
              <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                地址段数: <span className="text-purple-900 dark:text-purple-100">{ranges.length}</span>
              </span>
            </div>
            {overlapResult.hasOverlap && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5 animate-pulse transition-all duration-300 hover:shadow-md hover:shadow-orange-500/20 hover:scale-105">
                <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                  ⚠️ 发现 {overlapResult.conflicts.length} 个重叠冲突
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* 错误信息 */}
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-600 dark:text-red-400 text-xl mt-0.5">❌</div>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">配置错误</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* 重叠警告 */}
          {overlapResult.hasOverlap && (
            <div className="mb-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-orange-600 dark:text-orange-400 text-xl mt-0.5">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">地址段重叠警告：</p>
                  <div className="space-y-1">
                    {overlapResult.conflicts.map((conflict, index) => (
                      <p key={index} className="text-sm text-orange-700 dark:text-orange-300">
                        • <span className="font-medium">{conflict.range1.name || `地址段${conflict.range1.id.slice(-4)}`}</span> 与{' '}
                        <span className="font-medium">{conflict.range2.name || `地址段${conflict.range2.id.slice(-4)}`}</span> 重叠
                        （地址 <span className="font-mono">{conflict.overlapStart}-{conflict.overlapEnd}</span>）
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 地址段列表 */}
          {ranges.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg font-medium text-muted-foreground mb-2">暂无配置的地址段</p>
              <p className="text-sm text-muted-foreground">点击"添加地址段"开始配置 Modbus 地址范围</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">状态</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>地址范围</TableHead>
                      <TableHead>数据类型</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="w-24">启用</TableHead>
                      <TableHead className="w-24 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranges.map((range) => (
                      <TableRow key={range.id} className={`${getRangeStatusStyle(range)} transition-all duration-200 hover:bg-muted/50 hover:scale-[1.01]`}>
                        <TableCell>
                          {getRangeStatusIcon(range)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {range.name || `地址段 ${range.id.slice(-4)}`}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {formatAddressRange(range)}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            ({range.length} 个地址)
                          </span>
                        </TableCell>
                        <TableCell>
                          {DATA_TYPE_LABELS[range.dataType]}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {range.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={range.enabled !== false ? "default" : "outline"}
                            onClick={() => handleToggleEnabled(range.id, range.enabled === false)}
                            className="transition-all duration-200 hover:shadow-md hover:scale-105"
                          >
                            {range.enabled !== false ? "禁用" : "启用"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(range)}
                              className="transition-all duration-200 hover:shadow-md hover:scale-110 hover:bg-blue-100"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(range.id)}
                              className="transition-all duration-200 hover:shadow-md hover:scale-110 hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 批量操作 */}
              {ranges.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleClearAll} className="transition-all duration-200 hover:shadow-md hover:scale-105 hover:bg-orange-50 hover:border-orange-300">
                      清空所有地址段
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑对话框 */}
      <AddressRangeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveRange}
        editingRange={editingRange}
      />

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
      />
    </>
  );
};