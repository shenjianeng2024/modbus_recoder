import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAddressRangeContext } from '../contexts/AddressRangeContext';
import { 
  formatAddressRange, 
  DATA_TYPE_LABELS 
} from '../utils/addressValidation';

interface ConfigImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConfigImportDialog: React.FC<ConfigImportDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { importConfig, previewConfig, generateTemplate } = useAddressRangeContext();
  const [activeTab, setActiveTab] = useState('file');
  const [configText, setConfigText] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置状态
  const resetState = () => {
    setConfigText('');
    setPreview(null);
    setActiveTab('file');
    setIsImporting(false);
  };

  // 文件选择处理
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setConfigText(content);
        setActiveTab('preview');
        handlePreview(content);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  // 预览配置
  const handlePreview = (config?: string) => {
    const configToPreview = config || configText;
    if (!configToPreview.trim()) {
      setPreview(null);
      return;
    }

    const result = previewConfig(configToPreview);
    setPreview(result);
  };

  // 导入配置
  const handleImport = async () => {
    if (!configText.trim() || !preview?.isValid) {
      return;
    }

    setIsImporting(true);
    try {
      const success = importConfig(configText);
      if (success) {
        onOpenChange(false);
        resetState();
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const template = generateTemplate();
    const blob = new Blob([template], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modbus_config_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 使用模板
  const handleUseTemplate = () => {
    const template = generateTemplate();
    setConfigText(template);
    setActiveTab('edit');
    handlePreview(template);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              导入配置文件
            </DialogTitle>
            <DialogDescription>
              支持JSON格式的Modbus地址段配置文件，可以预览配置内容并验证格式。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="file">选择文件</TabsTrigger>
                <TabsTrigger value="edit">编辑配置</TabsTrigger>
                <TabsTrigger value="preview" disabled={!configText.trim()}>
                  预览配置
                </TabsTrigger>
                <TabsTrigger value="template">配置模板</TabsTrigger>
              </TabsList>

              <div className="mt-4 h-[60vh] overflow-hidden">
                <TabsContent value="file" className="h-full mt-0">
                  <Card className="h-full">
                    <CardContent className="h-full flex flex-col items-center justify-center p-6">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                          <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium">选择配置文件</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            支持JSON格式的Modbus地址段配置文件
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Button onClick={handleFileSelect} className="w-full">
                            <Upload className="w-4 h-4 mr-2" />
                            选择文件
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            支持的文件类型：.json
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="edit" className="h-full mt-0">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">编辑配置文件</CardTitle>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handlePreview()}
                          disabled={!configText.trim()}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          预览
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="h-full pb-6">
                      <Textarea
                        value={configText}
                        onChange={(e) => setConfigText(e.target.value)}
                        placeholder="请粘贴或输入JSON格式的配置文件内容..."
                        className="h-full font-mono text-sm resize-none"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="preview" className="h-full mt-0">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        配置预览
                        {preview && (
                          <Badge variant={preview.isValid ? "default" : "destructive"}>
                            {preview.isValid ? "有效" : "无效"}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-full pb-6 overflow-auto">
                      {!preview ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          请先选择文件或编辑配置内容
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* 元数据信息 */}
                          {preview.metadata && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <h4 className="text-sm font-medium mb-2">配置信息</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {preview.metadata.version && (
                                  <div>版本: {preview.metadata.version}</div>
                                )}
                                {preview.metadata.description && (
                                  <div>描述: {preview.metadata.description}</div>
                                )}
                                {preview.metadata.total_ranges && (
                                  <div>地址段数: {preview.metadata.total_ranges}</div>
                                )}
                                {preview.metadata.total_addresses && (
                                  <div>总地址数: {preview.metadata.total_addresses}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 错误信息 */}
                          {preview.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div>
                                  <h4 className="text-sm font-medium text-red-800">错误</h4>
                                  <ul className="text-sm text-red-700 mt-1 space-y-1">
                                    {preview.errors.map((error: string, index: number) => (
                                      <li key={index}>• {error}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 警告信息 */}
                          {preview.warnings.length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                                <div>
                                  <h4 className="text-sm font-medium text-orange-800">警告</h4>
                                  <ul className="text-sm text-orange-700 mt-1 space-y-1">
                                    {preview.warnings.map((warning: string, index: number) => (
                                      <li key={index}>• {warning}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 地址段列表 */}
                          {preview.ranges.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                地址段列表 ({preview.ranges.length} 个)
                              </h4>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>名称</TableHead>
                                      <TableHead>地址范围</TableHead>
                                      <TableHead>数据类型</TableHead>
                                      <TableHead>状态</TableHead>
                                      <TableHead>描述</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {preview.ranges.map((range: any, index: number) => (
                                      <TableRow key={index}>
                                        <TableCell className="font-medium">
                                          {range.name || `地址段 ${index + 1}`}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                          {formatAddressRange(range)}
                                        </TableCell>
                                        <TableCell>
                                          {DATA_TYPE_LABELS[range.dataType as keyof typeof DATA_TYPE_LABELS] || range.dataType}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={range.enabled ? "default" : "secondary"}>
                                            {range.enabled ? "启用" : "禁用"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
                                          {range.description || '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="template" className="h-full mt-0">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">配置模板</CardTitle>
                      <DialogDescription>
                        使用预定义的模板快速开始配置，或下载模板文件进行离线编辑。
                      </DialogDescription>
                    </CardHeader>
                    <CardContent className="h-full pb-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Button variant="outline" onClick={handleUseTemplate}>
                            <FileText className="w-4 h-4 mr-2" />
                            使用模板
                          </Button>
                          <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="w-4 h-4 mr-2" />
                            下载模板
                          </Button>
                        </div>
                        
                        <div className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-2">模板说明</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• 包含3个常用类型的地址段示例</li>
                            <li>• 支持温度传感器、压力表、状态位等典型场景</li>
                            <li>• 包含完整的配置注释和使用说明</li>
                            <li>• 可直接修改地址和参数来适配您的设备</li>
                          </ul>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-blue-800 mb-2">JSON格式说明</h4>
                          <div className="text-sm text-blue-700 space-y-1">
                            <div><code className="bg-blue-100 px-1 rounded">start_address</code>: 起始地址</div>
                            <div><code className="bg-blue-100 px-1 rounded">count</code>: 地址数量</div>
                            <div><code className="bg-blue-100 px-1 rounded">data_type</code>: 数据类型 (uint16, int16, uint32, int32, float32)</div>
                            <div><code className="bg-blue-100 px-1 rounded">enabled</code>: 是否启用</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              取消
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!preview?.isValid || isImporting}
              className="min-w-20"
            >
              {isImporting ? "导入中..." : "导入配置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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