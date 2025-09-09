use std::time::Duration;
use tokio_test;
use serial_test::serial;

mod common;

use common::{MockModbusServer, utils};
use modbus_reader::modbus::{
    ModbusClient, ModbusConfig, AddressRange, ConnectionState, ModbusError,
};

/// 测试Modbus客户端基础功能
#[tokio::test]
async fn test_modbus_client_basic_operations() {
    let mut client = ModbusClient::new();
    
    // 初始状态应该是未连接
    assert!(!client.is_connected());
    assert_eq!(*client.get_state(), ConnectionState::Disconnected);
    
    // 默认配置验证
    assert!(client.validate_config().is_ok());
}

/// 测试Modbus客户端连接功能
#[tokio::test]
#[serial]
async fn test_modbus_client_connection() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let mut client = ModbusClient::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置
    client.set_config(config.clone());
    assert_eq!(client.get_config(), &config);
    
    // 测试连接
    let connect_result = client.connect().await;
    assert!(connect_result.is_ok(), "连接失败: {:?}", connect_result.err());
    assert!(client.is_connected());
    
    // 测试连接状态
    match client.get_state() {
        ConnectionState::Connected => {},
        state => panic!("期望连接状态为Connected，实际为: {:?}", state),
    }
    
    // 测试断开连接
    let disconnect_result = client.disconnect().await;
    assert!(disconnect_result.is_ok());
    assert!(!client.is_connected());
    assert_eq!(*client.get_state(), ConnectionState::Disconnected);
    
    mock_server.stop().await;
}

/// 测试Modbus连接超时
#[tokio::test]
#[serial]
async fn test_modbus_connection_timeout() {
    let mut client = ModbusClient::new();
    
    // 使用不存在的地址和短超时时间
    let config = ModbusConfig {
        ip: "192.168.255.255".to_string(), // 不可达地址
        port: 12345,
        timeout_ms: 100, // 极短超时
        slave_id: 1,
    };
    
    client.set_config(config);
    
    // 连接应该超时失败
    let result = client.connect().await;
    assert!(result.is_err());
    
    match result.unwrap_err() {
        ModbusError::ConnectionFailed(_) | ModbusError::Timeout => {},
        err => panic!("期望超时或连接失败错误，实际为: {:?}", err),
    }
    
    assert!(!client.is_connected());
    assert!(matches!(*client.get_state(), ConnectionState::Error(_)));
}

/// 测试寄存器读取功能
#[tokio::test]
#[serial]
async fn test_modbus_read_registers() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置测试数据
    let test_data = [100, 200, 300, 400, 500];
    mock_server.set_registers(0, &test_data);
    
    let mut client = ModbusClient::new();
    let config = utils::create_test_config(mock_server.port());
    client.set_config(config);
    
    // 连接到服务器
    assert!(client.connect().await.is_ok());
    
    // 读取寄存器
    let result = client.read_holding_registers(0, 5).await;
    assert!(result.is_ok(), "读取寄存器失败: {:?}", result.err());
    
    let values = result.unwrap();
    utils::assert_registers_equal(&test_data, &values);
    
    mock_server.stop().await;
}

/// 测试读取多个地址范围
#[tokio::test]
#[serial]
async fn test_modbus_read_multiple_ranges() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置测试数据
    mock_server.set_registers(0, &[100, 200]);
    mock_server.set_registers(10, &[300, 400, 500]);
    mock_server.set_registers(20, &[600]);
    
    let mut client = ModbusClient::new();
    let config = utils::create_test_config(mock_server.port());
    client.set_config(config);
    
    assert!(client.connect().await.is_ok());
    
    // 创建地址范围
    let ranges = vec![
        AddressRange::new(0, 2),
        AddressRange::new(10, 3),
        AddressRange::new(20, 1),
    ];
    
    // 读取多个范围
    let result = client.read_multiple_ranges(&ranges).await;
    assert!(result.is_ok(), "读取多个范围失败: {:?}", result.err());
    
    let results = result.unwrap();
    assert_eq!(results.len(), 3);
    
    // 验证每个范围的数据
    utils::assert_registers_equal(&[100, 200], &results[0].values);
    utils::assert_registers_equal(&[300, 400, 500], &results[1].values);
    utils::assert_registers_equal(&[600], &results[2].values);
    
    mock_server.stop().await;
}

/// 测试未连接时的操作
#[tokio::test]
async fn test_operations_without_connection() {
    let mut client = ModbusClient::new();
    
    // 未连接时读取寄存器应该失败
    let result = client.read_holding_registers(0, 10).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ModbusError::NotConnected));
    
    // 未连接时读取多个范围应该失败
    let ranges = vec![AddressRange::new(0, 5)];
    let result = client.read_multiple_ranges(&ranges).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ModbusError::NotConnected));
}

/// 测试地址范围验证
#[test]
fn test_address_range_validation() {
    // 有效范围
    let valid_range = AddressRange::new(0, 10);
    assert!(valid_range.is_valid());
    
    // 数量为0的无效范围
    let invalid_range1 = AddressRange::new(0, 0);
    assert!(!invalid_range1.is_valid());
    
    // 数量过大的无效范围
    let invalid_range2 = AddressRange::new(0, 126);
    assert!(!invalid_range2.is_valid());
    
    // 地址溢出的无效范围
    let invalid_range3 = AddressRange::new(65535, 2);
    assert!(!invalid_range3.is_valid());
    
    // 边界情况 - 最大有效地址
    let boundary_range = AddressRange::new(65534, 1);
    assert!(boundary_range.is_valid());
}

