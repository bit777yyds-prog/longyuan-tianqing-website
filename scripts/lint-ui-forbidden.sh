#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${ROOT}/src/web"
FAIL=0

echo "== UI 禁止项扫描 =="

# 1. 禁止蓝紫渐变、霓虹渐变等 AI 科技风
if grep -RinE 'linear-gradient|radial-gradient|conic-gradient' \
  --include='*.css' --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现渐变背景"
  FAIL=1
else
  echo "PASS  未发现渐变背景"
fi

# 2. 禁止粒子 / 动画背景关键词
if grep -RinE 'particle|particles|sparkle|star-field|galaxy|nebula|aurora' \
  --include='*.css' --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现粒子/星云/极光等背景"
  FAIL=1
else
  echo "PASS  未发现粒子背景"
fi

# 3. 禁止机器人头像 / 拟人化 Agent 图标
if grep -RinE 'robot|bot-avatar|ai-avatar|agent-avatar|<Avatar[^>]*src.*robot|<img[^>]*robot' \
  --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现机器人头像"
  FAIL=1
else
  echo "PASS  未发现机器人头像"
fi

# 4. 禁止 3D 青瓷旋转 / three.js / canvas 3D
if grep -RinE 'three|@react-three|ThreeJS|WebGL|canvas.*3d|rotate-3d|preserve-3d' \
  --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现 3D/WebGL 元素"
  FAIL=1
else
  echo "PASS  未发现 3D/WebGL 元素"
fi

# 5. 禁止黑底荧光绿 / 霓虹色文本
if grep -RinE '#0f0|#00ff00|#39ff14|bg-black.*text-green-400|text-green-400.*bg-black' \
  --include='*.css' --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现黑底荧光绿或霓虹色"
  FAIL=1
else
  echo "PASS  未发现黑底荧光绿"
fi

# 6. 禁止 glassmorphism / 大面积模糊阴影
if grep -RinE 'backdrop-blur|backdrop-filter|glassmorphism' \
  --include='*.css' --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现玻璃拟态效果"
  FAIL=1
else
  echo "PASS  未发现玻璃拟态"
fi

# 7. 禁止蓝紫霓虹色值
if grep -RinE '#8b5cf6|#6366f1|#a855f7|#c026d3|#4f46e5|#7c3aed' \
  --include='*.css' --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现蓝紫 AI 色值"
  FAIL=1
else
  echo "PASS  未发现蓝紫 AI 色值"
fi

# 8. 禁止轮播 / 自动播放视频
if grep -RinE 'carousel|slider.*auto|autoplay|video.*autoPlay|<video' \
  --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现轮播或自动播放视频"
  FAIL=1
else
  echo "PASS  未发现轮播或自动播放视频"
fi

# 9. 禁止虚构数据提示（排行榜/积分/智能推荐）
if grep -RinE '排行榜|积分榜|贡献积分|智能推荐|AI 助手|AI 聊天|聊天窗口' \
  --include='*.tsx' --include='*.ts' "${TARGET}"; then
  echo "FAIL  发现排行榜/积分/聊天窗口等禁止文案"
  FAIL=1
else
  echo "PASS  未发现禁止文案"
fi

if [ "$FAIL" -eq 0 ]; then
  echo "------------------------------------------------------------"
  echo "UI FORBIDDEN SCAN: 全部通过"
  exit 0
else
  echo "------------------------------------------------------------"
  echo "UI FORBIDDEN SCAN: 存在禁止项"
  exit 1
fi
