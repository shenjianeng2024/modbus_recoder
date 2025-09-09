use std::sync::Arc;
use tokio_test;
use serial_test::serial;

mod common;

use common::{MockModbusServer, utils};
use modbus_reader::modbus::{AppState, ModbusConfig, AddressRange};

/// 测试应用状态管理
#[tokio::test]
async fn test_app_state() {
    let app_state = AppState::new();
    
    // 测试初始状态
    assert!(!app_state.is_connected().await);
    
    // 测试配置设置
    let config = ModbusConfig::default();
    app_state.set_config(config.clone()).await;
    
    let stored_config = app_state.get_config().await;
    assert_eq!(stored_config, config);
}

/// 测试Modbus连接命令
#[tokio::test]
#[serial]
async fn test_modbus_connect_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置
    app_state.set_config(config).await;
    
    // 测试连接命令
    let result = modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await;
    assert!(result.is_ok(), "连接命令失败: {:?}", result.err());
    
    // 验证连接状态
    assert!(app_state.is_connected().await);
    
    // 测试断开连接命令
    let result = modbus_reader::modbus::manager::modbus_disconnect(app_state.clone()).await;
    assert!(result.is_ok(), "断开连接命令失败: {:?}", result.err());
    
    // 验证断开状态
    assert!(!app_state.is_connected().await);
    
    mock_server.stop().await;
}

/// 测试连接测试命令
#[tokio::test]
#[serial]
async fn test_modbus_test_connection_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置
    app_state.set_config(config).await;
    
    // 测试连接测试命令
    let result = modbus_reader::modbus::manager::modbus_test_connection(app_state.clone()).await;
    assert!(result.is_ok(), "连接测试命令失败: {:?}", result.err());
    
    mock_server.stop().await;
}

/// 测试连接测试命令失败情况
#[tokio::test]
#[serial]
async fn test_modbus_test_connection_failure() {
    let app_state = AppState::new();
    
    // 使用无效配置
    let config = ModbusConfig {
        ip: "192.168.255.255".to_string(),
        port: 12345,
        timeout_ms: 100,
        slave_id: 1,
    };
    
    app_state.set_config(config).await;
    
    // 测试连接测试命令应该失败
    let result = modbus_reader::modbus::manager::modbus_test_connection(app_state.clone()).await;
    assert!(result.is_err(), "期望连接测试失败，但却成功了");
}

/// 测试寄存器读取命令
#[tokio::test]
#[serial]
async fn test_modbus_read_holding_registers_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置测试数据
    let test_data = [100, 200, 300, 400, 500];
    mock_server.set_registers(0, &test_data);
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置并连接
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 测试读取命令
    let result = modbus_reader::modbus::manager::modbus_read_holding_registers(
        0, 5, app_state.clone()
    ).await;
    
    assert!(result.is_ok(), "读取命令失败: {:?}", result.err());
    let values = result.unwrap();
    utils::assert_registers_equal(&test_data, &values);
    
    mock_server.stop().await;
}

/// 测试多范围读取命令
#[tokio::test]
#[serial]
async fn test_modbus_read_multiple_ranges_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置测试数据
    mock_server.set_registers(0, &[100, 200]);
    mock_server.set_registers(10, &[300, 400, 500]);
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置并连接
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 准备地址范围
    let ranges = vec![
        AddressRange::new(0, 2),
        AddressRange::new(10, 3),
    ];
    
    // 测试多范围读取命令
    let result = modbus_reader::modbus::manager::modbus_read_multiple_ranges(
        ranges, app_state.clone()
    ).await;
    
    assert!(result.is_ok(), "多范围读取命令失败: {:?}", result.err());
    let results = result.unwrap();
    
    assert_eq!(results.len(), 2);
    utils::assert_registers_equal(&[100, 200], &results[0].values);
    utils::assert_registers_equal(&[300, 400, 500], &results[1].values);
    
    mock_server.stop().await;
}

/// 测试获取连接状态命令
#[tokio::test]
#[serial]
async fn test_modbus_get_connection_state_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 测试未连接状态
    let state = modbus_reader::modbus::manager::modbus_get_connection_state(app_state.clone()).await;
    assert!(matches!(state, modbus_reader::modbus::ConnectionState::Disconnected));
    
    // 连接后测试连接状态
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    let state = modbus_reader::modbus::manager::modbus_get_connection_state(app_state.clone()).await;
    assert!(matches!(state, modbus_reader::modbus::ConnectionState::Connected));
    
    mock_server.stop().await;
}

/// 测试配置设置和获取命令
#[tokio::test]
async fn test_modbus_config_commands() {
    let app_state = AppState::new();
    let config = ModbusConfig {
        ip: "192.168.1.200".to_string(),
        port: 503,
        timeout_ms: 5000,
        slave_id: 2,
    };
    
    // 测试设置配置命令
    let result = modbus_reader::modbus::manager::modbus_set_config(config.clone(), app_state.clone()).await;
    assert!(result.is_ok(), "设置配置命令失败: {:?}", result.err());
    
    // 测试获取配置命令
    let stored_config = modbus_reader::modbus::manager::modbus_get_config(app_state.clone()).await;
    assert_eq!(stored_config, config);
}

