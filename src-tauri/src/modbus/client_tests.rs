#[cfg(test)]
mod tests {
    use crate::modbus::client::ModbusClient;
    use crate::modbus::types::AddressRange;

    #[test]
    fn test_address_range_with_data_type() {
        // 测试带数据类型的地址范围创建
        let range = AddressRange::new_with_type(0, 4, "float32");
        assert_eq!(range.start, 0);
        assert_eq!(range.count, 4);
        assert_eq!(range.data_type, "float32");
        assert!(range.is_valid());
    }

    #[test]
    fn test_address_range_default_data_type() {
        // 测试默认数据类型
        let range = AddressRange::new(0, 2);
        assert_eq!(range.data_type, "uint16");
    }

    #[test]
    fn test_float32_parsing() {
        // 测试 float32 解析逻辑
        // 使用已知的 IEEE 754 值进行测试
        // 0x40490FDB = 3.1415927410125732 (π 的近似值)
        let high_word: u16 = 0x4049;
        let low_word: u16 = 0x0FDB;

        // 组合成 32 位整数
        let raw_value = ((high_word as u32) << 16) | (low_word as u32);

        // 转换为 f32
        let float_value = f32::from_bits(raw_value);

        // 验证结果
        assert!((float_value - 3.1415927).abs() < 0.0001);

        // 测试字符串表示
        let parsed_str = float_value.to_string();
        assert!(parsed_str.starts_with("3.14159"));
    }

