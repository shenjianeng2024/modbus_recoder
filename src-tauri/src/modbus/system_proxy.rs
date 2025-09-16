use std::process::{Command, Stdio};
use std::io::{Write, Read};
use std::time::Duration;
use tokio::time::sleep;

/// 使用系统nc命令作为TCP代理来绕过Rust网络栈问题
#[derive(Debug)]
pub struct SystemTcpProxy {
    ip: String,
    port: u16,
}

impl SystemTcpProxy {
    pub fn new(ip: &str, port: u16) -> Self {
        Self {
            ip: ip.to_string(),
            port,
        }
    }

    /// 测试连接可达性
    pub async fn test_connection(&self) -> Result<String, String> {
        // 使用nc测试连接
        let output = Command::new("nc")
            .args(["-zv", &self.ip, &self.port.to_string()])
            .output()
            .map_err(|e| format!("nc命令失败: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("succeeded") {
            Ok(format!("系统级连接成功: {}", stderr.trim()))
        } else {
            Err(format!("系统级连接失败: {}", stderr.trim()))
        }
    }

    /// 发送Modbus请求并获取响应
    pub async fn send_modbus_request(&self, request: &[u8]) -> Result<Vec<u8>, String> {
        // 使用nc建立连接并发送数据
        let mut child = Command::new("nc")
            .args([&self.ip, &self.port.to_string()])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动nc进程失败: {}", e))?;

        // 发送请求
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(request)
                .map_err(|e| format!("发送数据失败: {}", e))?;
            // 关闭stdin以发送数据
            drop(stdin);
        }

        // 等待一下响应
        sleep(Duration::from_millis(500)).await;

        // 读取响应
        let output = child.wait_with_output()
            .map_err(|e| format!("等待响应失败: {}", e))?;

        if output.status.success() && !output.stdout.is_empty() {
            Ok(output.stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Modbus请求失败: {}", stderr))
        }
    }

    /// 读取保持寄存器 (Modbus功能码03)
    pub async fn read_holding_registers(&self, slave_id: u8, start_addr: u16, count: u16) -> Result<Vec<u16>, String> {
        // 构建Modbus TCP请求
        let transaction_id = 0x0001u16;
        let protocol_id = 0x0000u16;
        let length = 6u16;
        let function_code = 0x03u8;

        let mut request = Vec::new();

        // MBAP Header
        request.extend_from_slice(&transaction_id.to_be_bytes());
        request.extend_from_slice(&protocol_id.to_be_bytes());
        request.extend_from_slice(&length.to_be_bytes());
        request.push(slave_id);

        // PDU
        request.push(function_code);
        request.extend_from_slice(&start_addr.to_be_bytes());
        request.extend_from_slice(&count.to_be_bytes());

        // 发送请求
        let response = self.send_modbus_request(&request).await?;

        // 解析响应
        if response.len() < 9 {
            return Err("响应太短".to_string());
        }

        // 检查响应头
        let resp_transaction_id = u16::from_be_bytes([response[0], response[1]]);
        let resp_protocol_id = u16::from_be_bytes([response[2], response[3]]);
        let resp_slave_id = response[6];
        let resp_function_code = response[7];

        if resp_transaction_id != transaction_id {
            return Err("Transaction ID不匹配".to_string());
        }

        if resp_protocol_id != protocol_id {
            return Err("Protocol ID不匹配".to_string());
        }

        if resp_slave_id != slave_id {
            return Err("Slave ID不匹配".to_string());
        }

        // 检查是否是异常响应
        if resp_function_code & 0x80 != 0 {
            let exception_code = response[8];
            return Err(format!("Modbus异常响应: 0x{:02X}", exception_code));
        }

        if resp_function_code != function_code {
            return Err("Function Code不匹配".to_string());
        }

        // 解析数据
        let byte_count = response[8] as usize;
        if response.len() < 9 + byte_count {
            return Err("数据长度不足".to_string());
        }

        let mut values = Vec::new();
        for i in (0..byte_count).step_by(2) {
            if 9 + i + 1 < response.len() {
                let value = u16::from_be_bytes([response[9 + i], response[9 + i + 1]]);
                values.push(value);
            }
        }

        Ok(values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_system_proxy() {
        let proxy = SystemTcpProxy::new("192.168.1.199", 502);

        match proxy.test_connection().await {
            Ok(msg) => println!("连接测试成功: {}", msg),
            Err(msg) => println!("连接测试失败: {}", msg),
        }

        match proxy.read_holding_registers(1, 0, 1).await {
            Ok(values) => println!("读取成功: {:?}", values),
            Err(msg) => println!("读取失败: {}", msg),
        }
    }
}