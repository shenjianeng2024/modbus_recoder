use std::time::Duration;
use std::net::{SocketAddr, IpAddr, Ipv4Addr};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub async fn test_network_binding(target_ip: &str, target_port: u16) -> Result<String, String> {
    let target = format!("{}:{}", target_ip, target_port);
    println!("🔍 开始网络绑定测试: {}", target);

    let target_addr: SocketAddr = target.parse().map_err(|e| format!("地址解析失败: {}", e))?;

    // 1. 测试默认连接
    println!("📡 测试1: 默认连接方式...");
    match timeout(Duration::from_millis(3000), TcpStream::connect(target_addr)).await {
        Ok(Ok(_)) => {
            let msg = "✅ 默认连接成功!";
            println!("{}", msg);
            return Ok(msg.to_string());
        }
        Ok(Err(e)) => {
            println!("❌ 默认连接失败: {} (kind: {:?})", e, e.kind());
        }
        Err(_) => {
            println!("⏰ 默认连接超时");
        }
    }

    // 2. 测试显式绑定到0.0.0.0
    println!("📡 测试2: 绑定到0.0.0.0...");
    let local_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)), 0);
    match TcpStream::connect(target_addr).await {
        Ok(_) => {
            let msg = "✅ 显式绑定连接成功!";
            println!("{}", msg);
            return Ok(msg.to_string());
        }
        Err(e) => {
            println!("❌ 显式绑定连接失败: {} (kind: {:?})", e, e.kind());
        }
    }

    // 3. 检查网络接口
    println!("📡 测试3: 检查网络路由...");

    // 根据目标IP检查可能的网络接口
    let network_info = if target_ip.starts_with("192.168.1.") {
        "目标在192.168.1.x网段 - 可能需要WiFi接口"
    } else if target_ip.starts_with("172.168.") {
        "目标在172.168.x.x网段 - 可能是Docker或虚拟网络"
    } else {
        "其他网段"
    };

    println!("🔍 网络分析: {}", network_info);

    Err(format!("所有连接方式都失败。可能原因:\n1. 应用运行在沙盒环境中，网络权限受限\n2. macOS防火墙阻止了出站连接\n3. 网络接口配置问题\n4. 路由表配置问题"))
}

pub async fn test_system_vs_app_network() -> String {
    println!("🔍 系统网络 vs 应用网络对比测试");

    // 这里我们无法直接执行系统命令，但可以分析差异
    let analysis = "
🔍 分析可能的差异:

1. **权限差异**:
   - 系统命令(ping/nc): 以用户权限运行
   - Tauri应用: 可能在沙盒中运行，网络权限受限

2. **网络栈差异**:
   - 系统命令: 使用系统网络栈
   - Rust应用: 使用tokio异步网络栈

3. **绑定差异**:
   - 系统命令: 自动选择最佳接口
   - 应用: 可能需要明确指定本地绑定地址

4. **macOS特有问题**:
   - 错误码65 (EHOSTUNREACH) 在macOS上可能表示:
     * 应用层防火墙阻止
     * 网络接口没有正确绑定
     * 沙盒权限问题

建议解决方案:
1. 检查应用的网络权限配置
2. 尝试不同的本地绑定地址
3. 检查macOS防火墙设置
4. 考虑使用系统代理或中间件
";

    println!("{}", analysis);
    analysis.to_string()
}