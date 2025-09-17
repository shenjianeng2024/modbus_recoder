import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';

export const DebugPanel: React.FC = () => {
  const [ip, setIp] = useState('192.168.1.199');
  const [port, setPort] = useState(502);
  const [slaveId, setSlaveId] = useState(1);
  const [results, setResults] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const appendResult = (message: string) => {
    setResults(prev => `${prev}${prev ? '\n' : ''}${new Date().toLocaleTimeString()}: ${message}`);
  };

  const testTcpConnection = async () => {
    setIsLoading(true);
    appendResult(`🔍 开始TCP连接测试: ${ip}:${port}`);

    try {
      const result = await invoke<string>('debug_tcp_test', { ip, port });
      appendResult(`✅ TCP测试成功: ${result}`);
    } catch (error) {
      appendResult(`❌ TCP测试失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testModbusConnection = async () => {
    setIsLoading(true);
    appendResult(`🔍 开始Modbus连接测试: ${ip}:${port} (从站ID: ${slaveId})`);

    try {
      const result = await invoke<string>('debug_modbus_test', { ip, port, slaveId });
      appendResult(`✅ Modbus测试成功: ${result}`);
    } catch (error) {
      appendResult(`❌ Modbus测试失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults('');
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>🔧 网络连接调试面板</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">IP地址</label>
            <Input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.199"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">端口</label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 502)}
              placeholder="502"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">从站ID</label>
            <Input
              type="number"
              value={slaveId}
              onChange={(e) => setSlaveId(parseInt(e.target.value) || 1)}
              placeholder="1"
              min="1"
              max="247"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testTcpConnection}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? '测试中...' : '🚀 测试TCP连接'}
          </Button>
          <Button
            onClick={testModbusConnection}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? '测试中...' : '🔌 测试Modbus连接'}
          </Button>
          <Button
            onClick={clearResults}
            variant="secondary"
          >
            🗑️ 清空结果
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">测试结果</label>
          <Textarea
            value={results}
            readOnly
            className="h-64 font-mono text-sm"
            placeholder="测试结果将在这里显示..."
          />
        </div>

        <div className="text-sm text-gray-600">
          <p>💡 <strong>提示:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>TCP测试会直接测试网络层连接</li>
            <li>Modbus测试会使用tokio-modbus库进行完整的Modbus TCP连接</li>
            <li>标准Modbus TCP端口是502</li>
            <li>从站ID通常在1-247之间</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};