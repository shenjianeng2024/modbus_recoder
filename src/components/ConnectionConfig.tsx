import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectionConfig as ConnectionConfigType } from '../types/modbus';
import { Wifi } from 'lucide-react';

interface ConnectionConfigProps {
  onConfigChange: (config: ConnectionConfigType) => void;
  onTestConnection: (config: ConnectionConfigType) => void;
  isLoading?: boolean;
}

export const ConnectionConfig: React.FC<ConnectionConfigProps> = ({
  onConfigChange,
  onTestConnection,
  isLoading = false,
}) => {
  const [config, setConfig] = useState<ConnectionConfigType>({
    ip: '192.168.1.199',
    port: 502,
  });

  const handleInputChange = (field: keyof ConnectionConfigType, value: string | number) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleTestConnection = () => {
    onTestConnection(config);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          配置 Modbus TCP/IP 设备连接参数
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="ip">IP 地址</Label>
        <Input
          id="ip"
          type="text"
          value={config.ip}
          onChange={(e) => handleInputChange('ip', e.target.value)}
          placeholder="192.168.1.199"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="port">端口</Label>
        <Input
          id="port"
          type="number"
          value={config.port}
          onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 502)}
          placeholder="502"
          min="1"
          max="65535"
        />
      </div>

      <div className="mt-6 space-y-3">
        <Button 
          onClick={handleTestConnection} 
          disabled={isLoading}
          className="w-full h-14 text-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 border-2 border-blue-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none text-white shadow-blue-500/50"
          size="lg"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              正在连接设备...
            </>
          ) : (
            <>
              <Wifi className="mr-3 h-6 w-6" />
              测试连接
            </>
          )}
        </Button>
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            💡 连接成功后即可配置地址段并读取数据
          </p>
        </div>
      </div>
    </div>
  );
};