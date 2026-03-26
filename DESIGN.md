# Design System — BuildNames

## Product Context
- **What this is:** AI 产品名生成与验证工具 — 输入产品想法，AI 生成 10 个名字，每个名字验证 GitHub 和 5 个 TLD 域名可用性
- **Who it's for:** 独立开发者，给自己用
- **Space/industry:** 开发者工具 / 生产力工具
- **Project type:** Web app（单页应用）

## Aesthetic Direction
- **Direction:** Brutally Minimal — 功能至上，只有必要元素，无装饰
- **Decoration level:** Minimal — 零装饰，视觉重量全部来自排版和空白
- **Mood:** 像一个精心设计的命令行工具，但有图形界面。精准、快速、值得信赖。
- **Reference sites:** Namelix（AI 命名工具）, Vercel 主页（极简技术产品美学）

## Typography
- **Display/Hero:** Geist, 48px, font-weight 700, letter-spacing -0.02em
- **Body:** Geist, 16px, font-weight 400, line-height 1.6
- **UI/Labels:** Geist, 14px, font-weight 500
- **Data/Scores:** Geist Mono, 14px, font-weight 500, tabular-nums
- **Code/Domains:** Geist Mono, 13px, font-weight 400
- **Font CDN:** Google Fonts — Geist (400, 500, 700) + Geist Mono (400, 500)
- **Scale:**
  - Hero: 48px / 1.1
  - H1: 32px / 1.2
  - H2: 24px / 1.3
  - Body: 16px / 1.6
  - Small: 14px / 1.5
  - Caption: 12px / 1.4

## Color
- **Approach:** Restrained — 单一强调色 + 中性色，语义色仅用于验证状态
- **Primary:** #2563EB（蓝色，用于主按钮、链接、聚焦状态）
- **Primary Hover:** #1D4ED8
- **Background:** #FFFFFF
- **Surface:** #F9FAFB（输入框背景、分组背景）
- **Border:** #E5E7EB（边框、分割线）
- **Text Primary:** #111827
- **Text Secondary:** #6B7280
- **Text Muted:** #9CA3AF
- **Semantic — Success (GitHub/Domain 可用):** #10B981
- **Semantic — Error (GitHub/Domain 已被占用):** #EF4444
- **Semantic — Pending (验证中):** #F59E0B
- **Semantic — Unknown (无法确认):** #6B7280
- **Dark mode:** 暂不支持 MVP

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — 不拥挤，但也不浪费
- **Scale:** 2xs(4) xs(8) sm(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined, single column, centered
- **Max content width:** 640px
- **Page padding:** 24px (mobile) / 48px (desktop)
- **Component spacing:** 16px between form elements, 24px between sections
- **Border radius:**
  - Inputs: 6px
  - Buttons: 6px
  - Cards: 8px
  - Tags/Badges: 4px
- **Border:** 1px solid #E5E7EB (no shadows, no blur)

## Motion
- **Approach:** Intentional — 动效传达状态，不是装饰
- **Easing:** enter: ease-out (150ms), exit: ease-in (100ms), move: ease-in-out
- **Results appear:** opacity 0→1, translateY 8px→0, 200ms ease-out, staggered 50ms
- **Verification spinner:** rotate 360deg, 800ms linear, infinite while checking
- **Score counter:** number tick-up animation on sort
- **Button states:** 100ms transition on hover/active
- **No decorative animations**

## UI Components

### Input Form
- 3 个输入框垂直排列（产品想法、目标用户、产品定位）
- 标签在输入框上方，左对齐
- placeholder 文字灰色示例
- 聚焦时边框变为 Primary 蓝色

### Generate Button
- 全宽，蓝底白字
- Hover: 颜色加深
- Loading: 按钮内显示 spinner + "生成中..."
- Disabled: 灰色，不可点击，输入为空时

### Results List
- 每条结果为一行：名字 | 验证状态图标 | 分数
- 验证状态：GitHub 小图标 + 域名小图标
- 排序后，最优（最高分）在顶部
- 无结果时：居中文字 "输入产品想法开始生成"

### Verification Status Icons
- ✅ 绿色圆圈 + 勾 → 可用
- ❌ 红色圆圈 + 叉 → 已被占用
- 🔄 橙色旋转图标 → 验证中
- ⚪ 灰色圆圈 → 无法确认（超时/错误）

### Empty State
- 居中
- 标题："准备开始"
- 副文字："输入你的产品想法，AI 将生成 10 个符合条件的名字"
- 无任何结果列表

### Error State
- 网络错误：顶部红色横幅，文字说明，可重试
- API 错误：弹窗或内联错误文字

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system created | Created by /design-consultation based on competitive research (Namelix, Nameboy, Shopify) + first-principles reasoning: developer tools need verification status as first-class citizens |
| 2026-03-26 | Brutally Minimal aesthetic | Developer audience expects precision over decoration;验证状态 (GitHub/Domain 可用性) is the core value, not branding |
| 2026-03-26 | Geist + Geist Mono typography | Modern, technical, excellent tabular-nums for scores; avoids overused defaults (Inter, Roboto) |
| 2026-03-26 | Restrained color with semantic status colors | Primary blue for action, green/red/orange/gray for verification states only |
| 2026-03-26 | 640px max-width single column | Focused, no distraction; matches product simplicity principle |
| 2026-03-26 | Intentional motion | State changes are the only animation; no decorative motion |
