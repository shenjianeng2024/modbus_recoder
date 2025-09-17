use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

pub async fn test_tcp_connection(ip: &str, port: u16) -> Result<String, String> {
    let address = format!("{}:{}", ip, port);
    println!("🔍 开始TCP连接测试: {}", address);

    // 解析地址
    let socket_addr: SocketAddr = match address.parse() {
        Ok(addr) => {
            println!("✅ 地址解析成功: {}", addr);
            addr
        }
        Err(e) => {
            let error = format!("❌ 地址解析失败: {}", e);
            println!("{}", error);
            return Err(error);
        }
    };

    // 尝试直接TCP连接
    println!("🚀 尝试建立TCP连接...");
    match timeout(Duration::from_millis(5000), TcpStream::connect(socket_addr)).await {
        Ok(Ok(stream)) => {
            let result = format!(
                "✅ TCP连接成功! 本地地址: {:?}, 远程地址: {:?}",
                stream.local_addr(),
                stream.peer_addr()
            );
            println!("{}", result);
            Ok(result)
        }
        Ok(Err(e)) => {
            let error = format!("❌ TCP连接失败: {} (错误类型: {:?})", e, e.kind());
            println!("{}", error);
            Err(error)
        }
        Err(_) => {
            let error = format!("❌ TCP连接超时 (5秒)");
            println!("{}", error);
            Err(error)
        }
    }
}

pub async fn test_modbus_tcp_connection(
    ip: &str,
    port: u16,
    slave_id: u8,
) -> Result<String, String> {
    use std::net::SocketAddr;
    use tokio_modbus::prelude::*;

    let address = format!("{}:{}", ip, port);
    println!(
        "🔍 开始Modbus TCP连接测试: {} (从站ID: {})",
        address, slave_id
    );

    let socket_addr: SocketAddr = match address.parse() {
        Ok(addr) => {
            println!("✅ 地址解析成功: {}", addr);
            addr
        }
        Err(e) => {
            let error = format!("❌ 地址解析失败: {}", e);
            println!("{}", error);
            return Err(error);
        }
    };

    println!("🚀 尝试建立Modbus TCP连接...");

    // 先尝试新的API (tokio-modbus 0.16+)
    let connection_result = timeout(Duration::from_millis(5000), tcp::connect(socket_addr)).await;

    match connection_result {
        Ok(Ok(mut ctx)) => {
            println!("✅ Modbus TCP连接成功!");

            // 尝试读取一个简单的寄存器来测试通信
            match timeout(
                Duration::from_millis(3000),
                ctx.read_holding_registers(0, 1),
            )
            .await
            {
                Ok(Ok(data)) => {
                    let result = format!("✅ Modbus通信测试成功! 读取到数据: {:?}", data);
                    println!("{}", result);
                    Ok(result)
                }
                Ok(Err(e)) => {
                    let result = format!("⚠️ Modbus连接成功但通信失败: {}", e);
                    println!("{}", result);
                    Ok(result) // 连接成功，只是通信有问题
                }
                Err(_) => {
                    let result = format!("⚠️ Modbus连接成功但通信超时");
                    println!("{}", result);
                    Ok(result)
                }
            }
        }
        Ok(Err(e)) => {
            let error = format!("❌ Modbus TCP连接失败: {:?}", e);
            println!("{}", error);
            Err(error)
        }
        Err(_) => {
            let error = format!("❌ Modbus TCP连接超时 (5秒)");
            println!("{}", error);
            Err(error)
        }
    }
}
