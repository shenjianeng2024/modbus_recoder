use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use chrono::{DateTime, Local, TimeZone};
use log::{debug, info, warn};

use crate::modbus::types::{BatchReadResult, ManagedAddressRange};

/// 初始化CSV文件，写入表头
#[tauri::command]
pub async fn initialize_csv_file(
    file_path: String,
    address_ranges: Vec<ManagedAddressRange>,
) -> Result<String, String> {
    info!("初始化CSV文件: {}", file_path);
    
    let path = Path::new(&file_path);
    
    // 确保目录存在
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    // 创建文件并写入CSV头部
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true) // 清空文件内容
        .open(&file_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    
    // 写入CSV头部
    let header = generate_csv_header(&address_ranges);
    writeln!(file, "{}", header)
        .map_err(|e| format!("写入头部失败: {}", e))?;
    
    file.flush()
        .map_err(|e| format!("保存文件失败: {}", e))?;
    
    info!("CSV文件初始化完成: {}", file_path);
    Ok(format!("文件初始化完成: {}", file_path))
}

/// 将采集数据追加到CSV文件
#[tauri::command]
pub async fn append_data_to_file(
    file_path: String,
    data: BatchReadResult,
) -> Result<String, String> {
    debug!("追加数据到文件: {}", file_path);
    
    // 以追加模式打开文件
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("打开文件失败: {}", e))?;
    
    // 将BatchReadResult转换为CSV行
    let csv_line = generate_csv_line(&data)?;
    
    writeln!(file, "{}", csv_line)
        .map_err(|e| format!("写入数据失败: {}", e))?;
    
    file.flush()
        .map_err(|e| format!("保存文件失败: {}", e))?;
    
    debug!("数据追加完成，成功: {}, 失败: {}", data.success_count, data.failed_count);
    Ok(format!("数据已追加，成功: {}, 失败: {}", data.success_count, data.failed_count))
}

/// 生成CSV文件头部
fn generate_csv_header(address_ranges: &[ManagedAddressRange]) -> String {
    let mut headers = vec!["采集时间".to_string()];
    
    // 为每个地址范围的每个地址添加列
    for range in address_ranges {
        for addr in range.start_address..(range.start_address + range.length) {
            headers.push(format!("地址_{}", addr));
        }
    }
    
    headers.join(",")
}

/// 将BatchReadResult转换为CSV行
fn generate_csv_line(data: &BatchReadResult) -> Result<String, String> {
    let mut values = vec![];
    
    // 添加时间戳
    let timestamp = parse_timestamp(&data.timestamp)?;
    values.push(timestamp.format("%Y-%m-%d %H:%M:%S%.3f").to_string());
    
    // 按地址顺序添加值
    for result in &data.results {
        let value = if result.success {
            result.parsed_value.clone()
        } else {
            "ERROR".to_string()
        };
        values.push(value);
    }
    
    Ok(values.join(","))
}

/// 解析时间戳字符串
fn parse_timestamp(timestamp_str: &str) -> Result<DateTime<Local>, String> {
    // 尝试多种时间戳格式
    let formats = [
        "%Y-%m-%dT%H:%M:%S%.3f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S%.3f",
        "%Y-%m-%d %H:%M:%S",
    ];
    
    for format in &formats {
        if let Ok(dt) = DateTime::parse_from_str(timestamp_str, &format!("{}%:z", format)) {
            return Ok(dt.with_timezone(&Local));
        }
        
        // 尝试不带时区的解析
        if let Ok(naive_dt) = chrono::NaiveDateTime::parse_from_str(timestamp_str, format) {
            return Ok(Local.from_local_datetime(&naive_dt).single().unwrap_or(Local::now()));
        }
    }
    
    // 如果解析失败，使用当前时间
    warn!("无法解析时间戳 '{}', 使用当前时间", timestamp_str);
    Ok(Local::now())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::types::AddressReadResult;
    
    #[test]
    fn test_generate_csv_header() {
        let ranges = vec![
            ManagedAddressRange {
                id: "test1".to_string(),
                name: Some("Test Range 1".to_string()),
                start_address: 0,
                length: 3,
                data_type: "uint16".to_string(),
                description: None,
                enabled: Some(true),
            }
        ];
        
        let header = generate_csv_header(&ranges);
        assert_eq!(header, "采集时间,地址_0,地址_1,地址_2");
    }
    
    #[test]
    fn test_generate_csv_line() {
        let data = BatchReadResult {
            results: vec![
                AddressReadResult {
                    address: 0,
                    raw_value: 100,
                    parsed_value: "100".to_string(),
                    timestamp: "2024-01-01T12:00:00".to_string(),
                    success: true,
                    error: None,
                    data_type: "uint16".to_string(),
                },
                AddressReadResult {
                    address: 1,
                    raw_value: 0,
                    parsed_value: "".to_string(),
                    timestamp: "2024-01-01T12:00:00".to_string(),
                    success: false,
                    error: Some("连接失败".to_string()),
                    data_type: "uint16".to_string(),
                }
            ],
            total_count: 2,
            success_count: 1,
            failed_count: 1,
            timestamp: "2024-01-01T12:00:00".to_string(),
            duration_ms: 100,
        };
        
        let line = generate_csv_line(&data).unwrap();
        // 只检查格式，不检查具体时间值
        assert!(line.contains("100,ERROR"));
    }

    #[test]
    fn test_generate_csv_line_with_float32() {
        let data = BatchReadResult {
            results: vec![
                AddressReadResult {
                    address: 0,
                    raw_value: 0x42280000, // 42.0 的 IEEE 754 表示
                    parsed_value: "42".to_string(), // 解析后的 f32 值
                    timestamp: "2024-01-01T12:00:00".to_string(),
                    success: true,
                    error: None,
                    data_type: "float32".to_string(),
                },
                AddressReadResult {
                    address: 2,
                    raw_value: 0x40400000, // 3.0 的 IEEE 754 表示
                    parsed_value: "3".to_string(), // 解析后的 f32 值
                    timestamp: "2024-01-01T12:00:00".to_string(),
                    success: true,
                    error: None,
                    data_type: "float32".to_string(),
                }
            ],
            total_count: 2,
            success_count: 2,
            failed_count: 0,
            timestamp: "2024-01-01T12:00:00".to_string(),
            duration_ms: 100,
        };
        
        let line = generate_csv_line(&data).unwrap();
        // 验证CSV中包含解析后的浮点数值，而不是原始值
        assert!(line.contains("42,3"));
        assert!(!line.contains("1109393408")); // 不应包含原始的32位整数值
    }
    
    #[test]
    fn test_parse_timestamp() {
        let timestamp = "2024-01-01T12:00:00.123";
        let result = parse_timestamp(timestamp);
        assert!(result.is_ok());
        
        // 测试无效时间戳
        let invalid_timestamp = "invalid-timestamp";
        let result = parse_timestamp(invalid_timestamp);
        assert!(result.is_ok()); // 应该回退到当前时间
    }
}