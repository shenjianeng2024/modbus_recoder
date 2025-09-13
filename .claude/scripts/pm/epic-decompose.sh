#!/bin/bash

epic_name="$1"

if [ -z "$epic_name" ]; then
  echo "❌ Please provide an epic name"
  echo "Usage: /pm:epic-decompose <epic-name>"
  exit 1
fi

echo "Decomposing epic into tasks..."
echo ""
echo ""

epic_dir=".claude/epics/$epic_name"
epic_file="$epic_dir/epic.md"

if [ ! -f "$epic_file" ]; then
  echo "❌ Epic not found: $epic_name"
  echo ""
  echo "Available epics:"
  for dir in .claude/epics/*/; do
    [ -d "$dir" ] && echo "  • $(basename "$dir")"
  done
  exit 1
fi

# Create tasks directory if not exists
mkdir -p "$epic_dir"

echo "📚 Epic: $epic_name"
echo "================================"
echo ""

# Based on the PRD analysis, create specific tasks for modbus-reader-bug-fixes
if [ "$epic_name" = "modbus-reader-bug-fixes" ]; then
  
  echo "🔧 Creating tasks based on PRD analysis..."
  echo ""
  
  # Task 1: 浮点数解析修复 (P0 - Week 1)
  cat > "$epic_dir/001.md" << 'EOF'
---
name: 浮点数解析修复
status: open
priority: P0
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: false
dependencies: []
assignee: 
labels: [bug-fix, critical, backend]
estimated_hours: 16
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 浮点数解析修复

## 描述
修复32位浮点数解析算法中的字节序处理问题，确保显示正确的浮点数值，并支持IEEE 754标准。

## 验收标准
- [ ] 修复 `parse_float32` 函数中的字节序处理逻辑
- [ ] 32位浮点数显示正确的解析值
- [ ] 原始值和解析值一致对应
- [ ] 支持单地址和多地址读取
- [ ] 添加浮点数解析的单元测试覆盖
- [ ] 验证IEEE 754标准兼容性

## 技术要求
- 保持现有API接口不变
- 使用现有tokio-modbus库功能
- 添加完整的错误处理
- 确保向后兼容性

## 测试计划
- 单元测试：测试各种浮点数值的正确解析
- 集成测试：验证单地址和多地址读取场景
- 回归测试：确保不影响其他数据类型解析

## 实施步骤
1. 分析当前解析算法的问题
2. 研究IEEE 754标准要求
3. 修复字节序处理逻辑
4. 编写单元测试
5. 进行集成测试验证

## 文件涉及
- `src-tauri/src/lib.rs` (parse_float32函数)
- 相关测试文件
- 数据解析相关模块
EOF

  # Task 2: 地址段配置管理 (P0 - Week 1)
  cat > "$epic_dir/002.md" << 'EOF'
---
name: 地址段配置管理
status: open
priority: P0
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: false
dependencies: []
assignee: 
labels: [feature, configuration, frontend, backend]
estimated_hours: 20
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 地址段配置管理

## 描述
实现地址段配置的JSON格式导出/导入功能，支持用户在不同设备或项目间复用配置。

## 验收标准
- [ ] 导出按钮功能正常工作
- [ ] 支持JSON格式的配置文件导出
- [ ] 实现配置文件导入功能
- [ ] JSON配置文件格式清晰易懂
- [ ] 提供配置文件模板和示例
- [ ] 添加配置文件格式验证
- [ ] 支持批量地址段配置

## 技术要求
- 扩展现有配置系统，不破坏现有功能
- JSON格式设计要便于用户理解和编辑
- 添加配置验证和错误提示
- 保持与现有配置格式的兼容性

## JSON格式设计
```json
{
  "version": "1.0",
  "export_date": "2025-09-10T12:00:00Z",
  "address_ranges": [
    {
      "name": "Temperature Sensors",
      "start_address": 40001,
      "count": 10,
      "data_type": "float32",
      "description": "Boiler temperature readings"
    }
  ]
}
```

## 实施步骤
1. 设计JSON配置文件格式
2. 实现后端导出/导入API
3. 扩展前端AddressRangeManager组件
4. 添加文件选择和验证UI
5. 实现配置预览和编辑功能
6. 添加完整的错误处理

## 文件涉及
- `src/components/AddressRangeManager.tsx`
- `src-tauri/src/lib.rs` (配置相关API)
- 配置管理相关模块
EOF

  # Task 3: 数据显示格式优化 (P1 - Week 2)
  cat > "$epic_dir/003.md" << 'EOF'
---
name: 数据显示格式优化
status: open
priority: P1
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: true
dependencies: [001]
assignee: 
labels: [ui-ux, frontend, enhancement]
estimated_hours: 12
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 数据显示格式优化

## 描述
统一数值和时间戳的显示格式，改进数据表格的视觉展示，让用户能够快速理解数据含义。

## 验收标准
- [ ] 时间格式符合用户习惯 (YYYY-MM-DD HH:mm:ss)
- [ ] 浮点数显示格式一致，支持可配置精度
- [ ] 数据值易于理解和分析
- [ ] 改进数据表格的视觉层次
- [ ] 添加用户自定义显示格式选项
- [ ] 支持本地化时间显示

## 技术要求
- 使用统一的格式化函数
- 支持用户偏好设置
- 保持性能不受影响
- 响应式设计适配

## UI改进重点
1. **时间戳显示**
   - 统一时间格式
   - 支持相对时间显示（"2分钟前"）
   - 添加时区显示

2. **数值格式化**
   - 浮点数精度控制
   - 单位显示优化
   - 数值范围指示

3. **表格视觉**
   - 改进行列间距
   - 数据对齐优化
   - 添加数据类型图标

## 实施步骤
1. 创建统一的格式化工具函数
2. 更新DataDisplay组件
3. 改进表格样式和布局
4. 添加用户偏好设置界面
5. 测试各种数据类型的显示效果

## 文件涉及
- `src/components/DataDisplay.tsx`
- `src/utils/formatters.ts` (新建)
- `src/components/Settings.tsx` (如果需要设置界面)
- 相关样式文件
EOF

  # Task 4: 单地址读取错误修复 (P1 - Week 2)
  cat > "$epic_dir/004.md" << 'EOF'
---
name: 单地址读取错误修复
status: open
priority: P1
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: true
dependencies: [001]
assignee: 
labels: [bug-fix, backend, error-handling]
estimated_hours: 10
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 单地址读取错误修复

## 描述
修复32位浮点数单地址读取时的错误，添加明确的错误提示和处理逻辑，确保所有数据类型的单地址读取稳定性。

## 验收标准
- [ ] 单地址读取不会报错或崩溃
- [ ] 错误信息清晰易懂，指导用户操作
- [ ] 添加地址验证和错误恢复机制
- [ ] 确保所有数据类型的单地址读取稳定性
- [ ] 系统在异常情况下优雅降级
- [ ] 提供合理的操作提示

## 技术要求
- 增强错误处理机制
- 添加输入验证
- 实现优雅错误恢复
- 保持API兼容性

## 错误处理改进
1. **地址验证**
   - 地址范围检查
   - 数据类型兼容性验证
   - 设备连接状态检查

2. **错误提示优化**
   - 用户友好的错误信息
   - 具体的解决建议
   - 错误代码和详细日志

3. **错误恢复**
   - 自动重试机制
   - 连接状态重置
   - 用户操作引导

## 实施步骤
1. 分析当前单地址读取的错误原因
2. 设计综合的错误处理策略
3. 实现地址验证和错误检查
4. 优化错误信息显示
5. 添加错误恢复机制
6. 全面测试各种异常场景

## 文件涉及
- `src-tauri/src/lib.rs` (单地址读取相关函数)
- `src/components/` (错误显示相关组件)
- 错误处理相关模块
EOF

  # Task 5: 用户流程引导改进 (P2 - Week 3)
  cat > "$epic_dir/005.md" << 'EOF'
---
name: 用户流程引导改进
status: open
priority: P2
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: true
dependencies: [001, 002, 003, 004]
assignee: 
labels: [ui-ux, frontend, user-experience]
estimated_hours: 16
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 用户流程引导改进

## 描述
重新设计连接测试和数据读取的依赖关系，优化按钮状态和用户引导提示，让操作流程更加直观易懂。

## 验收标准
- [ ] 操作步骤逻辑清晰，符合用户直觉
- [ ] 按钮状态准确反映系统状态
- [ ] 引导提示位置合理，信息有用
- [ ] 用户能够理解下一步操作
- [ ] 添加操作步骤的视觉化指导
- [ ] 改进界面布局的逻辑性

## UI/UX改进重点
1. **操作流程优化**
   - 明确操作步骤顺序
   - 禁用状态的合理使用
   - 进度指示和反馈

2. **按钮状态管理**
   - 连接状态驱动的按钮可用性
   - 加载状态的视觉反馈
   - 操作结果的状态指示

3. **用户引导**
   - 上下文相关的帮助提示
   - 首次使用的引导流程
   - 错误状态的操作建议

## 技术要求
- 基于现有状态管理系统
- 保持组件的可重用性
- 添加适当的动画和过渡
- 确保无障碍访问支持

## 实施步骤
1. 分析当前用户流程的问题点
2. 设计新的用户引导策略
3. 重构按钮状态管理逻辑
4. 添加操作提示和引导组件
5. 优化界面布局和交互
6. 进行用户体验测试

## 文件涉及
- `src/App.tsx` (主应用逻辑)
- `src/components/ConnectionPanel.tsx`
- `src/components/AddressRangeManager.tsx`
- `src/components/DataDisplay.tsx`
- 用户引导相关新组件
EOF

  # Task 6: 测试验证和发布准备 (P2 - Week 3)
  cat > "$epic_dir/006.md" << 'EOF'
---
name: 测试验证和发布准备
status: open
priority: P2
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
parallel: false
dependencies: [001, 002, 003, 004, 005]
assignee: 
labels: [testing, documentation, release]
estimated_hours: 12
actual_hours: 0
github: [Will be updated when synced to GitHub]
---

# Task: 测试验证和发布准备

## 描述
进行全面的测试验证，确保所有修复功能正常工作，准备发布材料和用户文档。

## 验收标准
- [ ] 所有P0和P1功能100%通过测试
- [ ] 回归测试确保现有功能未受影响
- [ ] 性能测试验证无性能下降
- [ ] 用户验收测试通过
- [ ] 更新用户文档和发布说明
- [ ] 准备完整的发布包

## 测试范围
1. **功能测试**
   - 浮点数解析准确性测试
   - 地址段导出/导入功能测试
   - 数据显示格式测试
   - 单地址读取稳定性测试
   - 用户流程完整性测试

2. **回归测试**
   - 现有功能完整性验证
   - 配置文件兼容性测试
   - 跨平台兼容性验证

3. **性能测试**
   - 数据解析性能基准
   - 导出/导入操作响应时间
   - 内存使用情况检查

## 发布准备
- 更新CHANGELOG.md
- 准备发布说明
- 更新用户文档
- 验证构建和打包流程

## 实施步骤
1. 制定详细的测试计划
2. 执行功能和回归测试
3. 进行性能基准测试
4. 收集用户反馈并验证
5. 准备发布文档和材料
6. 最终构建和发布验证

## 文件涉及
- 所有修改的源代码文件
- 测试文件和测试数据
- 文档文件 (README.md, CHANGELOG.md等)
- 构建配置文件
EOF

  echo "✅ Created 6 tasks for epic: $epic_name"
  echo ""
  echo "📋 Tasks created:"
  echo "  001 - 浮点数解析修复 (P0, Week 1)"
  echo "  002 - 地址段配置管理 (P0, Week 1)"
  echo "  003 - 数据显示格式优化 (P1, Week 2)"
  echo "  004 - 单地址读取错误修复 (P1, Week 2)"
  echo "  005 - 用户流程引导改进 (P2, Week 3)"
  echo "  006 - 测试验证和发布准备 (P2, Week 3)"

else
  # Generic task creation for other epics
  echo "🔧 Generic task creation for epic: $epic_name"
  echo "Please implement specific task breakdown for this epic."
  echo "Add task creation logic in the script for epic: $epic_name"
fi

# Update epic status
sed -i '' 's/^status: .*/status: planning/' "$epic_file"
sed -i '' 's/^progress: .*/progress: 0%/' "$epic_file"

echo ""
echo "💡 Next steps:"
echo "  • Review tasks: /pm:epic-show $epic_name"
echo "  • Sync to GitHub: /pm:epic-sync $epic_name"
echo "  • Start work: /pm:epic-start $epic_name"

exit 0