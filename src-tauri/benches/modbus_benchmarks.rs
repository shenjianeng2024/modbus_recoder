use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use std::time::Duration;
use tokio::runtime::Runtime;

// 注意：由于这是基准测试文件，我们需要添加适当的依赖
// 在Cargo.toml中添加：
// [dev-dependencies]
// criterion = { version = "0.5", features = ["html_reports"] }

// 模拟测试模块
mod common {
    pub struct MockModbusServer;
    impl MockModbusServer {
        pub fn new() -> Self { Self }
        pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> { Ok(()) }
        pub fn port(&self) -> u16 { 15022 }
        pub fn set_registers(&self, _start: u16, _values: &[u16]) {}
        pub async fn stop(&mut self) {}
    }
    
    pub mod utils {
        use modbus_reader::modbus::ModbusConfig;
        
        pub fn create_test_config(port: u16) -> ModbusConfig {
            ModbusConfig {
                ip: "127.0.0.1".to_string(),
                port,
                timeout_ms: 1000,
                slave_id: 1,
            }
        }
    }
}

use common::{MockModbusServer, utils};
use modbus_reader::modbus::{ModbusClient, AddressRange, AppState};

/// 基准测试：Modbus客户端连接性能
fn bench_modbus_connection(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("modbus_connect_disconnect", |b| {
        b.to_async(&rt).iter(|| async {
            let mut mock_server = MockModbusServer::new();
            let _ = mock_server.start().await;
            
            let mut client = ModbusClient::new();
            let config = utils::create_test_config(mock_server.port());
            client.set_config(config);
            
            // 基准测试连接和断开
            let connect_result = client.connect().await;
            if connect_result.is_ok() {
                let _ = client.disconnect().await;
            }
            
            mock_server.stop().await;
            black_box(connect_result)
        })
    });
}

/// 基准测试：单次寄存器读取性能
fn bench_single_register_read(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    // 测试不同数量的寄存器读取
    let sizes = vec![1, 10, 50, 100, 125];
    
    for size in sizes {
        c.bench_with_input(
            BenchmarkId::new("single_register_read", size),
            &size,
            |b, &size| {
                b.to_async(&rt).iter(|| async move {
                    let mut mock_server = MockModbusServer::new();
                    let _ = mock_server.start().await;
                    
                    // 设置测试数据
                    let test_data: Vec<u16> = (0..size).map(|i| i as u16).collect();
                    mock_server.set_registers(0, &test_data);
                    
                    let mut client = ModbusClient::new();
                    let config = utils::create_test_config(mock_server.port());
                    client.set_config(config);
                    
                    if client.connect().await.is_ok() {
                        let result = client.read_holding_registers(0, size as u16).await;
                        let _ = client.disconnect().await;
                        black_box(result)
                    } else {
                        mock_server.stop().await;
                        panic!("连接失败");
                    }
                });
            },
        );
    }
}

/// 基准测试：多范围读取性能
fn bench_multiple_range_read(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    // 测试不同数量的范围
    let range_counts = vec![1, 3, 5, 10];
    
    for count in range_counts {
        c.bench_with_input(
            BenchmarkId::new("multiple_range_read", count),
            &count,
            |b, &count| {
                b.to_async(&rt).iter(|| async move {
                    let mut mock_server = MockModbusServer::new();
                    let _ = mock_server.start().await;
                    
                    // 设置测试数据
                    for i in 0..count {
                        let start_addr = i * 10;
                        let test_data: Vec<u16> = (0..5).map(|j| (start_addr + j) as u16).collect();
                        mock_server.set_registers(start_addr as u16, &test_data);
                    }
                    
                    let mut client = ModbusClient::new();
                    let config = utils::create_test_config(mock_server.port());
                    client.set_config(config);
                    
                    if client.connect().await.is_ok() {
                        // 创建地址范围
                        let ranges: Vec<AddressRange> = (0..count)
                            .map(|i| AddressRange::new((i * 10) as u16, 5))
                            .collect();
                        
                        let result = client.read_multiple_ranges(&ranges).await;
                        let _ = client.disconnect().await;
                        mock_server.stop().await;
                        black_box(result)
                    } else {
                        mock_server.stop().await;
                        panic!("连接失败");
                    }
                });
            },
        );
    }
}

/// 基准测试：应用状态管理性能
fn bench_app_state_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("app_state_config_operations", |b| {
        b.to_async(&rt).iter(|| async {
            let app_state = AppState::new();
            let config = utils::create_test_config(15023);
            
            // 基准测试配置设置和获取
            app_state.set_config(config.clone()).await;
            let stored_config = app_state.get_config().await;
            let is_connected = app_state.is_connected().await;
            
            black_box((stored_config, is_connected))
        })
    });
}

