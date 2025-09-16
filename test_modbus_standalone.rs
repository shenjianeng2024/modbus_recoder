use std::time::Duration;
use std::net::SocketAddr;
use tokio::net::TcpStream;
use tokio::time::timeout;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔍 独立Modbus连接测试工具");
    println!("========================");

    // 测试目标
    let targets = vec![
        ("192.168.1.199", 502),
        ("172.168.66.199", 502),
        ("192.168.1.199", 503),
        ("172.168.66.199", 503),
    ];

    for (ip, port) in targets {
        println!("\n📡 测试目标: {}:{}", ip, port);

        // 1. 基础TCP连接测试
        let result = test_basic_tcp(ip, port).await;
        match result {
            Ok(msg) => println!("  ✅ TCP: {}", msg),
            Err(msg) => println!("  ❌ TCP: {}", msg),
        }

        // 2. tokio-modbus连接测试 (如果TCP成功)
        if result.is_ok() {
            let modbus_result = test_modbus_connection(ip, port, 1).await;
            match modbus_result {
                Ok(msg) => println!("  ✅ Modbus: {}", msg),
                Err(msg) => println!("  ❌ Modbus: {}", msg),
            }
        }

        // 等待一下再测试下一个
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    println!("\n🔍 系统网络信息:");
    test_system_connectivity().await;

    Ok(())
}

async fn test_basic_tcp(ip: &str, port: u16) -> Result<String, String> {
    let address = format!("{}:{}", ip, port);
    let socket_addr: SocketAddr = address.parse()
        .map_err(|e| format!("地址解析失败: {}", e))?;

    match timeout(Duration::from_millis(3000), TcpStream::connect(socket_addr)).await {
        Ok(Ok(stream)) => {
            let local = stream.local_addr().map(|a| a.to_string()).unwrap_or("unknown".to_string());
            let remote = stream.peer_addr().map(|a| a.to_string()).unwrap_or("unknown".to_string());
            Ok(format!("连接成功 {}→{}", local, remote))
        }
        Ok(Err(e)) => {
            Err(format!("连接失败: {} (kind: {:?}, raw_os_error: {:?})",
                e, e.kind(), e.raw_os_error()))
        }
        Err(_) => Err("连接超时 (3秒)".to_string()),
    }
}

async fn test_modbus_connection(ip: &str, port: u16, slave_id: u8) -> Result<String, String> {
    // 这里我们需要根据实际的tokio-modbus版本来调整
    let address = format!("{}:{}", ip, port);
    let socket_addr: SocketAddr = address.parse()
        .map_err(|e| format!("地址解析失败: {}", e))?;

    // 手动实现一个简单的Modbus TCP连接测试
    match TcpStream::connect(socket_addr).await {
        Ok(mut stream) => {
            use tokio::io::{AsyncWriteExt, AsyncReadExt};

            // 发送一个简单的Modbus TCP请求 (读取保持寄存器)
            // MBAP Header: Transaction ID(2) + Protocol ID(2) + Length(2) + Unit ID(1)
            // PDU: Function Code(1) + Start Address(2) + Quantity(2)
            let mbap_header = [
                0x00, 0x01, // Transaction ID
                0x00, 0x00, // Protocol ID (0 for Modbus)
                0x00, 0x06, // Length (6 bytes following)
                slave_id,   // Unit ID
            ];
            let pdu = [
                0x03,       // Function Code (Read Holding Registers)
                0x00, 0x00, // Starting Address (0)
                0x00, 0x01, // Quantity (1 register)
            ];

            let mut request = Vec::new();
            request.extend_from_slice(&mbap_header);
            request.extend_from_slice(&pdu);

            match timeout(Duration::from_millis(2000), stream.write_all(&request)).await {
                Ok(Ok(_)) => {
                    // 尝试读取响应
                    let mut response = [0u8; 256];
                    match timeout(Duration::from_millis(2000), stream.read(&mut response)).await {
                        Ok(Ok(bytes_read)) if bytes_read > 0 => {
                            Ok(format!("Modbus通信成功，收到{}字节响应: {:02X?}",
                                bytes_read, &response[..std::cmp::min(bytes_read, 16)]))
                        }
                        Ok(Ok(_)) => Err("收到空响应".to_string()),
                        Ok(Err(e)) => Err(format!("读取响应失败: {}", e)),
                        Err(_) => Err("读取响应超时".to_string()),
                    }
                }
                Ok(Err(e)) => Err(format!("发送请求失败: {}", e)),
                Err(_) => Err("发送请求超时".to_string()),
            }
        }
        Err(e) => Err(format!("TCP连接失败: {} (kind: {:?})", e, e.kind())),
    }
}

async fn test_system_connectivity() {
    use std::process::Command;

    println!("  💻 运行环境: {}", std::env::consts::OS);
    println!("  🏠 当前用户: {}", std::env::var("USER").unwrap_or("unknown".to_string()));

    // 检查网络接口
    if cfg!(target_os = "macos") {
        if let Ok(output) = Command::new("ifconfig").arg("-a").output() {
            let interfaces = String::from_utf8_lossy(&output.stdout);
            let interface_count = interfaces.matches("inet ").count();
            println!("  🌐 网络接口: 找到{}个IP地址", interface_count);

            // 提取主要IP地址
            for line in interfaces.lines() {
                if line.trim().starts_with("inet ") && !line.contains("127.0.0.1") {
                    if let Some(ip) = line.trim().split_whitespace().nth(1) {
                        println!("    📍 本机IP: {}", ip);
                    }
                }
            }
        }
    }

    // 检查路由表
    if cfg!(target_os = "macos") {
        if let Ok(output) = Command::new("netstat").args(["-rn", "-f", "inet"]).output() {
            let routes = String::from_utf8_lossy(&output.stdout);
            let default_routes: Vec<&str> = routes.lines()
                .filter(|line| line.starts_with("default"))
                .collect();

            if !default_routes.is_empty() {
                println!("  🛣️  默认路由: {}", default_routes.len());
                for route in default_routes.iter().take(2) {
                    println!("    {}", route);
                }
            }
        }
    }
}