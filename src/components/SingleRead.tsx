import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { ConnectionConfig, ReadRequest, ReadResult } from '@/types/modbus';
import { notifications } from '@/utils/notifications';

interface SingleReadProps {
  connectionConfig: ConnectionConfig;
  disabled?: boolean;
}

export function SingleRead({ connectionConfig, disabled = false }: SingleReadProps) {
  const [startAddress, setStartAddress] = useState<number>(0);
  const [count, setCount] = useState<number>(1);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRead = async () => {
    // 验证输入
    if (startAddress < 0 || startAddress > 65535) {
      setError('起始地址必须在 0-65535 范围内');
      return;
    }

    if (count < 1 || count > 125) {
      setError('读取数量必须在 1-125 范围内');
      return;
    }

    if (startAddress + count > 65536) {
      setError('地址范围超出限制（最大65535）');
      return;
    }

    setIsReading(true);
    setError(null);
    setResult(null);

    try {
      const request: ReadRequest = {
        ip: connectionConfig.ip,
        port: connectionConfig.port,
        ranges: [{
          start: startAddress,
          count: count
        }]
      };

      const readResult = await invoke<ReadResult>('read_single', { request });
      setResult(readResult);

      if (readResult.success) {
        notifications.success(
          '读取成功',
          `读取到 ${readResult.data.length} 个寄存器值`
        );
      } else {
        notifications.error('读取失败', readResult.message);
        setError(readResult.message);
      }
    } catch (err) {
      const errorMessage = `读取失败: ${err}`;
      setError(errorMessage);
      notifications.error('读取失败', errorMessage);
    } finally {
      setIsReading(false);
    }
  };

  const handleQuickFill = (start: number, count: number) => {
    setStartAddress(start);
    setCount(count);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            单次读取设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 快捷设置 */}
          <div>
            <Label className="text-sm text-muted-foreground">快捷设置：</Label>
            <div className="flex gap-2 mt-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleQuickFill(0, 10)}
              >
                0-10
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleQuickFill(100, 20)}
              >
                100-120
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleQuickFill(1000, 50)}
              >
                1000-1050
              </Button>
            </div>
          </div>

          {/* 地址输入 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startAddress">起始地址</Label>
              <Input
                id="startAddress"
                type="number"
                min="0"
                max="65535"
                value={startAddress}
                onChange={(e) => setStartAddress(parseInt(e.target.value) || 0)}
                disabled={disabled || isReading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">读取数量</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="125"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                disabled={disabled || isReading}
              />
            </div>
          </div>

          {/* 地址范围显示 */}
          <div className="text-sm text-muted-foreground">
            读取范围: {startAddress} - {startAddress + count - 1} ({count} 个寄存器)
          </div>

          {/* 读取按钮 */}
          <Button 
            onClick={handleRead} 
            disabled={disabled || isReading}
            className="w-full mt-4 h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.01] bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-2 border-green-400 disabled:from-gray-400 disabled:to-gray-500 disabled:border-gray-300 disabled:transform-none disabled:shadow-none"
            size="lg"
          >
            {isReading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                读取中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                开始读取
              </>
            )}
          </Button>

          {/* 错误显示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 读取结果 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              读取结果
              <Badge variant={result.success ? "default" : "destructive"}>
                {result.success ? "成功" : "失败"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">读取时间</Label>
                <div>{result.timestamp}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">地址范围</Label>
                <div>
                  {result.address_range.start} - {result.address_range.start + result.address_range.count - 1}
                </div>
              </div>
            </div>

            {/* 消息 */}
            {result.message && (
              <div>
                <Label className="text-muted-foreground">消息</Label>
                <div className="text-sm">{result.message}</div>
              </div>
            )}

            {/* 数据显示 */}
            {result.success && result.data.length > 0 && (
              <div>
                <Label className="text-muted-foreground">
                  数据值 ({result.data.length} 个)
                </Label>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                    {result.data.map((value, index) => (
                      <div 
                        key={index} 
                        className="flex justify-between p-2 bg-background rounded border"
                      >
                        <span className="text-muted-foreground">
                          [{result.address_range.start + index}]
                        </span>
                        <span className="font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 数据统计 */}
                {result.data.length > 1 && (
                  <div className="mt-2 text-xs text-muted-foreground grid grid-cols-3 gap-4">
                    <div>最小值: {Math.min(...result.data)}</div>
                    <div>最大值: {Math.max(...result.data)}</div>
                    <div>平均值: {Math.round(result.data.reduce((a, b) => a + b, 0) / result.data.length)}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}