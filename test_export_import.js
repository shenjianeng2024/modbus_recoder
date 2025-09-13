// 简单的导出导入功能测试脚本
const testConfig = {
  version: "1.0",
  export_date: "2025-09-13T07:04:00Z",
  description: "测试用Modbus地址段配置文件",
  address_ranges: [
    {
      name: "温度传感器组1",
      start_address: 40001,
      count: 10,
      data_type: "float32",
      description: "锅炉温度传感器读数",
      enabled: true,
      polling_interval: 1000
    },
    {
      name: "压力表读数",
      start_address: 40011,
      count: 5,
      data_type: "uint16",
      description: "系统压力表读数",
      enabled: true,
      polling_interval: 2000
    }
  ],
  metadata: {
    total_ranges: 2,
    total_addresses: 15,
    enabled_ranges: 2,
    export_tool: "Test Script"
  }
};

console.log('测试配置文件格式:');
console.log(JSON.stringify(testConfig, null, 2));

// 验证必要的字段
const requiredFields = ['version', 'export_date', 'description', 'address_ranges', 'metadata'];
const missingFields = requiredFields.filter(field => !testConfig.hasOwnProperty(field));

if (missingFields.length === 0) {
  console.log('\n✅ 配置文件格式验证通过');
  
  // 验证地址段格式
  const validAddressRanges = testConfig.address_ranges.every(range => {
    return typeof range.start_address === 'number' &&
           typeof range.count === 'number' &&
           typeof range.data_type === 'string' &&
           ['uint16', 'int16', 'uint32', 'int32', 'float32'].includes(range.data_type);
  });
  
  if (validAddressRanges) {
    console.log('✅ 地址段格式验证通过');
  } else {
    console.log('❌ 地址段格式验证失败');
  }
  
} else {
  console.log(`\n❌ 配置文件缺少必要字段: ${missingFields.join(', ')}`);
}

console.log('\n配置文件大小:', JSON.stringify(testConfig).length, '字节');