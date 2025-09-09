pub mod client;
pub mod error;
pub mod manager;
pub mod types;

pub use client::ModbusClient;
pub use error::{ModbusError, Result};
pub use manager::{AppState, ModbusManager};
pub use types::{AddressRange, AddressReadResult, BatchReadResult, ConnectionState, ModbusConfig, ReadResult};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_address_range_validation() {
        // 测试有效的地址范围
        let valid_range = AddressRange::new(0, 10);
        assert!(valid_range.is_valid());

        // 测试无效的地址范围 - 数量为0
        let invalid_range1 = AddressRange::new(0, 0);
        assert!(!invalid_range1.is_valid());

        // 测试无效的地址范围 - 数量过大
        let invalid_range2 = AddressRange::new(0, 126);
        assert!(!invalid_range2.is_valid());

        // 测试地址溢出
        let invalid_range3 = AddressRange::new(65535, 1);
        assert!(!invalid_range3.is_valid());
    }

    #[test]
    fn test_modbus_config_default() {
        let config = ModbusConfig::default();
        assert_eq!(config.ip, "192.168.1.199");
        assert_eq!(config.port, 502);
        assert_eq!(config.timeout_ms, 3000);
        assert_eq!(config.slave_id, 1);
    }

    #[test]
    fn test_connection_state() {
        let state1 = ConnectionState::Disconnected;
        let state2 = ConnectionState::Connected;
        let state3 = ConnectionState::Connecting;
        let state4 = ConnectionState::Error("test error".to_string());

        assert_ne!(state1, state2);
        assert_ne!(state2, state3);
        assert_ne!(state3, state4);
    }

    #[test]
    fn test_modbus_client_creation() {
        let client = ModbusClient::new();
        assert!(!client.is_connected());
        assert_eq!(client.get_state(), &ConnectionState::Disconnected);
    }

    #[test]
    fn test_modbus_client_config_validation() {
        let client = ModbusClient::new();
        
        // 默认配置应该是有效的
        assert!(client.validate_config().is_ok());
    }

    #[test]
    fn test_error_user_friendly_messages() {
        let error1 = ModbusError::NotConnected;
        let friendly_msg1 = error1.user_friendly_message();
        assert!(friendly_msg1.contains("设备未连接"));

        let error2 = ModbusError::InvalidAddressRange { start: 0, count: 0 };
        let friendly_msg2 = error2.user_friendly_message();
        assert!(friendly_msg2.contains("不能为0"));

        let error3 = ModbusError::Timeout;
        let friendly_msg3 = error3.user_friendly_message();
        assert!(friendly_msg3.contains("超时"));
    }
}