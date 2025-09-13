#!/bin/bash

# Epic Sync - 将单个epic同步到GitHub
# Usage: ./epic-sync.sh <epic_name>

set -e

echo "🚀 Claude Code PM - Epic同步到GitHub"
echo "=================================="
echo ""

# 检查参数
if [ $# -eq 0 ]; then
  echo "❌ 错误: 需要提供epic名称"
  echo "   用法: $0 <epic_name>"
  echo "   示例: $0 modbus-reader-bug-fixes"
  exit 1
fi

EPIC_NAME="$1"
EPIC_DIR=".claude/epics/$EPIC_NAME"

echo "🎯 同步Epic: $EPIC_NAME"
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

# 验证epic存在
if [ ! -d "$EPIC_DIR" ]; then
  echo "❌ 错误: Epic目录不存在: $EPIC_DIR"
  echo "   请先运行: /pm:epic-decompose $EPIC_NAME"
  exit 1
fi

if [ ! -f "$EPIC_DIR/epic.md" ]; then
  echo "❌ 错误: Epic文件不存在: $EPIC_DIR/epic.md"
  exit 1
fi

echo "✅ Epic验证通过"
echo ""

# 初始化计数器
CREATED_ISSUES=0
UPDATED_ISSUES=0
FAILED_ISSUES=0

# 创建备份
BACKUP_DIR=".claude/sync-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$EPIC_DIR" "$BACKUP_DIR/" 2>/dev/null || true

echo "📦 已创建备份: $BACKUP_DIR"
echo ""

# 函数：提取frontmatter字段
get_frontmatter_field() {
  local file="$1"
  local field="$2"
  
  # 提取frontmatter中的字段值
  awk -v field="$field" '
    /^---$/ { in_fm = !in_fm; next }
    in_fm && $0 ~ "^" field ":" {
      gsub("^" field ":[[:space:]]*", "")
      gsub(/[[:space:]]*$/, "")
      print
      exit
    }
  ' "$file"
}

# 函数：更新frontmatter字段
update_frontmatter_field() {
  local file="$1"
  local field="$2"
  local value="$3"
  
  # 使用临时文件更新frontmatter
  local temp_file=$(mktemp)
  awk -v field="$field" -v value="$value" '
    /^---$/ { 
      if (!in_fm) {
        in_fm = 1
        print
        next
      } else {
        in_fm = 0
        if (!found_field) {
          print field ": " value
        }
        print
        next
      }
    }
    in_fm && $0 ~ "^" field ":" {
      print field ": " value
      found_field = 1
      next
    }
    { print }
  ' "$file" > "$temp_file" && mv "$temp_file" "$file"
}

# 函数：创建GitHub issue
create_github_issue() {
  local title="$1"
  local body_file="$2"
  local labels="$3"
  
  echo "  📤 创建GitHub Issue: $title"
  
  local issue_url
  if issue_url=$(gh issue create --title "$title" --body-file "$body_file" --label "$labels" 2>/dev/null); then
    echo "  ✅ 创建成功: $issue_url"
    echo "$issue_url"
    return 0
  else
    echo "  ❌ 创建失败: $title"
    return 1
  fi
}

echo "🔍 扫描Epic和任务文件..."
echo ""

# 处理Epic主文件
EPIC_FILE="$EPIC_DIR/epic.md"
EPIC_TITLE=$(get_frontmatter_field "$EPIC_FILE" "name")
EPIC_GITHUB=$(get_frontmatter_field "$EPIC_FILE" "github")

echo "📋 处理Epic: $EPIC_TITLE"

if [ -z "$EPIC_GITHUB" ] || [ "$EPIC_GITHUB" = "[Will be updated when synced to GitHub]" ]; then
  echo "  🆕 创建新的Epic Issue"
  
  # 创建Epic的GitHub Issue
  EPIC_ISSUE_URL=$(create_github_issue "Epic: $EPIC_TITLE" "$EPIC_FILE" "epic")
  if [ $? -eq 0 ]; then
    # 更新epic.md的github字段
    update_frontmatter_field "$EPIC_FILE" "github" "$EPIC_ISSUE_URL"
    ((CREATED_ISSUES++))
    echo "  📝 已更新epic.md的GitHub链接"
  else
    ((FAILED_ISSUES++))
  fi
else
  echo "  ℹ️ Epic已有GitHub Issue: $EPIC_GITHUB"
fi

echo ""

# 处理任务文件
TASK_FILES=$(find "$EPIC_DIR" -name "[0-9][0-9][0-9].md" | sort)
TASK_COUNT=$(echo "$TASK_FILES" | wc -l | tr -d ' ')

if [ -n "$TASK_FILES" ] && [ "$TASK_COUNT" -gt 0 ]; then
  echo "📝 处理 $TASK_COUNT 个任务文件:"
  echo ""
  
  for task_file in $TASK_FILES; do
    if [ -f "$task_file" ]; then
      TASK_NAME=$(basename "$task_file" .md)
      TASK_TITLE=$(get_frontmatter_field "$task_file" "name")
      TASK_GITHUB=$(get_frontmatter_field "$task_file" "github")
      
      echo "  📋 任务: $TASK_NAME - $TASK_TITLE"
      
      if [ -z "$TASK_GITHUB" ] || [ "$TASK_GITHUB" = "[Will be updated when synced to GitHub]" ]; then
        echo "    🆕 创建新的任务Issue"
        
        # 创建任务的GitHub Issue
        TASK_ISSUE_URL=$(create_github_issue "Task: $TASK_TITLE" "$task_file" "task")
        if [ $? -eq 0 ]; then
          # 更新任务文件的github字段
          update_frontmatter_field "$task_file" "github" "$TASK_ISSUE_URL"
          ((CREATED_ISSUES++))
          echo "    📝 已更新任务文件的GitHub链接"
        else
          ((FAILED_ISSUES++))
        fi
      else
        echo "    ℹ️ 任务已有GitHub Issue: $TASK_GITHUB"
      fi
      
      echo ""
    fi
  done
else
  echo "⚠️ 未找到任务文件"
  echo "   提示: 运行 /pm:epic-decompose $EPIC_NAME 来创建任务"
  echo ""
fi

# 更新时间戳
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
update_frontmatter_field "$EPIC_FILE" "updated" "$CURRENT_TIME"

# 显示结果统计
echo "🎉 同步完成!"
echo "============"
echo ""
echo "📊 同步统计:"
echo "  ✅ 创建的Issues: $CREATED_ISSUES"
echo "  🔄 更新的Issues: $UPDATED_ISSUES"
echo "  ❌ 失败的Issues: $FAILED_ISSUES"
echo ""

if [ $FAILED_ISSUES -gt 0 ]; then
  echo "⚠️ 部分同步失败，请检查GitHub认证和网络连接"
  echo ""
fi

echo "🔗 下一步建议:"
if [ $CREATED_ISSUES -gt 0 ]; then
  echo "  1. 在GitHub上查看创建的Issues"
  echo "  2. 运行 /pm:epic-start $EPIC_NAME 开始执行任务"
else
  echo "  1. 运行 /pm:epic-start $EPIC_NAME 开始执行任务"
  echo "  2. 使用 /pm:task-show <task_id> 查看具体任务"
fi
echo ""

echo "✨ Epic同步完成: $EPIC_NAME"