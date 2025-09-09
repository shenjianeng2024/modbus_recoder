use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusConfig {
    pub ip: String,
    pub port: u16,
    pub timeout_ms: u32,
    pub slave_id: u8,
}

impl Default for ModbusConfig {
    fn default() -> Self {
        Self {
            ip: "192.168.1.100".to_string(),
            port: 502,
            timeout_ms: 3000,
            slave_id: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressRange {
    pub start: u16,
    pub count: u16,
    #[serde(default = "default_data_type")]
    pub data_type: String,
}

fn default_data_type() -> String {
    "uint16".to_string()
}

impl AddressRange {
    pub fn new(start: u16, count: u16) -> Self {
        Self { 
            start, 
            count,
            data_type: "uint16".to_string(),
        }
    }

    pub fn new_with_type(start: u16, count: u16, data_type: &str) -> Self {
        Self { 
            start, 
            count,
            data_type: data_type.to_string(),
        }
    }

    pub fn is_valid(&self) -> bool {
        self.count > 0 && self.count <= 125 && self.start.saturating_add(self.count) > self.start
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadResult {
    pub success: bool,
    pub data: Vec<u16>,
    pub address_range: AddressRange,
    pub timestamp: String,
    pub message: String,
}

/// 单地址读取结果，用于详细的数据读取展示
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressReadResult {
    pub address: u16,
    pub raw_value: u32, // 改为 u32 以支持 float32 等 32 位数据类型
    pub parsed_value: String, // 支持不同格式的显示
    pub timestamp: String,
    pub success: bool,
    pub error: Option<String>,
    pub data_type: String,
}

/// 批量读取结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchReadResult {
    pub results: Vec<AddressReadResult>,
    pub total_count: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub timestamp: String,
    pub duration_ms: u64,
}

/// 地址范围管理相关接口
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagedAddressRange {
    pub id: String,
    pub name: Option<String>,
    #[serde(alias = "startAddress")]
    pub start_address: u16,
    pub length: u16,
    #[serde(alias = "dataType")]
    pub data_type: String,
    pub description: Option<String>,
    pub enabled: Option<bool>,
}