/// 测试配置验证命令
#[tokio::test]
async fn test_modbus_validate_config_command() {
    let app_state = AppState::new();
    
    // 测试有效配置
    let valid_config = ModbusConfig::default();
    app_state.set_config(valid_config).await;
    
    let result = modbus_reader::modbus::manager::modbus_validate_config(app_state.clone()).await;
    assert!(result.is_ok(), "有效配置验证失败: {:?}", result.err());
    
    // 测试无效配置
    let invalid_config = ModbusConfig {
        ip: "invalid_ip".to_string(),
        port: 502,
        timeout_ms: 3000,
        slave_id: 1,
    };
    app_state.set_config(invalid_config).await;
    
    let result = modbus_reader::modbus::manager::modbus_validate_config(app_state.clone()).await;
    assert!(result.is_err(), "无效配置应该验证失败");
}

/// 测试获取连接信息命令
#[tokio::test]
#[serial]
async fn test_modbus_get_connection_info_command() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置并连接
    app_state.set_config(config.clone()).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 测试获取连接信息命令
    let result = modbus_reader::modbus::manager::modbus_get_connection_info(app_state.clone()).await;
    assert!(result.is_ok(), "获取连接信息命令失败: {:?}", result.err());
    
    let info = result.unwrap();
    assert_eq!(info.get("ip"), Some(&serde_json::Value::String("127.0.0.1".to_string())));
    assert_eq!(info.get("port"), Some(&serde_json::Value::Number(serde_json::Number::from(config.port))));
    
    mock_server.stop().await;
}

/// 测试未连接时的读取操作
#[tokio::test]
async fn test_read_operations_without_connection() {
    let app_state = AppState::new();
    
    // 未连接时读取寄存器应该失败
    let result = modbus_reader::modbus::manager::modbus_read_holding_registers(
        0, 10, app_state.clone()
    ).await;
    assert!(result.is_err(), "未连接时读取应该失败");
    
    // 未连接时多范围读取应该失败
    let ranges = vec![AddressRange::new(0, 5)];
    let result = modbus_reader::modbus::manager::modbus_read_multiple_ranges(
        ranges, app_state.clone()
    ).await;
    assert!(result.is_err(), "未连接时多范围读取应该失败");
}

/// 测试错误处理和恢复
#[tokio::test]
#[serial]
async fn test_error_handling_and_recovery() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 连接到服务器
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 停止服务器模拟网络中断
    mock_server.stop().await;
    
    // 尝试读取应该失败
    let result = modbus_reader::modbus::manager::modbus_read_holding_registers(
        0, 5, app_state.clone()
    ).await;
    assert!(result.is_err(), "网络中断后读取应该失败");
    
    // 检查连接状态应该显示错误
    let state = modbus_reader::modbus::manager::modbus_get_connection_state(app_state.clone()).await;
    assert!(matches!(state, modbus_reader::modbus::ConnectionState::Error(_)));
}

/// 测试命令的线程安全性
#[tokio::test]
#[serial]
async fn test_command_thread_safety() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    mock_server.set_registers(0, &[100, 200, 300]);
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    // 设置配置并连接
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 创建多个并发任务
    let mut handles = Vec::new();
    
    for _ in 0..5 {
        let app_state_clone = app_state.clone();
        let handle = tokio::spawn(async move {
            // 并发读取操作
            let result = modbus_reader::modbus::manager::modbus_read_holding_registers(
                0, 3, app_state_clone.clone()
            ).await;
            
            assert!(result.is_ok(), "并发读取失败");
            let values = result.unwrap();
            utils::assert_registers_equal(&[100, 200, 300], &values);
            
            // 并发获取状态操作
            let state = modbus_reader::modbus::manager::modbus_get_connection_state(app_state_clone).await;
            assert!(matches!(state, modbus_reader::modbus::ConnectionState::Connected));
        });
        
        handles.push(handle);
    }
    
    // 等待所有任务完成
    for handle in handles {
        assert!(handle.await.is_ok(), "并发任务执行失败");
    }
    
    mock_server.stop().await;
}

/// 测试长时间运行的稳定性
#[tokio::test]
#[serial]
async fn test_long_running_stability() {
    let mut mock_server = MockModbusServer::new();
    mock_server.start().await.expect("启动模拟服务器失败");
    
    // 设置变化的测试数据
    let mut test_data = Vec::new();
    for i in 0..50 {
        test_data.push(i as u16);
    }
    mock_server.set_registers(0, &test_data);
    
    let app_state = AppState::new();
    let config = utils::create_test_config(mock_server.port());
    
    app_state.set_config(config).await;
    assert!(modbus_reader::modbus::manager::modbus_connect(app_state.clone()).await.is_ok());
    
    // 执行长时间的读取操作
    for i in 0..20 {
        // 更新服务器数据
        let updated_data: Vec<u16> = (i..i+50).collect();
        mock_server.set_registers(0, &updated_data);
        
        // 读取并验证数据
        let result = modbus_reader::modbus::manager::modbus_read_holding_registers(
            0, 50, app_state.clone()
        ).await;
        
        assert!(result.is_ok(), "第{}次读取失败", i + 1);
        let values = result.unwrap();
        utils::assert_registers_equal(&updated_data, &values);
        
        // 检查连接状态
        let state = modbus_reader::modbus::manager::modbus_get_connection_state(app_state.clone()).await;
        assert!(matches!(state, modbus_reader::modbus::ConnectionState::Connected));
        
        // 小延迟模拟真实使用场景
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    
    mock_server.stop().await;
}