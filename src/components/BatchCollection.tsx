import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Play, 
  Square, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Database,
  FileText,
  Settings,
  File,
  FolderOpen
} from 'lucide-react';
import { ManagedAddressRange, BatchReadResult, DisplayFormat } from '@/types/modbus';
import { notifications } from '@/utils/notifications';

interface BatchCollectionProps {
  addressRanges: ManagedAddressRange[];
  disabled?: boolean;
}

interface CollectionSettings {
  interval: number; // 采集间隔（毫秒）
  format: DisplayFormat;
  maxRecords: number; // 最大记录数，现在用于限制内存显示的历史记录
  outputFilePath: string | null; // 输出文件路径
}

export function BatchCollection({ addressRanges, disabled = false }: BatchCollectionProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [settings, setSettings] = useState<CollectionSettings>({
    interval: 1000,
    format: 'dec',
    maxRecords: 100, // 仅用于限制界面显示的历史记录数量
    outputFilePath: null
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentResult, setCurrentResult] = useState<BatchReadResult | null>(null);
  const [collectionHistory, setCollectionHistory] = useState<BatchReadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collectionStats, setCollectionStats] = useState({
    totalCollections: 0,
    successfulReads: 0,
    failedReads: 0,
    averageTime: 0
  });

  // 获取启用的地址范围
  const enabledRanges = addressRanges.filter(range => range.enabled !== false);

  const validateSettings = (): string | null => {
    if (enabledRanges.length === 0) {
      return '没有启用的地址范围，请在地址管理中启用至少一个范围';
    }

    if (settings.interval < 10) {
      return '采集间隔不能少于10毫秒';
    }

    if (!settings.outputFilePath) {
      return '请先选择输出文件路径';
    }

    return null;
  };

  // 选择输出文件
  const selectOutputFile = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const defaultFilename = `modbus_collection_${timestamp}.csv`;
      
      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: 'CSV文件',
            extensions: ['csv']
          },
          {
            name: '所有文件', 
            extensions: ['*']
          }
        ]
      });

      if (filePath) {
        setSettings(prev => ({ ...prev, outputFilePath: filePath }));
        notifications.success('文件已选择', `数据将保存到: ${filePath}`);
      }
    } catch (err) {
      notifications.error('文件选择失败', `${err}`);
    }
  };

  const performSingleCollection = useCallback(async (): Promise<BatchReadResult | null> => {
    if (!settings.outputFilePath) {
      notifications.error('错误', '未选择输出文件');
      return null;
    }

    try {
      const request = {
        ranges: enabledRanges.map(range => ({
          start: range.startAddress,
          count: range.length
        })),
        format: settings.format
      };

      const result = await invoke<BatchReadResult>('read_modbus_ranges', { request });
      
      // 立即将数据追加到文件
      await invoke('append_data_to_file', {
        filePath: settings.outputFilePath,
        data: result
      });
      
      setCurrentResult(result);
      
      // 只保留最近的记录用于界面显示
      setCollectionHistory(prev => {
        const newHistory = [result, ...prev];
        return newHistory.slice(0, settings.maxRecords);
      });

      // 更新统计信息
      setCollectionStats(prev => ({
        totalCollections: prev.totalCollections + 1,
        successfulReads: prev.successfulReads + result.success_count,
        failedReads: prev.failedReads + result.failed_count,
        averageTime: Math.round(
          (prev.averageTime * prev.totalCollections + result.duration_ms) / 
          (prev.totalCollections + 1)
        )
      }));

      if (result.failed_count > 0) {
        notifications.warning(
          '部分读取失败',
          `成功: ${result.success_count}, 失败: ${result.failed_count}`
        );
      }

      return result;
    } catch (err) {
      const errorMessage = `采集失败: ${err}`;
      setError(errorMessage);
      notifications.error('采集失败', errorMessage);
      return null;
    }
  }, [enabledRanges, settings.format, settings.maxRecords, settings.outputFilePath]);

  const startCollection = async () => {
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsRunning(true);
    
    // 写入CSV文件头
    try {
      await invoke('initialize_csv_file', {
        filePath: settings.outputFilePath,
        addressRanges: enabledRanges
      });
    } catch (err) {
      notifications.error('文件初始化失败', `${err}`);
      setIsRunning(false);
      return;
    }
    
    notifications.info('开始采集', `每${settings.interval}ms采集一次，数据保存到: ${settings.outputFilePath}`);

    // 执行第一次采集
    await performSingleCollection();
    
    // 设置定时采集
    intervalRef.current = setInterval(async () => {
      await performSingleCollection();
    }, settings.interval);
  };

  const stopCollection = () => {
    setIsRunning(false);
    
    // 清除定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    notifications.success('采集已停止', `数据已保存到: ${settings.outputFilePath}`);
  };

  const clearHistory = () => {
    setCollectionHistory([]);
    setCurrentResult(null);
    setCollectionStats({
      totalCollections: 0,
      successfulReads: 0,
      failedReads: 0,
      averageTime: 0
    });
    notifications.success('清理完成', '界面历史数据已清空（文件中的数据不受影响）');
  };

  // 重新选择输出文件
  const changeOutputFile = async () => {
    if (isRunning) {
      notifications.warning('无法更改', '采集进行中，无法更改输出文件');
      return;
    }
    await selectOutputFile();
  };

  return (
    <div className="space-y-6">
      {/* 采集设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            批量采集设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 文件选择区域 */}
          <div className="space-y-2">
            <Label>输出文件</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                {settings.outputFilePath ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <File className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700 truncate">
                      {settings.outputFilePath}
                    </span>
                    {!isRunning && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={changeOutputFile}
                        className="h-6 px-2 text-green-600 hover:text-green-800"
                      >
                        更改
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700">请选择输出文件</span>
                  </div>
                )}
              </div>
              {!settings.outputFilePath && (
                <Button onClick={selectOutputFile} disabled={disabled || isRunning}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  选择文件
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interval">采集间隔 (ms)</Label>
              <Input
                id="interval"
                type="number"
                min="100"
                max="60000"
                value={settings.interval}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  interval: parseInt(e.target.value) || 1000 
                }))}
                disabled={disabled || isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">显示格式</Label>
              <Select
                value={settings.format}
                onValueChange={(value: DisplayFormat) => setSettings(prev => ({ 
                  ...prev, 
                  format: value 
                }))}
                disabled={disabled || isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dec">十进制 (Dec)</SelectItem>
                  <SelectItem value="hex">十六进制 (Hex)</SelectItem>
                  <SelectItem value="bin">二进制 (Bin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">启用的范围</Label>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Database className="h-4 w-4" />
                {enabledRanges.length} 个地址段
              </div>
              <div className="text-xs text-muted-foreground">
                总地址数: {enabledRanges.reduce((sum, range) => sum + range.length, 0)}
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            {!isRunning ? (
              <Button 
                onClick={startCollection}
                disabled={disabled || !settings.outputFilePath}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg"
              >
                <Play className="mr-2 h-4 w-4" />
                开始采集
              </Button>
            ) : (
              <Button 
                onClick={stopCollection}
                variant="destructive"
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg"
              >
                <Square className="mr-2 h-4 w-4" />
                停止采集
              </Button>
            )}

            <Button 
              onClick={clearHistory} 
              variant="outline"
              disabled={collectionHistory.length === 0}
            >
              <FileText className="mr-2 h-4 w-4" />
              清空显示
            </Button>

            {settings.outputFilePath && (
              <div className="text-sm text-muted-foreground flex items-center">
                <CheckCircle className="mr-1 h-3 w-3 text-green-600" />
                数据将实时保存到文件
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
        </CardContent>
      </Card>

      {/* 采集统计 */}
      {(collectionStats.totalCollections > 0 || isRunning) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              采集统计
              {isRunning && <Badge variant="default">运行中</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {collectionStats.totalCollections}
                </div>
                <div className="text-sm text-muted-foreground">总采集次数</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {collectionStats.successfulReads}
                </div>
                <div className="text-sm text-muted-foreground">成功读取</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">
                  {collectionStats.failedReads}
                </div>
                <div className="text-sm text-muted-foreground">失败读取</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600">
                  {collectionStats.averageTime}ms
                </div>
                <div className="text-sm text-muted-foreground">平均耗时</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前结果 */}
      {currentResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentResult.success_count === currentResult.total_count ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              最新采集结果
              <Badge variant={currentResult.failed_count === 0 ? "default" : "destructive"}>
                {currentResult.success_count}/{currentResult.total_count}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 结果概览 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">采集时间</Label>
                  <div>{new Date(currentResult.timestamp).toLocaleString()}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">耗时</Label>
                  <div>{currentResult.duration_ms}ms</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">成功率</Label>
                  <div>
                    {Math.round((currentResult.success_count / currentResult.total_count) * 100)}%
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">格式</Label>
                  <div className="uppercase">{settings.format}</div>
                </div>
              </div>

              {/* 详细数据表格 */}
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>地址</TableHead>
                      <TableHead>原始值</TableHead>
                      <TableHead>格式化值</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentResult.results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">
                          {result.address}
                        </TableCell>
                        <TableCell className="font-mono">
                          {result.raw_value}
                        </TableCell>
                        <TableCell className="font-mono">
                          {result.parsed_value}
                        </TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge variant="default">成功</Badge>
                          ) : (
                            <Badge variant="destructive">
                              失败: {result.error}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}