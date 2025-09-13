# Modbus配置模板

这个目录包含了Modbus地址段配置的示例模板文件。

## 文件说明

- `example_config.json` - 完整的配置示例文件

## JSON格式说明

配置文件使用JSON格式，包含以下主要部分：

### 基本结构
```json
{
  "version": "1.0",
  "export_date": "2025-09-13T07:04:00Z",
  "description": "配置文件描述",
  "address_ranges": [...],
  "metadata": {...}
}
```

### 地址段格式
每个地址段包含以下字段：
- `name`: 地址段名称
- `start_address`: 起始地址
- `count`: 地址数量
- `data_type`: 数据类型 (uint16, int16, uint32, int32, float32)
- `description`: 描述信息
- `enabled`: 是否启用
- `polling_interval`: 轮询间隔（毫秒）

### 元数据
包含配置的统计信息：
- `total_ranges`: 总地址段数
- `total_addresses`: 总地址数
- `enabled_ranges`: 启用的地址段数
- `export_tool`: 导出工具信息

## 使用方法

1. 复制示例配置文件
2. 根据您的设备修改地址和参数
3. 在应用中导入配置文件
4. 测试和验证配置是否正确

## 注意事项

- 确保地址范围不重叠
- 选择正确的数据类型
- 合理设置轮询间隔
- 定期备份配置文件