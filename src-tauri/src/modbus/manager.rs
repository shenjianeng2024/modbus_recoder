use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use log::{debug, info, warn};

use crate::modbus::{AddressRange, ConnectionState, ModbusClient, ReadResult, ModbusConfig};

pub type ModbusManager = Arc<Mutex<ModbusClient>>;

pub fn create_modbus_manager() -> ModbusManager {
    Arc::new(Mutex::new(ModbusClient::new()))
}

// Tauri 状态管理
#[derive(Debug)]
pub struct AppState {
    pub modbus: ModbusManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            modbus: create_modbus_manager(),
        }
    }
}

// Tauri 命令实现
#[tauri::command]
pub async fn modbus_connect(
    state: State<'_, AppState>,
    ip: String,
    port: u16,
) -> Result<String, String> {
    info!("前端请求连接 Modbus 设备: {}:{}", ip, port);
    let mut client = state.modbus.lock().await;

    match client.connect(&ip, port).await {
        Ok(_) => {
            let success_msg = format!("成功连接到 {}:{}", ip, port);
            info!("连接命令执行成功: {}", success_msg);
            Ok(success_msg)
        }
        Err(e) => {
            let error_msg = e.user_friendly_message();
            warn!("连接命令执行失败: {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn modbus_disconnect(state: State<'_, AppState>) -> Result<String, String> {
    info!("前端请求断开 Modbus 连接");
    let mut client = state.modbus.lock().await;

    match client.disconnect().await {
        Ok(_) => {
            let success_msg = "连接已断开".to_string();
            info!("断开命令执行成功");
            Ok(success_msg)
        }
        Err(e) => {
            let error_msg = e.user_friendly_message();
            warn!("断开命令执行失败: {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn modbus_test_connection(state: State<'_, AppState>) -> Result<bool, String> {
    debug!("前端请求测试 Modbus 连接");
    let mut client = state.modbus.lock().await;

    match client.test_connection().await {
        Ok(connected) => {
            debug!("连接测试结果: {}", connected);
            Ok(connected)
        }
        Err(e) => {
            let error_msg = e.user_friendly_message();
            warn!("连接测试失败: {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn modbus_get_connection_state(
    state: State<'_, AppState>,
) -> Result<ConnectionState, String> {
    let client = state.modbus.lock().await;
    Ok(client.get_state().clone())
}

#[tauri::command]
pub async fn modbus_read_holding_registers(
    state: State<'_, AppState>,
    start: u16,
    count: u16,
) -> Result<ReadResult, String> {
    info!("前端请求读取保持寄存器: 起始地址={}, 数量={}", start, count);
    let mut client = state.modbus.lock().await;
    let range = AddressRange::new(start, count);

    match client.read_holding_registers(range).await {
        Ok(result) => {
            info!("读取命令执行成功: 获得 {} 个数据", result.data.len());
            Ok(result)
        }
        Err(e) => {
            let error_msg = e.user_friendly_message();
            warn!("读取命令执行失败: {}", error_msg);
            Err(error_msg)
        }
    }
}

#[tauri::command]
pub async fn modbus_set_config(
    state: State<'_, AppState>,
    timeout_ms: u32,
    slave_id: u8,
) -> Result<String, String> {
    info!("前端请求更新配置: 超时={}ms, 从站ID={}", timeout_ms, slave_id);
    let mut client = state.modbus.lock().await;

    // 验证配置
    if timeout_ms == 0 || timeout_ms > 60000 {
        let error_msg = "超时时间必须在 1ms 到 60000ms 之间".to_string();
        warn!("配置验证失败: {}", error_msg);
        return Err(error_msg);
    }

    client.set_timeout(timeout_ms);
    client.set_slave_id(slave_id);

    let success_msg = "配置更新成功".to_string();
    info!("配置更新完成");
    Ok(success_msg)
}

/// 批量读取多个地址范围
#[tauri::command]
pub async fn modbus_read_multiple_ranges(
    state: State<'_, AppState>,
    ranges: Vec<(u16, u16)>, // (start, count) pairs
) -> Result<Vec<ReadResult>, String> {
    info!("前端请求批量读取 {} 个地址范围", ranges.len());
    let mut client = state.modbus.lock().await;
    
    let address_ranges: Vec<AddressRange> = ranges
        .into_iter()
        .map(|(start, count)| AddressRange::new(start, count))
        .collect();

    match client.read_multiple_ranges(address_ranges).await {
        Ok(results) => {
            info!("批量读取命令执行成功: 获得 {} 个结果", results.len());
            Ok(results)
        }
        Err(e) => {
            let error_msg = e.user_friendly_message();
            warn!("批量读取命令执行失败: {}", error_msg);
            Err(error_msg)
        }
    }
}

/// 获取连接信息
#[tauri::command]
pub async fn modbus_get_connection_info(state: State<'_, AppState>) -> Result<String, String> {
    debug!("前端请求获取连接信息");
    let client = state.modbus.lock().await;
    Ok(client.get_connection_info())
}

/// 获取当前配置
#[tauri::command]
pub async fn modbus_get_config(state: State<'_, AppState>) -> Result<ModbusConfig, String> {
    debug!("前端请求获取当前配置");
    let client = state.modbus.lock().await;
    Ok(client.get_config().clone())
}

/// 验证配置
#[tauri::command]
pub async fn modbus_validate_config(state: State<'_, AppState>) -> Result<String, String> {
    debug!("前端请求验证配置");
    let client = state.modbus.lock().await;
    
    match client.validate_config() {
        Ok(_) => Ok("配置有效".to_string()),
        Err(e) => Err(e.user_friendly_message()),
    }
}