/// 基准测试：错误处理性能
fn bench_error_handling(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("error_handling_performance", |b| {
        b.to_async(&rt).iter(|| async {
            let mut client = ModbusClient::new();
            
            // 使用无效配置强制产生错误
            let invalid_config = utils::create_test_config(99999); // 无效端口
            client.set_config(invalid_config);
            
            // 基准测试错误路径
            let connect_result = client.connect().await;
            let read_result = client.read_holding_registers(0, 10).await;
            
            black_box((connect_result, read_result))
        })
    });
}

/// 基准测试：配置验证性能
fn bench_config_validation(c: &mut Criterion) {
    c.bench_function("config_validation", |b| {
        b.iter(|| {
            let mut client = ModbusClient::new();
            
            // 测试有效配置验证
            let valid_config = utils::create_test_config(502);
            client.set_config(valid_config);
            let valid_result = client.validate_config();
            
            // 测试无效配置验证
            let invalid_config = modbus_reader::modbus::ModbusConfig {
                ip: "invalid_ip".to_string(),
                port: 502,
                timeout_ms: 3000,
                slave_id: 1,
            };
            client.set_config(invalid_config);
            let invalid_result = client.validate_config();
            
            black_box((valid_result, invalid_result))
        })
    });
}

/// 基准测试：地址范围验证性能
fn bench_address_range_validation(c: &mut Criterion) {
    c.bench_function("address_range_validation", |b| {
        b.iter(|| {
            let ranges = vec![
                AddressRange::new(0, 10),      // 有效
                AddressRange::new(100, 50),    // 有效
                AddressRange::new(0, 0),       // 无效：数量为0
                AddressRange::new(0, 126),     // 无效：数量过大
                AddressRange::new(65535, 2),   // 无效：地址溢出
            ];
            
            let results: Vec<bool> = ranges.iter().map(|r| r.is_valid()).collect();
            black_box(results)
        })
    });
}

/// 基准测试：并发性能
fn bench_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("concurrent_reads", |b| {
        b.to_async(&rt).iter(|| async {
            let mut mock_server = MockModbusServer::new();
            let _ = mock_server.start().await;
            
            // 设置测试数据
            mock_server.set_registers(0, &[100, 200, 300, 400, 500]);
            
            let config = utils::create_test_config(mock_server.port());
            
            // 创建多个并发任务
            let mut handles = Vec::new();
            
            for _ in 0..5 {
                let config_clone = config.clone();
                let handle = tokio::spawn(async move {
                    let mut client = ModbusClient::new();
                    client.set_config(config_clone);
                    
                    if client.connect().await.is_ok() {
                        let result = client.read_holding_registers(0, 5).await;
                        let _ = client.disconnect().await;
                        result
                    } else {
                        Err(modbus_reader::modbus::ModbusError::ConnectionFailed("基准测试连接失败".to_string()))
                    }
                });
                
                handles.push(handle);
            }
            
            // 等待所有任务完成
            let mut results = Vec::new();
            for handle in handles {
                if let Ok(result) = handle.await {
                    results.push(result);
                }
            }
            
            mock_server.stop().await;
            black_box(results)
        })
    });
}

/// 基准测试：内存使用性能
fn bench_memory_usage(c: &mut Criterion) {
    c.bench_function("memory_allocation", |b| {
        b.iter(|| {
            // 创建大量对象测试内存分配性能
            let mut clients = Vec::new();
            let mut ranges = Vec::new();
            
            for i in 0..100 {
                let client = ModbusClient::new();
                clients.push(client);
                
                let range = AddressRange::new(i, 10);
                ranges.push(range);
            }
            
            black_box((clients, ranges))
        })
    });
}

/// 基准测试：序列化/反序列化性能
fn bench_serialization(c: &mut Criterion) {
    c.bench_function("config_serialization", |b| {
        b.iter(|| {
            let config = utils::create_test_config(502);
            
            // 序列化
            let serialized = serde_json::to_string(&config).unwrap();
            
            // 反序列化
            let deserialized: modbus_reader::modbus::ModbusConfig = 
                serde_json::from_str(&serialized).unwrap();
            
            black_box((serialized, deserialized))
        })
    });
    
    c.bench_function("read_result_serialization", |b| {
        b.iter(|| {
            let range = AddressRange::new(0, 100);
            let values: Vec<u16> = (0..100).collect();
            let read_result = modbus_reader::modbus::ReadResult::new(range, values);
            
            // 序列化
            let serialized = serde_json::to_string(&read_result).unwrap();
            
            // 反序列化
            let deserialized: modbus_reader::modbus::ReadResult = 
                serde_json::from_str(&serialized).unwrap();
            
            black_box((serialized, deserialized))
        })
    });
}

// 配置基准测试组
criterion_group!(
    benches,
    bench_modbus_connection,
    bench_single_register_read,
    bench_multiple_range_read,
    bench_app_state_operations,
    bench_error_handling,
    bench_config_validation,
    bench_address_range_validation,
    bench_concurrent_operations,
    bench_memory_usage,
    bench_serialization
);

// 自定义基准测试配置
fn custom_criterion() -> Criterion {
    Criterion::default()
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2))
        .sample_size(100)
        .with_plots()
}

criterion_main!(benches);