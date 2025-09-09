use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModbusConfig {
    pub ip: String,
    pub port: u16,
    pub timeout_ms: u32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPoint {
    pub timestamp: String,
    pub address: u16,
    pub value: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStatus {
    pub is_running: bool,
    pub interval_ms: u64,
    pub data_count: usize,
}
