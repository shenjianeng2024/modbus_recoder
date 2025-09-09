import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectionConfig as ConnectionConfigType } from '../types/modbus';
import { Wifi } from 'lucide-react';

interface ConnectionConfigProps {
  onConfigChange: (config: ConnectionConfigType) => void;
  onTestConnection: (config: ConnectionConfigType) => void;
}

export const ConnectionConfig: React.FC<ConnectionConfigProps> = ({
  onConfigChange,
  onTestConnection,
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
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">连接配置</h3>
      
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

      <Button 
        onClick={handleTestConnection} 
        className="w-full mt-6 h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-2 border-blue-400"
        size="lg"
      >
        <Wifi className="mr-2 h-5 w-5" />
        测试连接
      </Button>
    </div>
  );
};