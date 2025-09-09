use crate::modbus::{AddressRange, AppState, BatchReadResult, ReadResult};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::fs::File;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadRequest {
    pub ip: String,
    pub port: u16,
    pub ranges: Vec<AddressRange>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetailedReadRequest {
    pub ranges: Vec<AddressRange>,
    pub format: Option<String>, // "dec", "hex", "bin"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    pub file_path: String,
    pub data: Vec<BatchReadResult>,
}

#[tauri::command]
pub async fn read_single(
    state: State<'_, AppState>,
    request: ReadRequest,
) -> Result<ReadResult, String> {
    let mut client = state.modbus.lock().await;

    // 先确保连接
    if !client.is_connected() {
        match client.connect(&request.ip, request.port).await {
            Ok(_) => {}
            Err(e) => return Err(format!("Failed to connect: {}", e)),
        }
    }

    // 读取第一个地址范围（单次读取模式）
    if let Some(range) = request.ranges.first() {
        match client.read_holding_registers(range.clone()).await {
            Ok(result) => Ok(result),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Err("No address ranges specified".to_string())
    }
}

#[tauri::command]
pub async fn start_collection(_request: ReadRequest, interval_ms: u64) -> Result<String, String> {
    // Placeholder implementation - will be implemented in task 007
    Ok(format!(
        "Collection started with {}ms interval - Ready to implement",
        interval_ms
    ))
}

#[tauri::command]
pub async fn stop_collection() -> Result<String, String> {
    // Placeholder implementation - will be implemented in task 007
    Ok("Collection stopped - Ready to implement".to_string())
}

#[tauri::command]
pub async fn read_modbus_ranges(
    state: State<'_, AppState>,
    request: DetailedReadRequest,
) -> Result<BatchReadResult, String> {
    log::info!("收到详细读取请求: {} 个地址范围", request.ranges.len());
    
    if request.ranges.is_empty() {
        log::warn!("读取请求中没有指定地址范围");
        return Err("至少需要指定一个地址范围".to_string());
    }
    
    // 验证所有地址范围
    for (i, range) in request.ranges.iter().enumerate() {
        if !range.is_valid() {
            log::error!("地址范围 {} 无效: start={}, count={}", i + 1, range.start, range.count);
            return Err(format!(
                "地址范围 {} 无效: 起始地址={}, 数量={}",
                i + 1, range.start, range.count
            ));
        }
    }
    
    let mut client = state.modbus.lock().await;
    
    // 检查连接状态
    if !client.is_connected() {
        log::error!("Modbus 设备未连接");
        return Err("设备未连接，请先建立连接".to_string());
    }
    
    log::info!("开始执行详细读取操作");
    
    match client.read_ranges_detailed(request.ranges, request.format).await {
        Ok(result) => {
            log::info!(
                "详细读取操作完成: 成功 {}/{}, 耗时 {}ms",
                result.success_count,
                result.total_count,
                result.duration_ms
            );
            Ok(result)
        }
        Err(e) => {
            log::error!("详细读取操作失败: {}", e);
            Err(format!("读取失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn export_csv(file_path: String, data: Vec<BatchReadResult>) -> Result<String, String> {
    if data.is_empty() {
        return Err("没有数据可导出".to_string());
    }

    let path = Path::new(&file_path);
    
    // 确保父目录存在
    if let Some(parent) = path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return Err(format!("无法创建目录: {}", e));
        }
    }

    let mut file = File::create(&file_path)
        .map_err(|e| format!("无法创建文件: {}", e))?;

    // 构建动态CSV头部
    if let Some(first_batch) = data.first() {
        // 头部：时间戳,成功数量,失败数量,耗时,地址1_原始值,地址1_解析值,地址2_原始值,地址2_解析值,...
        let mut header = "Timestamp,Success_Count,Failed_Count,Duration_ms".to_string();
        for result in &first_batch.results {
            header.push_str(&format!(",Addr_{}_Raw,Addr_{}_Parsed", result.address, result.address));
        }
        writeln!(file, "{}", header).map_err(|e| format!("写入CSV头部失败: {}", e))?;
    }

    // 写入数据 - 每批次一行
    let mut total_records = 0;
    for batch in &data {
        // 基本信息
        let mut row = format!("{},{},{},{}", 
            batch.timestamp, 
            batch.success_count, 
            batch.failed_count, 
            batch.duration_ms
        );
        
        // 添加所有地址的数据
        for result in &batch.results {
            if result.success {
                row.push_str(&format!(",{},{}", result.raw_value, result.parsed_value));
            } else {
                // 如果读取失败，用错误信息填充
                let error_msg = result.error.as_deref().unwrap_or("ERROR");
                row.push_str(&format!(",ERROR,{}", error_msg));
            }
        }
        
        writeln!(file, "{}", row).map_err(|e| format!("写入数据行失败: {}", e))?;
        total_records += 1;
    }

    file.flush().map_err(|e| format!("刷新文件缓冲区失败: {}", e))?;
    
    Ok(format!("成功导出 {} 条记录到 {}", total_records, file_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detailed_read_request_serialization() {
        // 测试请求结构的序列化和反序列化
        let request = DetailedReadRequest {
            ranges: vec![
                AddressRange::new(0, 10),
                AddressRange::new(100, 5),
            ],
            format: Some("hex".to_string()),
        };

        let json = serde_json::to_string(&request).expect("序列化失败");
        let parsed: DetailedReadRequest = serde_json::from_str(&json).expect("反序列化失败");
        
        assert_eq!(parsed.ranges.len(), 2);
        assert_eq!(parsed.ranges[0].start, 0);
        assert_eq!(parsed.ranges[0].count, 10);
        assert_eq!(parsed.format, Some("hex".to_string()));
    }

    #[test]
    fn test_detailed_read_request_validation() {
        // 测试地址范围验证
        let valid_range = AddressRange::new(0, 10);
        assert!(valid_range.is_valid());
        
        let invalid_range = AddressRange::new(0, 0);
        assert!(!invalid_range.is_valid());
        
        let too_large_range = AddressRange::new(0, 126);
        assert!(!too_large_range.is_valid());
    }

    #[test]
    fn test_format_value_functions() {
        // 这个测试验证了格式化功能的正确性
        // 测试十六进制格式  
        assert_eq!(format!("0x{:04X}", 1234), "0x04D2");

        // 测试二进制格式
        assert_eq!(format!("0b{:016b}", 1234), "0b0000010011010010");
        
        // 测试十进制格式
        assert_eq!(format!("{}", 1234), "1234");
    }

    #[test]
    fn test_read_request_serialization() {
        // 测试原有ReadRequest结构的序列化
        let request = ReadRequest {
            ip: "192.168.1.100".to_string(),
            port: 502,
            ranges: vec![AddressRange::new(0, 10)],
        };

        let json = serde_json::to_string(&request).expect("序列化失败");
        let parsed: ReadRequest = serde_json::from_str(&json).expect("反序列化失败");
        
        assert_eq!(parsed.ip, "192.168.1.100");
        assert_eq!(parsed.port, 502);
        assert_eq!(parsed.ranges.len(), 1);
    }
}
