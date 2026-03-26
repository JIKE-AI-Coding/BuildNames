# BuildNames

AI 产品名生成与验证工具。输入产品想法，AI 生成 10 个好名字，自动验证 GitHub 和域名可用性。

> 💡 这个项目是完全通过 Vibe Coding（AI辅助编程）方式开发出来的，从设计到实现全程由 Claude AI 协助完成。

## 功能

- **AI 名称生成**：基于产品想法、目标用户和产品定位，使用 GPT-4o-mini 生成 10 个合适的名字
- **GitHub 验证**：检查 GitHub 仓库名称是否可用
- **域名验证**：检查 .com 域名是否可用

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，并填入必要的 API Key：

```bash
cp .env.example .env.local
```

必需的环境变量：

- `OPENAI_API_KEY`：OpenAI API Key（用于生成名称）

可选的环境变量：

- `GITHUB_TOKEN`：GitHub Personal Access Token（提高 API 请求限制，无此变量则限制为 30 次/分钟）

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 部署

部署到 Vercel：

```bash
npm run build
```

在 Vercel 项目设置中配置环境变量 `OPENAI_API_KEY`（必需）和 `GITHUB_TOKEN`（可选）。

## 技术栈

- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS v4
- **AI**：OpenAI GPT-4o-mini
- **域名验证**：Cloudflare DNS-over-HTTPS API
- **GitHub API**：GitHub Search API

## 项目结构

```
src/app/
├── page.tsx              # 主页面
├── layout.tsx            # 根布局
├── globals.css           # 全局样式
└── api/
    ├── generate/route.ts # AI 名称生成 API
    └── verify/route.ts   # GitHub + 域名验证 API
```
