#!/bin/bash

# 测试地址段刷新功能的脚本

echo "🔧 测试地址段刷新功能..."
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
echo "📋 地址段刷新功能实现总结："
echo "✅ 创建了 AddressRangeContext 进行全局状态管理"
echo "✅ 修改了 useAddressRanges hook 支持变化回调"
echo "✅ 更新了 App.tsx 使用包装组件管理地址段状态"
echo "✅ 修改了 AddressRangeManager 移除页面刷新逻辑"
echo "✅ 更新了 BatchCollection 使用 context 获取地址段"
echo "✅ 更新了 DataReader 使用 context 获取地址段"
echo ""
echo "🔍 功能验证方法："
echo "1. 启动应用: pnpm tauri dev"
echo "2. 添加地址段，观察采集和单次读取组件是否自动更新"
echo "3. 修改地址段，观察是否实时反映到各个组件"
echo "4. 删除地址段，观察组件是否正确处理"
echo ""
echo "💡 关键改进："
echo "- 移除了页面刷新，提供更流畅的用户体验"
echo "- 使用 React Context 进行高效的状态管理"
echo "- 组件会自动响应地址段的变化，无需手动刷新"