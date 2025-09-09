#!/bin/bash

# 测试 f32 功能修复的脚本

echo "🔧 测试 f32 浮点数读取功能修复..."
echo ""

# 1. 编译 Rust 代码
echo "1. 编译 Rust 后端..."
cd src-tauri
cargo check --quiet
if [ $? -eq 0 ]; then
    echo "✅ Rust 编译成功"
else
    echo "❌ Rust 编译失败"
    exit 1
fi

# 2. 运行 Rust 测试
echo "2. 运行 Rust 测试..."
cargo test client_tests --quiet
if [ $? -eq 0 ]; then
    echo "✅ Rust 测试通过"
else
    echo "❌ Rust 测试失败"
    exit 1
fi

# 3. 编译前端
echo "3. 编译前端..."
cd ..
pnpm build --quiet
if [ $? -eq 0 ]; then
    echo "✅ 前端编译成功"
else
    echo "❌ 前端编译失败"
    exit 1
fi

echo ""
echo "🎉 所有编译检查通过！"
echo ""
echo "📋 修复内容总结："
echo "✅ 后端："
echo "   - AddressRange 结构添加 data_type 字段"
echo "   - 实现 f32 浮点数解析（IEEE 754 大端序）"
echo "   - 实现 u32 无符号32位整数解析（大端序）"
echo "   - 实现 i32 有符号32位整数解析（大端序）"
echo "   - 更新 create_address_result 方法支持多数据类型"
echo ""
echo "✅ 前端："
echo "   - 修复 DataReader.tsx 中的 data_type 参数传递"
echo "   - 修复 BatchCollection.tsx 中的 data_type 参数传递"
echo "   - 更新 AddressRange 类型定义"
echo ""
echo "🔍 使用方法："
echo "1. 在地址范围管理中，设置数据类型为 'float32'、'uint32'、'int32' 或 'int16'"
echo "2. 对于32位数据类型（float32/uint32/int32），确保地址长度为偶数（需要 2 个寄存器）"
echo "3. 对于16位数据类型（uint16/int16），地址长度可以是任意值"
echo "4. 执行读取操作，将会看到对应数据类型的解析值"
echo ""
echo "📝 例如："
echo "   - 地址：100"
echo "   - 长度：4（会读取 100,101,102,103，组成 2 个32位值）"
echo "   - 数据类型：float32/uint32/int32"
echo ""
echo ""