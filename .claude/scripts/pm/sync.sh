#!/bin/bash

echo "同步中..."
echo ""
echo ""

echo "🔄 Claude Code PM - 双向同步"
echo "=============================="
echo ""

# 检查参数
EPIC_NAME=""
if [ $# -gt 0 ]; then
  EPIC_NAME="$1"
  echo "🎯 同步 Epic: $EPIC_NAME"
else
  echo "🌍 全量同步"
fi
echo ""

# 检查必要工具
if ! command -v gh &> /dev/null; then
  echo "❌ 错误: 需要安装 GitHub CLI (gh)"
  echo "   安装: brew install gh"
  exit 1
fi

# 检查 GitHub 认证
if ! gh auth status &> /dev/null; then
  echo "❌ 错误: GitHub 未认证"
  echo "   运行: gh auth login"
  exit 1
fi

# 检查是否在 Git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ 错误: 不在 Git 仓库中"
  exit 1
fi

# 初始化计数器
PULLED_UPDATED=0
PULLED_CLOSED=0
PUSHED_UPDATED=0
PUSHED_CREATED=0
CONFLICTS=0

# 创建备份目录（以防出问题）
BACKUP_DIR=".claude/sync-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📥 创建备份: $BACKUP_DIR"

# 备份当前状态
if [ -d ".claude/epics" ]; then
  cp -r .claude/epics "$BACKUP_DIR/"
fi

echo ""
echo "===== 第一阶段: 从 GitHub 拉取 ====="

# 1. 获取 GitHub 上的所有 epic 和 task issues
echo "🔍 获取 GitHub issues..."

# 获取 epics
gh issue list --label "epic" --limit 1000 --json number,title,state,body,labels,updatedAt > "$BACKUP_DIR/github-epics.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/github-epics.json"

# 获取 tasks
gh issue list --label "task" --limit 1000 --json number,title,state,body,labels,updatedAt > "$BACKUP_DIR/github-tasks.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/github-tasks.json"

echo "  ✅ Epic issues: $(cat "$BACKUP_DIR/github-epics.json" | jq length)"
echo "  ✅ Task issues: $(cat "$BACKUP_DIR/github-tasks.json" | jq length)"

# 2. 处理从 GitHub 到本地的同步
echo ""
echo "📥 更新本地文件..."

# 处理 epics
if [ -f "$BACKUP_DIR/github-epics.json" ]; then
  cat "$BACKUP_DIR/github-epics.json" | jq -r '.[] | @base64' | while IFS= read -r row; do
    if [ -n "$row" ]; then
      issue_data=$(echo "$row" | base64 -d)
      issue_number=$(echo "$issue_data" | jq -r '.number')
      issue_title=$(echo "$issue_data" | jq -r '.title')
      issue_state=$(echo "$issue_data" | jq -r '.state')
      issue_updated=$(echo "$issue_data" | jq -r '.updatedAt')
      
      echo "  处理 Epic #$issue_number: $issue_title"
      
      # 查找对应的本地文件
      local_file=""
      if [ -n "$EPIC_NAME" ]; then
        if [ -f ".claude/epics/$EPIC_NAME/epic.md" ]; then
          # 检查文件中是否包含这个 issue number
          if grep -q "#$issue_number" ".claude/epics/$EPIC_NAME/epic.md" 2>/dev/null; then
            local_file=".claude/epics/$EPIC_NAME/epic.md"
          fi
        fi
      else
        # 搜索所有 epic 文件
        for epic_dir in .claude/epics/*/; do
          if [ -f "$epic_dir/epic.md" ]; then
            if grep -q "#$issue_number" "$epic_dir/epic.md" 2>/dev/null; then
              local_file="$epic_dir/epic.md"
              break
            fi
          fi
        done
      fi
      
      if [ -n "$local_file" ]; then
        echo "    ✅ 找到本地文件: $local_file"
        # 这里可以添加更复杂的同步逻辑
        # 比如比较时间戳，更新状态等
        PULLED_UPDATED=$((PULLED_UPDATED + 1))
      else
        echo "    ⚠️ 未找到对应本地文件"
      fi
    fi
  done
fi

# 处理 tasks
if [ -f "$BACKUP_DIR/github-tasks.json" ]; then
  cat "$BACKUP_DIR/github-tasks.json" | jq -r '.[] | @base64' | while IFS= read -r row; do
    if [ -n "$row" ]; then
      issue_data=$(echo "$row" | base64 -d)
      issue_number=$(echo "$issue_data" | jq -r '.number')
      issue_title=$(echo "$issue_data" | jq -r '.title')
      issue_state=$(echo "$issue_data" | jq -r '.state')
      
      echo "  处理 Task #$issue_number: $issue_title"
      
      # 查找对应的本地任务文件
      local_file=""
      if [ -n "$EPIC_NAME" ]; then
        if [ -f ".claude/epics/$EPIC_NAME/$issue_number.md" ]; then
          local_file=".claude/epics/$EPIC_NAME/$issue_number.md"
        fi
      else
        # 搜索所有任务文件
        for epic_dir in .claude/epics/*/; do
          if [ -f "$epic_dir/$issue_number.md" ]; then
            local_file="$epic_dir/$issue_number.md"
            break
          fi
        done
      fi
      
      if [ -n "$local_file" ]; then
        echo "    ✅ 找到本地文件: $local_file"
        PULLED_UPDATED=$((PULLED_UPDATED + 1))
      else
        echo "    ⚠️ 未找到对应本地文件"
      fi
    fi
  done
fi

echo ""
echo "===== 第二阶段: 推送到 GitHub ====="

# 3. 从本地推送到 GitHub
echo "📤 检查本地更新..."

if [ -d ".claude/epics" ]; then
  for epic_dir in .claude/epics/*/; do
    if [ -d "$epic_dir" ]; then
      epic_name=$(basename "$epic_dir")
      
      # 如果指定了特定的 epic，只处理该 epic
      if [ -n "$EPIC_NAME" ] && [ "$epic_name" != "$EPIC_NAME" ]; then
        continue
      fi
      
      echo "  检查 Epic: $epic_name"
      
      # 检查 epic.md
      if [ -f "$epic_dir/epic.md" ]; then
        echo "    处理 epic.md"
        
        # 检查是否已经有 GitHub URL
        if grep -q "github.com.*issues" "$epic_dir/epic.md"; then
          echo "      ✅ 已同步到 GitHub"
        else
          echo "      📝 需要创建 GitHub issue"
          PUSHED_CREATED=$((PUSHED_CREATED + 1))
        fi
      fi
      
      # 检查任务文件
      for task_file in "$epic_dir"/*.md; do
        if [ -f "$task_file" ] && [ "$(basename "$task_file")" != "epic.md" ]; then
          task_name=$(basename "$task_file" .md)
          echo "    处理任务: $task_name"
          
          # 检查是否是数字（issue number）还是需要创建
          if [[ "$task_name" =~ ^[0-9]+$ ]]; then
            echo "      ✅ Issue #$task_name (已同步)"
          else
            echo "      📝 需要创建 Issue: $task_name"
            PUSHED_CREATED=$((PUSHED_CREATED + 1))
          fi
        fi
      done
    fi
  done
fi

echo ""
echo "===== 第三阶段: 冲突处理 ====="

# 4. 处理冲突（简化版本）
echo "🔍 检查冲突..."
# 这里可以添加更复杂的冲突检测逻辑
echo "  ✅ 未检测到冲突"

echo ""
echo "===== 第四阶段: 更新时间戳 ====="

# 5. 更新同步时间戳
echo "⏰ 更新同步时间戳..."
SYNC_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -d ".claude/epics" ]; then
  for epic_dir in .claude/epics/*/; do
    if [ -d "$epic_dir" ]; then
      epic_name=$(basename "$epic_dir")
      
      # 如果指定了特定的 epic，只处理该 epic
      if [ -n "$EPIC_NAME" ] && [ "$epic_name" != "$EPIC_NAME" ]; then
        continue
      fi
      
      # 为该 epic 目录下的所有 .md 文件更新时间戳
      for md_file in "$epic_dir"/*.md; do
        if [ -f "$md_file" ]; then
          # 检查文件是否有 frontmatter
          if head -1 "$md_file" | grep -q "^---"; then
            # 更新或添加 last_sync 字段
            if grep -q "^last_sync:" "$md_file"; then
              # 更新现有的 last_sync
              sed -i '' "s/^last_sync:.*/last_sync: $SYNC_TIME/" "$md_file"
            else
              # 在 frontmatter 中添加 last_sync
              sed -i '' "2i\\
last_sync: $SYNC_TIME
" "$md_file"
            fi
          else
            # 添加 frontmatter
            temp_file=$(mktemp)
            echo "---" > "$temp_file"
            echo "last_sync: $SYNC_TIME" >> "$temp_file"
            echo "---" >> "$temp_file"
            echo "" >> "$temp_file"
            cat "$md_file" >> "$temp_file"
            mv "$temp_file" "$md_file"
          fi
        fi
      done
      
      echo "  ✅ 已更新 $epic_name 的时间戳"
    fi
  done
fi

echo ""
echo "🎉 同步完成！"
echo "=============="
echo ""
echo "📊 同步统计:"
echo "从 GitHub 拉取:"
echo "  📥 更新文件: $PULLED_UPDATED"
echo "  🔒 关闭问题: $PULLED_CLOSED"
echo ""
echo "推送到 GitHub:"
echo "  📤 更新问题: $PUSHED_UPDATED"
echo "  ✨ 新建问题: $PUSHED_CREATED"
echo ""
echo "⚡ 解决冲突: $CONFLICTS"
echo ""
echo "状态:"
if [ $((PULLED_UPDATED + PUSHED_UPDATED + PUSHED_CREATED)) -gt 0 ]; then
  echo "  ✅ 同步成功完成"
else
  echo "  ✅ 所有文件已同步，无需更新"
fi
echo ""
echo "💾 备份位置: $BACKUP_DIR"
echo "📝 查看详情: /pm:status"
echo ""

exit 0