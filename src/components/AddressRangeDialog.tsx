import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ManagedAddressRange } from '../types/modbus';
import { 
  validateAddressRange, 
  DATA_TYPE_LABELS 
} from '../utils/addressValidation';

interface AddressRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (range: Omit<ManagedAddressRange, 'id'>) => void;
  editingRange?: ManagedAddressRange;
}

export const AddressRangeDialog: React.FC<AddressRangeDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  editingRange,
}) => {
  const [formData, setFormData] = useState<Omit<ManagedAddressRange, 'id'>>({
    name: '',
    startAddress: 0,
    length: 10,
    dataType: 'uint16',
    description: '',
    enabled: true,
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // 重置表单
  const resetForm = () => {
    if (editingRange) {
      setFormData({
        name: editingRange.name || '',
        startAddress: editingRange.startAddress,
        length: editingRange.length,
        dataType: editingRange.dataType,
        description: editingRange.description || '',
        enabled: editingRange.enabled ?? true,
      });
    } else {
      setFormData({
        name: '',
        startAddress: 0,
        length: 10,
        dataType: 'uint16',
        description: '',
        enabled: true,
      });
    }
    setErrors([]);
    setWarnings([]);
  };

  // 当对话框打开或编辑对象变更时重置表单
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, editingRange]);

  // 验证表单
  const validateForm = () => {
    const tempRange: ManagedAddressRange = {
      ...formData,
      id: 'temp',
    };
    
    const validation = validateAddressRange(tempRange);
    setErrors(validation.errors);
    setWarnings(validation.warnings || []);
    
    return validation.isValid;
  };

  // 处理输入变更
  const handleInputChange = (
    field: keyof Omit<ManagedAddressRange, 'id'>, 
    value: string | number | boolean
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  
  // 保存
  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-border shadow-xl">
        <DialogHeader>
          <DialogTitle>
            {editingRange ? '编辑地址段' : '添加地址段'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 数据类型 - 放在最前面 */}
          <div className="space-y-2">
            <Label>数据类型 *</Label>
            <Select 
              value={formData.dataType} 
              onValueChange={(value) => handleInputChange('dataType', value as ManagedAddressRange['dataType'])}
            >
              <SelectTrigger className="bg-white border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-border shadow-lg">
                {Object.entries(DATA_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="hover:bg-accent">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 起始地址 */}
          <div className="space-y-2">
            <Label htmlFor="startAddress">起始地址 *</Label>
            <Input
              id="startAddress"
              type="number"
              value={formData.startAddress}
              onChange={(e) => handleInputChange('startAddress', parseInt(e.target.value) || 0)}
              min="1"
              max="65535"
              autoComplete="off"
              placeholder="输入起始地址"
            />
          </div>

          {/* 长度 */}
          <div className="space-y-2">
            <Label htmlFor="length">长度 *</Label>
            <Input
              id="length"
              type="number"
              value={formData.length}
              onChange={(e) => handleInputChange('length', parseInt(e.target.value) || 1)}
              min="1"
              max="120"
              autoComplete="off"
              placeholder="输入读取长度"
            />
            <p className="text-sm text-muted-foreground">
              地址范围：{formData.startAddress} - {formData.startAddress + formData.length - 1}
            </p>
          </div>

          {/* 名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">名称（可选）</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="例如：温度传感器"
              autoComplete="off"
            />
          </div>

  
          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">描述（可选）</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="例如：用于监控设备温度"
            />
          </div>

          {/* 错误提示 */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-800 mb-1">配置错误：</p>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 警告提示 */}
          {warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-800 mb-1">注意事项：</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={errors.length > 0}
            className={`${editingRange ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium shadow-md hover:shadow-lg' : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg'}`}
          >
            {editingRange ? '保存修改' : '添加地址段'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};