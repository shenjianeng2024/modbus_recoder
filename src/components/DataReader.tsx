import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Loader2, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Database,
  TrendingUp,
  AlertTriangle,
  BarChart3
} from 'lucide-react';

import { 
  ConnectionConfig, 
  BatchReadResult, 
  DisplayFormat,
  AddressRange
} from '@/types/modbus';
import { 
  convertBatchResult, 
  formatDisplayValue, 
  validateReadResult 
} from '@/utils/dataParser';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { notifications } from '@/utils/notifications';
import { useAddressRangeContext } from '@/contexts/AddressRangeContext';

interface DataReaderProps {
  connectionConfig: ConnectionConfig;
  disabled?: boolean;
}

type ReadStatus = 'idle' | 'reading' | 'completed' | 'error';

export function DataReader({ connectionConfig, disabled = false }: DataReaderProps) {
  const [readStatus, setReadStatus] = useState<ReadStatus>('idle');
  const [batchResult, setBatchResult] = useState<BatchReadResult | null>(null);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('dec');
  const [error, setError] = useState<string | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const { ranges, refreshTrigger } = useAddressRangeContext();
  const { handleError } = useErrorHandler({
    showNotifications: true,
    maxErrors: 10,
    autoRetry: false
  });

  // 获取启用的地址段
  const enabledRanges = ranges.filter(range => range.enabled !== false);
  const hasEnabledRanges = enabledRanges.length > 0;

  // 添加调试日志 - 监听ranges变化
  useEffect(() => {
    console.log('DataReader ranges updated:', {
      total: ranges.length,
      enabled: enabledRanges.length,
      refreshTrigger,
      ranges: ranges.map(r => ({ 
        id: r.id.slice(-4), 
        enabled: r.enabled, 
        name: r.name || 'unnamed',
        startAddress: r.startAddress,
        length: r.length 
      }))
    });
  }, [ranges, enabledRanges, refreshTrigger]);

  // 构建读取请求
  const buildReadRequest = useCallback(() => {
    const addressRanges: AddressRange[] = enabledRanges.map(range => ({
      start: range.startAddress,
      count: range.length,
      data_type: range.dataType || 'uint16'  // 添加数据类型字段
    }));

    return {
      ranges: addressRanges,
      format: displayFormat
    };
  }, [enabledRanges, displayFormat]);

  // 执行批量读取
  const handleBatchRead = async () => {
    if (!hasEnabledRanges) {
      notifications.warning('无可读取数据', '请先在地址范围管理中配置并启用至少一个地址段');
      return;
    }

    setReadStatus('reading');
    setError(null);
    setBatchResult(null);

    try {
      const loadingToastId = notifications.loading(
        '正在读取数据...',
        `读取 ${enabledRanges.length} 个地址段，共 ${enabledRanges.reduce((sum, range) => sum + range.length, 0)} 个地址`
      );

      const request = buildReadRequest();
      const result = await invoke<BatchReadResult>('read_modbus_ranges', { request });
      
      // 验证读取结果
      const validation = validateReadResult(result);
      if (!validation.isValid) {
        console.warn('读取结果验证警告:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`数据验证失败: ${validation.errors.join(', ')}`);
        }
      }

      setBatchResult(result);
      setReadStatus('completed');

      notifications.dismiss(loadingToastId);
      
      if (result.success_count > 0) {
        notifications.success(
          '数据读取完成',
          `成功读取 ${result.success_count}/${result.total_count} 个地址，耗时 ${result.duration_ms}ms`
        );
        // 自动打开结果弹窗
        setShowResultDialog(true);
      } else {
        notifications.warning(
          '读取完成但无数据',
          `所有 ${result.total_count} 个地址读取失败`
        );
        setReadStatus('error');
      }
    } catch (err) {
      const errorMessage = `批量读取失败: ${err}`;
      setError(errorMessage);
      setReadStatus('error');
      notifications.error('读取失败', errorMessage);
      handleError(err, {
        connectionConfig,
        operation: 'batch_read',
        context: { enabledRangesCount: enabledRanges.length }
      });
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  // 获取状态指示器内容
  const getStatusIndicator = () => {
    const statusConfig = {
      idle: {
        icon: <Database className="h-4 w-4" />,
        text: '空闲',
        variant: 'secondary' as const,
        color: 'text-muted-foreground'
      },
      reading: {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: '读取中',
        variant: 'default' as const,
        color: 'text-blue-600'
      },
      completed: {
        icon: <CheckCircle className="h-4 w-4" />,
        text: '已完成',
        variant: 'default' as const,
        color: 'text-green-600'
      },
      error: {
        icon: <AlertCircle className="h-4 w-4" />,
        text: '错误',
        variant: 'destructive' as const,
        color: 'text-red-600'
      }
    };

    const config = statusConfig[readStatus];
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.text}
      </Badge>
    );
  };

  // 解析并显示读取结果
  const parsedData = batchResult ? convertBatchResult(batchResult, displayFormat) : [];

  return (
    <>
      {/* 控制面板 */}
      <Card className="border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] hover:border-blue-400/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            单次数据读取
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 操作栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleBatchRead} 
                disabled={disabled || readStatus === 'reading' || !hasEnabledRanges}
                className="h-11 px-6 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                size="lg"
              >
                {readStatus === 'reading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    读取中...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    立即读取
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">格式:</span>
                <Select
                  value={displayFormat}
                  onValueChange={(value: DisplayFormat) => setDisplayFormat(value)}
                  disabled={readStatus === 'reading'}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dec">十进制</SelectItem>
                    <SelectItem value="hex">十六进制</SelectItem>
                    <SelectItem value="bin">二进制</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">状态:</span>
              {getStatusIndicator()}
            </div>
          </div>

          {/* 地址段信息 */}
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>📍 已启用地址段: {enabledRanges.length} 个</span>
              <span>📊 总地址数: {enabledRanges.reduce((sum, range) => sum + range.length, 0)} 个</span>
              <span className="text-xs opacity-60">
                (总段数: {ranges.length}, 启用ID: {enabledRanges.map(r => r.id.slice(-4)).join(',')})
              </span>
            </div>
            <div className="text-xs opacity-50 mt-1">
              全部段状态: {ranges.map(r => `${r.id.slice(-4)}(${r.enabled !== false ? '✓' : '✗'})`).join(', ')}
            </div>
            {hasEnabledRanges && (
              <div className="text-xs text-green-600 mt-1">
                ✅ 可以点击"立即读取"按钮进行数据读取
              </div>
            )}
            {!hasEnabledRanges && (
              <div className="flex items-center gap-2 text-amber-600 mt-1">
                <AlertTriangle className="h-4 w-4" />
                无可读取的地址段，请先在地址范围管理中配置并启用地址段
              </div>
            )}
          </div>

          {/* 错误显示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 显示结果按钮 */}
          {batchResult && readStatus === 'completed' && (
            <div className="pt-2">
              <Button 
                variant="outline"
                onClick={() => setShowResultDialog(true)}
                className="w-full"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                查看读取结果 ({batchResult.success_count}/{batchResult.total_count})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 读取结果弹窗 */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              读取结果
              {batchResult && (
                <Badge variant="outline" className="ml-2">
                  {batchResult.success_count}/{batchResult.total_count}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {batchResult && parsedData.length > 0 ? (
              <div className="space-y-4">
                {/* 读取统计 */}
                <div className="flex items-center gap-6 p-4 bg-muted rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">读取统计:</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      成功 {batchResult.success_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      失败 {batchResult.failed_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-blue-500" />
                      用时 {(batchResult.duration_ms / 1000).toFixed(2)}s
                    </span>
                  </div>
                </div>

                {/* 结果表格 */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">地址</TableHead>
                        <TableHead className="w-24">原始值</TableHead>
                        <TableHead className="w-32">解析值</TableHead>
                        <TableHead className="w-24">类型</TableHead>
                        <TableHead className="w-40">时间戳</TableHead>
                        <TableHead className="w-20">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((data, index) => {
                        // 查找对应的地址段信息
                        const matchedRange = enabledRanges.find(range => 
                          data.address >= range.startAddress && 
                          data.address < range.startAddress + range.length
                        );
                        const addressResult = batchResult.results[index];

                        return (
                          <TableRow key={`${data.address}-${index}`}>
                            <TableCell className="font-mono text-sm">
                              {data.address}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {data.success ? data.rawValue : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {data.success ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span>{data.displayValue}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <div>十进制: {formatDisplayValue(data.parsedValue, { format: 'dec' })}</div>
                                      <div>十六进制: {formatDisplayValue(data.parsedValue, { format: 'hex' })}</div>
                                      <div>二进制: {formatDisplayValue(data.parsedValue, { format: 'bin' })}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-red-500">错误</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="outline" className="text-xs">
                                {matchedRange?.dataType || data.dataType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatTimestamp(addressResult?.timestamp || batchResult.timestamp)}
                            </TableCell>
                            <TableCell>
                              {data.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{data.error || addressResult?.error || '读取失败'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无数据</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}