/// 测试Modbus配置验证
#[test]
fn test_modbus_config_validation() {
    // 有效配置
    let valid_config = ModbusConfig {
        ip: "192.168.1.100".to_string(),
        port: 502,
        timeout_ms: 3000,
        slave_id: 1,
    };
    
    let mut client = ModbusClient::new();
    client.set_config(valid_config);
    assert!(client.validate_config().is_ok());
    
    // 无效IP地址
    let invalid_ip_config = ModbusConfig {
        ip: "invalid_ip".to_string(),
        port: 502,
        timeout_ms: 3000,
        slave_id: 1,
    };
    
    client.set_config(invalid_ip_config);
    let result = client.validate_config();
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ModbusError::InvalidConfig(_)));
    
    // 无效端口
    let invalid_port_config = ModbusConfig {
        ip: "192.168.1.100".to_string(),
        port: 0,
        timeout_ms: 3000,
        slave_id: 1,
    };
    
    client.set_config(invalid_port_config);
    let result = client.validate_config();
    assert!(result.is_err());
    
    // 无效从站ID
    let invalid_slave_config = ModbusConfig {
        ip: "192.168.1.100".to_string(),
        port: 502,
        timeout_ms: 3000,
        slave_id: 0, // 从站ID不能为0
    };
    
    client.set_config(invalid_slave_config);
    let result = client.validate_config();
    assert!(result.is_err());
    
    // 超时时间过小
    let invalid_timeout_config = ModbusConfig {
        ip: "192.168.1.100".to_string(),
        port: 502,
        timeout_ms: 0,
        slave_id: 1,
    };
    
    client.set_config(invalid_timeout_config);
    let result = client.validate_config();
    assert!(result.is_err());
}

/// 测试错误消息的用户友好性
#[test]
fn test_error_user_friendly_messages() {
    let error1 = ModbusError::NotConnected;
    let msg1 = error1.user_friendly_message();
    assert!(msg1.contains("设备未连接"));
    assert!(!msg1.is_empty());
    
    let error2 = ModbusError::InvalidAddressRange { start: 0, count: 0 };
    let msg2 = error2.user_friendly_message();
    assert!(msg2.contains("地址范围") || msg2.contains("数量"));
    assert!(!msg2.is_empty());
    
    let error3 = ModbusError::Timeout;
    let msg3 = error3.user_friendly_message();
    assert!(msg3.contains("超时"));
    assert!(!msg3.is_empty());
    
    let error4 = ModbusError::ConnectionFailed("test error".to_string());
    let msg4 = error4.user_friendly_message();
    assert!(msg4.contains("连接失败"));
    assert!(!msg4.is_empty());
}

/// 测试读取结果结构
#[test]
fn test_read_result() {
    use modbus_reader::modbus::ReadResult;
    
    let range = AddressRange::new(0, 5);
    let values = vec![100, 200, 300, 400, 500];
    let result = ReadResult::new(range, values.clone());
    
    assert_eq!(result.range.start, 0);
    assert_eq!(result.range.count, 5);
    assert_eq!(result.values, values);
    assert!(result.timestamp <= chrono::Utc::now());
}

/// 测试连接状态转换
#[test]
fn test_connection_state_transitions() {
    let state1 = ConnectionState::Disconnected;
    let state2 = ConnectionState::Connecting;
    let state3 = ConnectionState::Connected;
    let state4 = ConnectionState::Error("test error".to_string());
    
    // 确保不同状态确实不相等
    assert_ne!(state1, state2);
    assert_ne!(state2, state3);
    assert_ne!(state3, state4);
    assert_ne!(state4, state1);
    
    // 测试克隆
    let state1_clone = state1.clone();
    assert_eq!(state1, state1_clone);
    
    // 测试调试输出
    let debug_str = format!("{:?}", state4);
    assert!(debug_str.contains("Error"));
    assert!(debug_str.contains("test error"));
}

/// 压力测试 - 大量连续读取
#[tokio::test]
#[serial]
async fn test_modbus_stress_read() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置大量测试数据
    let mut test_data = Vec::new();
    for i in 0..100 {
        test_data.push(i as u16);
    }
    mock_server.set_registers(0, &test_data);
    
    let mut client = ModbusClient::new();
    let config = utils::create_test_config(mock_server.port());
    client.set_config(config);
    
    assert!(client.connect().await.is_ok());
    
    // 执行多次读取操作
    for _ in 0..10 {
        let result = client.read_holding_registers(0, 100).await;
        assert!(result.is_ok(), "压力测试读取失败");
        
        let values = result.unwrap();
        assert_eq!(values.len(), 100);
        
        // 验证数据一致性
        for (i, &value) in values.iter().enumerate() {
            assert_eq!(value, i as u16, "数据不匹配，索引: {}", i);
        }
    }
    
    mock_server.stop().await;
}

/// 测试并发读取
#[tokio::test]
#[serial]
async fn test_concurrent_reads() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置测试数据
    mock_server.set_registers(0, &[100, 200, 300, 400, 500]);
    
    let config = utils::create_test_config(mock_server.port());
    
    // 创建多个客户端进行并发测试
    let mut handles = Vec::new();
    
    for _ in 0..5 {
        let config_clone = config.clone();
        let handle = tokio::spawn(async move {
            let mut client = ModbusClient::new();
            client.set_config(config_clone);
            assert!(client.connect().await.is_ok());
            
            let result = client.read_holding_registers(0, 5).await;
            assert!(result.is_ok());
            
            let values = result.unwrap();
            assert_eq!(values.len(), 5);
            utils::assert_registers_equal(&[100, 200, 300, 400, 500], &values);
        });
        
        handles.push(handle);
    }
    
    // 等待所有任务完成
    for handle in handles {
        assert!(handle.await.is_ok());
    }
    
    mock_server.stop().await;
}