    #[test]
    fn test_create_address_result_float32() {
        // 测试创建带 float32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x4049;
        let next_value = Some(0x0FDB);

        let result = ModbusClient::create_address_result(
            addr, value, "dec", timestamp, None, "float32", next_value,
        );

        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x40490FDB);
        assert!(result.parsed_value.starts_with("3.14159"));
        assert_eq!(result.data_type, "float32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_uint16() {
        // 测试创建 uint16 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 1234;

        let result = ModbusClient::create_address_result(
            addr, value, "hex", timestamp, None, "uint16", None,
        );

        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 1234);
        assert_eq!(result.parsed_value, "0x04D2");
        assert_eq!(result.data_type, "uint16");
        assert!(result.success);
    }

    #[test]
    fn test_float32_special_values() {
        // 测试特殊的 float32 值

        // 测试 0.0
        let zero_bits = 0x00000000u32;
        let zero = f32::from_bits(zero_bits);
        assert_eq!(zero, 0.0);

        // 测试 NaN
        let nan_bits = 0x7FC00000u32;
        let nan = f32::from_bits(nan_bits);
        assert!(nan.is_nan());

        // 测试正无穷
        let inf_bits = 0x7F800000u32;
        let inf = f32::from_bits(inf_bits);
        assert!(inf.is_infinite() && inf.is_sign_positive());

        // 测试负无穷
        let neg_inf_bits = 0xFF800000u32;
        let neg_inf = f32::from_bits(neg_inf_bits);
        assert!(neg_inf.is_infinite() && neg_inf.is_sign_negative());
    }

    #[test]
    fn test_float32_edge_cases() {
        // 测试 float32 的边界情况

        // 最大正浮点数
        let max_float_bits = 0x7F7FFFFFu32;
        let max_float = f32::from_bits(max_float_bits);
        assert!(max_float > 0.0 && max_float.is_finite());

        // 最小正非零浮点数
        let min_float_bits = 0x00000001u32;
        let min_float = f32::from_bits(min_float_bits);
        assert!(min_float > 0.0 && min_float < 1e-38);

        // 测试 -0.0
        let neg_zero_bits = 0x80000000u32;
        let neg_zero = f32::from_bits(neg_zero_bits);
        assert_eq!(neg_zero, -0.0);
    }

    #[test]
    fn test_float32_byte_order_diagnosis() {
        // 诊断字节序问题
        // 使用已知的IEEE 754值：π ≈ 3.1415927 = 0x40490FDB

        // 测试当前实现 (high << 16 | low)
        let current_result = ModbusClient::create_address_result(
            0,
            0x4049,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(0x0FDB),
        );

        // 验证raw_value组合
        assert_eq!(current_result.raw_value, 0x40490FDB);

        // 验证解析值
        let expected_pi = 3.1415927f32;
        let parsed_float: f32 = current_result.parsed_value.parse().unwrap();
        assert!(
            (parsed_float - expected_pi).abs() < 0.0001,
            "Expected ~{}, got {}",
            expected_pi,
            parsed_float
        );

        // 测试反向字节序情况
        let reversed_result = ModbusClient::create_address_result(
            0,
            0x0FDB,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(0x4049),
        );

        // 这个应该产生不同的结果
        assert_ne!(reversed_result.raw_value, current_result.raw_value);
        println!(
            "Current order (0x4049, 0x0FDB): {} -> {}",
            current_result.raw_value, current_result.parsed_value
        );
        println!(
            "Reversed order (0x0FDB, 0x4049): {} -> {}",
            reversed_result.raw_value, reversed_result.parsed_value
        );
    }

    #[test]
    fn test_float32_single_address_fallback() {
        // 测试单地址读取时的fallback行为
        let result = ModbusClient::create_address_result(
            0,
            0x4049,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            None,
        );

        // 当没有next_value时，应该fallback到uint16
        assert_eq!(result.data_type, "uint16");
        assert_eq!(result.raw_value, 0x4049);
        assert_eq!(result.parsed_value, "16457"); // 0x4049 in decimal
        assert!(result.success);
    }

    #[test]
    fn test_float32_actual_parsing_scenario() {
        // 模拟实际的数据解析场景
        // 假设我们从modbus读取到的数据是 [0x4049, 0x0FDB]
        let raw_data = vec![0x4049u16, 0x0FDB];

        // 模拟批量读取中的处理逻辑
        // 这里模拟的是client.rs中第438-443行的逻辑
        let addr = 100;
        let timestamp = "2024-01-01T00:00:00Z";
        let format_str = "dec";
        let data_type = "float32";

        let result = ModbusClient::create_address_result(
            addr,
            raw_data[0], // data[i]
            format_str,
            timestamp,
            None,
            data_type,
            Some(raw_data[1]), // data[i+1]
        );

        // 验证结果
        assert_eq!(result.address, addr);
        assert_eq!(result.data_type, "float32");
        assert_eq!(result.raw_value, 0x40490FDB);
        assert!(result.parsed_value.starts_with("3.14159"));
        assert!(result.success);

        println!(
            "Simulated batch read result: addr={}, raw=0x{:08X}, parsed={}",
            result.address, result.raw_value, result.parsed_value
        );
    }

    #[test]
    fn test_float32_zero_cases() {
        // 测试可能导致0解析结果的情况

        // 情况1：数据确实是0
        let result_zero = ModbusClient::create_address_result(
            0,
            0x0000,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(0x0000),
        );
        assert_eq!(result_zero.raw_value, 0x00000000);
        assert_eq!(result_zero.parsed_value, "0");

        // 情况2：一个寄存器是0，另一个不是
        let result_mixed = ModbusClient::create_address_result(
            0,
            0x0000,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(0x4049),
        );
        assert_eq!(result_mixed.raw_value, 0x00004049);
        let parsed_mixed: f32 = result_mixed.parsed_value.parse().unwrap();
        println!(
            "Mixed case (0x0000, 0x4049): raw=0x{:08X}, parsed={}",
            result_mixed.raw_value, parsed_mixed
        );

        // 情况3：数据读取失败但没有错误消息
        let result_fallback = ModbusClient::create_address_result(
            0,
            0x4049,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            None,
        );
        // 这种情况应该fallback到uint16
        assert_eq!(result_fallback.data_type, "uint16");
        assert_ne!(result_fallback.parsed_value, "0");

        // 情况4：测试一些可能出现问题的边界值
        let result_very_small = ModbusClient::create_address_result(
            0,
            0x0000,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(0x0001),
        );
        assert_eq!(result_very_small.raw_value, 0x00000001);
        let parsed_very_small: f32 = result_very_small.parsed_value.parse().unwrap();
        println!(
            "Very small float (0x0000, 0x0001): raw=0x{:08X}, parsed={}",
            result_very_small.raw_value, parsed_very_small
        );
        assert!(parsed_very_small > 0.0);
        assert!(parsed_very_small < 1e-38);
    }

    #[test]
    fn test_float32_string_formatting() {
        // 测试字符串格式化是否可能导致显示问题

        // 测试常见的浮点数值
        let test_cases = vec![
            (0x3F800000, 1.0f32),       // 1.0
            (0x40000000, 2.0f32),       // 2.0
            (0x40490FDB, 3.1415927f32), // π
            (0x42280000, 42.0f32),      // 42.0
            (0x447A0000, 1000.0f32),    // 1000.0
        ];

        for (raw_bits, expected_value) in test_cases {
            let high_word = (raw_bits >> 16) as u16;
            let low_word = (raw_bits & 0xFFFF) as u16;

            let result = ModbusClient::create_address_result(
                0,
                high_word,
                "dec",
                "2024-01-01T00:00:00Z",
                None,
                "float32",
                Some(low_word),
            );

            assert_eq!(result.raw_value, raw_bits);
            let parsed_float: f32 = result.parsed_value.parse().unwrap();
            assert!(
                (parsed_float - expected_value).abs() < 0.0001,
                "Raw: 0x{:08X}, Expected: {}, Got: {}, String: '{}'",
                raw_bits,
                expected_value,
                parsed_float,
                result.parsed_value
            );

            println!(
                "Test case 0x{:08X} -> {} (string: '{}')",
                raw_bits, expected_value, result.parsed_value
            );
        }
    }

    #[test]
    fn test_float32_byte_order_support() {
        use crate::modbus::types::ByteOrder;

        // 测试字节序配置功能
        // 使用π的IEEE 754表示：0x40490FDB
        let high_word = 0x4049u16;
        let low_word = 0x0FDBu16;

        // 大端序测试 (标准Modbus)
        let big_endian_result = ModbusClient::create_address_result_with_byte_order(
            0,
            high_word,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(low_word),
            &ByteOrder::BigEndian,
        );
        assert_eq!(big_endian_result.raw_value, 0x40490FDB);
        let big_endian_float: f32 = big_endian_result.parsed_value.parse().unwrap();
        assert!((big_endian_float - 3.1415927).abs() < 0.0001);

        // 小端序测试 (某些设备)
        let little_endian_result = ModbusClient::create_address_result_with_byte_order(
            0,
            high_word,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "float32",
            Some(low_word),
            &ByteOrder::LittleEndian,
        );
        assert_eq!(little_endian_result.raw_value, 0x0FDB4049);
        let little_endian_float: f32 = little_endian_result.parsed_value.parse().unwrap();
        assert_ne!(big_endian_float, little_endian_float); // 应该是不同的值

        println!(
            "Big Endian (0x4049, 0x0FDB): raw=0x{:08X}, parsed={}",
            big_endian_result.raw_value, big_endian_result.parsed_value
        );
        println!(
            "Little Endian (0x4049, 0x0FDB): raw=0x{:08X}, parsed={}",
            little_endian_result.raw_value, little_endian_result.parsed_value
        );
    }

    #[test]
    fn test_uint32_int32_byte_order_support() {
        use crate::modbus::types::ByteOrder;

        // 测试uint32和int32的字节序支持
        let high_word = 0x1234u16;
        let low_word = 0x5678u16;

        // uint32 大端序
        let uint32_be = ModbusClient::create_address_result_with_byte_order(
            0,
            high_word,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "uint32",
            Some(low_word),
            &ByteOrder::BigEndian,
        );
        assert_eq!(uint32_be.raw_value, 0x12345678);
        assert_eq!(uint32_be.parsed_value, "305419896");

        // uint32 小端序
        let uint32_le = ModbusClient::create_address_result_with_byte_order(
            0,
            high_word,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "uint32",
            Some(low_word),
            &ByteOrder::LittleEndian,
        );
        assert_eq!(uint32_le.raw_value, 0x56781234);
        assert_eq!(uint32_le.parsed_value, "1450709556");

        // int32 测试（负数）
        let neg_high = 0xFFFFu16;
        let neg_low = 0xFFFFu16;

        let int32_be = ModbusClient::create_address_result_with_byte_order(
            0,
            neg_high,
            "dec",
            "2024-01-01T00:00:00Z",
            None,
            "int32",
            Some(neg_low),
            &ByteOrder::BigEndian,
        );
        assert_eq!(int32_be.raw_value, 0xFFFFFFFF);
        assert_eq!(int32_be.parsed_value, "-1");

        println!(
            "uint32 BE: 0x{:08X} -> {}",
            uint32_be.raw_value, uint32_be.parsed_value
        );
        println!(
            "uint32 LE: 0x{:08X} -> {}",
            uint32_le.raw_value, uint32_le.parsed_value
        );
        println!(
            "int32 BE (all FF): 0x{:08X} -> {}",
            int32_be.raw_value, int32_be.parsed_value
        );
    }

    #[test]
    fn test_float32_ieee754_special_values() {
        use crate::modbus::types::ByteOrder;

        // 测试IEEE 754特殊值的正确处理
        let test_cases = vec![
            (0x00000000, "0", "正零"),
            (0x80000000, "-0", "负零"),
            (0x7F800000, "inf", "正无穷"),
            (0xFF800000, "-inf", "负无穷"),
            (0x7FC00000, "NaN", "NaN"),
            (0x3F800000, "1", "1.0"),
            (0xBF800000, "-1", "-1.0"),
        ];

        for (raw_bits, expected_prefix, description) in test_cases {
            let high_word = (raw_bits >> 16) as u16;
            let low_word = (raw_bits & 0xFFFF) as u16;

            // 大端序测试
            let result = ModbusClient::create_address_result_with_byte_order(
                0,
                high_word,
                "dec",
                "2024-01-01T00:00:00Z",
                None,
                "float32",
                Some(low_word),
                &ByteOrder::BigEndian,
            );

            assert_eq!(result.raw_value, raw_bits);
            assert!(
                result.parsed_value.starts_with(expected_prefix),
                "{}: Expected to start with '{}', got '{}'",
                description,
                expected_prefix,
                result.parsed_value
            );

            println!(
                "{}: 0x{:08X} -> '{}'",
                description, raw_bits, result.parsed_value
            );
        }
    }

    #[test]
    fn test_float32_precision_and_rounding() {
        use crate::modbus::types::ByteOrder;

        // 测试浮点数精度和舍入行为
        let test_cases = vec![
            // 一些常见的浮点数及其IEEE 754表示
            (0x40490FDB, 3.1415927), // π
            (0x402DF854, 2.718282),  // e
            (0x3DCCCCCD, 0.1),       // 0.1 (无法精确表示)
            (0x3E4CCCCD, 0.2),       // 0.2
            (0x3ECCCCCD, 0.4),       // 0.4
        ];

        for (raw_bits, expected_value) in test_cases {
            let high_word = (raw_bits >> 16) as u16;
            let low_word = (raw_bits & 0xFFFF) as u16;

            let result = ModbusClient::create_address_result_with_byte_order(
                0,
                high_word,
                "dec",
                "2024-01-01T00:00:00Z",
                None,
                "float32",
                Some(low_word),
                &ByteOrder::BigEndian,
            );

            let parsed_float: f32 = result.parsed_value.parse().unwrap();
            assert!(
                (parsed_float - expected_value as f32).abs() < 0.0001,
                "0x{:08X}: Expected ~{}, got {} (string: '{}')",
                raw_bits,
                expected_value,
                parsed_float,
                result.parsed_value
            );

            println!(
                "Precision test 0x{:08X}: expected={}, parsed={}, string='{}'",
                raw_bits, expected_value, parsed_float, result.parsed_value
            );
        }
    }

    #[test]
    fn test_create_address_result_uint32() {
        // 测试创建 uint32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x1234;
        let next_value = Some(0x5678);

        let result = ModbusClient::create_address_result(
            addr, value, "dec", timestamp, None, "uint32", next_value,
        );

        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x12345678);
        assert_eq!(result.parsed_value, "305419896");
        assert_eq!(result.data_type, "uint32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_int32() {
        // 测试创建 int32 类型的地址结果
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0xFFFF;
        let next_value = Some(0xFFFF);

        let result = ModbusClient::create_address_result(
            addr, value, "dec", timestamp, None, "int32", next_value,
        );

        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0xFFFFFFFF);
        assert_eq!(result.parsed_value, "-1");
        assert_eq!(result.data_type, "int32");
        assert!(result.success);
    }

    #[test]
    fn test_create_address_result_uint32_no_next_value() {
        // 测试 uint32 类型但没有下一个值的情况
        let timestamp = "2024-01-01T00:00:00Z";
        let addr = 100;
        let value = 0x1234;
        let next_value = None;

        let result = ModbusClient::create_address_result(
            addr, value, "dec", timestamp, None, "uint32", next_value,
        );

        assert_eq!(result.address, addr);
        assert_eq!(result.raw_value, 0x1234);
        assert_eq!(result.parsed_value, "4660");
        assert_eq!(result.data_type, "uint16");
        assert!(result.success);
    }
}
