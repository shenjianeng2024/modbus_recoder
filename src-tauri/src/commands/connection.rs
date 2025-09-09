// 连接相关命令现在在 modbus::manager 中实现
// 这里保留一个简单的测试命令

use crate::modbus::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub ip: String,
    pub port: u16,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<ConnectionResult, String> {
    // 使用新的 Modbus 管理器进行连接测试
    let mut client = state.modbus.lock().await;

    match client.connect(&config.ip, config.port).await {
        Ok(_) => {
            // 测试连接
            match client.test_connection().await {
                Ok(true) => Ok(ConnectionResult {
                    success: true,
                    message: format!("Successfully connected to {}:{}", config.ip, config.port),
                }),
                Ok(false) => Ok(ConnectionResult {
                    success: false,
                    message: "Connected but device not responding".to_string(),
                }),
                Err(e) => Ok(ConnectionResult {
                    success: false,
                    message: format!("Connection test failed: {}", e),
                }),
            }
        }
        Err(e) => Ok(ConnectionResult {
            success: false,
            message: format!("Connection failed: {}", e),
        }),
    }
}
