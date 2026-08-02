<div align="center">

# Clarity

### 晨雾米茶 · 个人项目执行系统

A local-first personal execution workbench — turn a handful of projects into finished outcomes, with overdue/due-today surfacing, dependency-aware tasks, a focus countdown, and a guided reflection loop. No cloud account. Your data never leaves the device.

<p>
  <a href="#特性"><img alt="features" src="https://img.shields.io/badge/features-project--first-6b9080?style=flat-square"></a>
  <a href="#"><img alt="privacy" src="https://img.shields.io/badge/data-localStorage%20only-c08a6a?style=flat-square"></a>
  <a href="#"><img alt="stack" src="https://img.shields.io/badge/Next.js-16.2-light?style=flat-square&logo=nextdotjs&logoColor=white"></a>
  <a href="#"><img alt="tests" src="https://img.shields.io/badge/tests-68%20passing-7a9b6e?style=flat-square"></a>
  <a href="#"><img alt="export" src="https://img.shields.io/badge/deploy-static%20export-2b2620?style=flat-square"></a>
</p>

<p><em>每个任务都有归属 · 今天只看该推进的事 · 进度与投入让完成可见</em></p>

</div>

---

## 这是什么

Clarity 不是又一份待办清单，也不是显化日记。它是一个**以项目为中心的个人执行系统**：任务必须归属项目，首页只暴露"今天必须动的事"，倒计时帮你进入深度专注，复盘页用三句填空把节奏收敛回下一步动作。

所有数据存于浏览器 `localStorage`，构建为纯静态站点可直接部署到 GitHub Pages —— 没有 Node 服务端、没有数据库、没有账号。

> 设计语言：**晨雾米茶**。暖米底 + 鼠尾草绿主色 + 陶栗粉伴色 + 暖陶栗红承担"逾期"语义。色相低饱和、暖中性，参照环境注意力恢复（restorative attention）研究选色 —— 长时间盯屏不刺眼，紧急感被柔化但不消失。

---

## 特性

### 🏠 今日行动台（Today Desk）
进入即看到按紧急程度**自上而下**排好的四组：
- **已逾期** — 暖陶栗红高亮，最该先清
- **今天到期** — 硬截止
- **未来 3 天高优** — 提前看见
- **进行中** — 别让它掉地

一键完成、打开详情，或深链到日历当日视图。

### 🗂 项目与任务
- **看板 + 列表双视图**，状态 `待办 / 进行中 / 已完成`，优先级 `低 / 中 / 高`
- **详情抽屉**：右侧滑入面板编辑，移动端全屏 sheet
- **子任务**拆解 execute（上限 20），**手动记录投入分钟**
- **依赖关系**：任务可声明依赖前驱，`all/any` 模式；前驱未完成 → 任务自动判定**阻塞**并显示阻塞原因
- **依赖绕过**：刻意越过阻塞需填写原因留痕，进入复盘审计

### ⏱ 焦点倒计时
任务级与项目级双倒计时。开始 → 暂停 → 完成三态，专注时长**自动落账**为 TimeEntry。完成时触发柔和提示音（WebAudio 合成，无音频文件）+ 系统通知（如已授权）。计时跨刷新不丢失。

### 📅 日历
月视图 / 周视图（**周一开始**），按截止日期聚合，支持深链 `?day=YYYY-MM-DD&view=week` 直达某日面板。

### 📊 执行复盘
选定范围（今日 / 本周 / 本月 / 自定义）后：
- **执行摘要**：任务专注、项目整体专注、总专注、已完成/逾期/阻塞计数（数字 mount 时 count-up 滚动）
- **复盘详情**：预计与实际的估时偏差、平均完成周期、逾期/阻塞任务清单、依赖绕过审计
- **复盘引导**：三句填空 —— 做完了什么 / 卡在哪里 / 下一段怎么改，按起止日期分别存放本机

### 🔒 本地优先
- 首次进入设置本地密码，之后经 `/unlock` 解锁进入工作台
- **JSON 导出 / 导入备份**（按 UUID 合并，幂等不重复）
- 跨标签页实时同步（`storage` 事件 + `useSyncExternalStore`）
- 数据**零上传**；可选 AI 助手需自配 API key（见 `.env.example`）

### 🎬 统一动画语言
所有动效经一期治愈系润色统一过：抽屉背板淡入 + 面板右滑入场、进度条 0.6s 平滑填充、页面子块渐次 fadeInUp、统计数字 count-up、骨架屏 shimmer、轻触 press 反馈 —— 全部在 `prefers-reduced-motion: reduce` 下自动收敛为静态，仅配色生效。

---

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | **Next.js 16.2** App Router · **React 19** |
| 语言 | **TypeScript** strict |
| 样式 | **Tailwind CSS v4**（`@theme`）+ 单文件 `globals.css` 设计 token 体系 |
| 状态 | `useSyncExternalStore` + `localStorage`，无外部状态库 |
| 测试 | **Vitest** · 68 个单元/集成测试 |
| 桌面 | **Electron 38** + electron-builder（Windows NSIS，可选） |
| 部署 | 纯**静态导出** → GitHub Pages（`/manifest-diary` 子路径，`trailingSlash`） |

> 同构设计：客户端 `localStorage` 仓储与一条服务端 `node:sqlite` 分支共享同一份派生类型（`ProjectSummary` / `TaskWithMeta` / `ReviewStats` 等），定义在 `src/types/project.ts`，无环依赖。

---

## 运行

```bash
# 1. 安装
npm install

# 2a. 开发（默认带 GitHub Pages 子路径前缀）
npm run dev
# → http://localhost:3000/manifest-diary/

# 2b. 开发（去掉子路径前缀，本地更顺眼）
BASE_PATH="" npm run dev
# → http://localhost:3000/
```

### 桌面应用（可选）

```bash
npm run desktop:dev      # 开发模式跑 Electron
npm run desktop:build    # 打 Windows NSIS 安装包到 release/
```

### 测试与类型检查

```bash
npm test                 # vitest run — 68 个测试
npx tsc --noEmit         # 严格类型检查
npm run build            # 静态导出到 out/，可验证编译
```

---

## 项目结构

```
src/
├─ app/
│  ├─ (app)/                 # 工作台路由组（受解锁门禁）
│  │  ├─ page.tsx            # 今日行动台
│  │  ├─ projects/           # 项目列表 + 详情抽屉
│  │  ├─ calendar/           # 月/周日历
│  │  ├─ review/             # 执行复盘
│  │  └─ settings/           # 密码 + 备份
│  ├─ setup/ · unlock/       # 首设与解锁
│  └─ globals.css            # 设计系统单一真源（晨雾米茶 token）
├─ components/
│  ├─ dashboard/             # 今日台 · 复盘摘要/详情 · 范围选择器
│  └─ project/               # 看板 · 抽屉 · 日历 · 倒计时 · 设置
├─ lib/
│  ├─ store/                 # 仓储 + useSyncExternalStore 状态核心
│  ├─ project/               # 日期 · 校验 · 专注完成通知
│  ├─ browser/               # SSR 安全的 storage 访问
│  └─ ui/                    # useCountUp 等轻量动画 hook
└─ types/project.ts          # 同构派生类型（client/server 共享）
```

---

## 设计系统

色板以 `--life-*` CSS 自定义属性为单一真源（`src/app/globals.css` `:root`），换肤即改 token 值，35+ transition 自动跟随新缓动 `--life-ease: cubic-bezier(0.22, 1, 0.36, 1)`：

| Token | 值 | 语义 |
|---|---|---|
| `--life-base` | `#f5efe4` | 晨雾米茶暖底 |
| `--life-raised` / `--life-panel` | `#fbf8f2` | 暖米白卡片 / 面板（修了原先未定义 bug） |
| `--life-ink` | `#2b2620` | 暖近黑文字 |
| `--life-accent` | `#6b9080` | 鼠尾草绿主色 |
| `--life-secondary-accent` | `#d4a88c` | 陶栗粉伴色 |
| `--life-overdue` | `#c08a6a` | 暖陶栗红，独占逾期/紧急语义 |
| `--life-danger` | `#b5605a` | 暖灰红，删除等危险操作 |

---

## 路线与边界

**已交付**：今日台 · 项目/任务/子任务 · 依赖与阻塞 · 倒计时 · 日历 · 复盘 · 本地密码 · JSON 备份 · 晨雾米茶换肤与统一动画 · 桌面打包。

**明确不在 v1**：团队协作 · 云端同步 · 拖拽看板 · 重复任务 · 富文本 · 暗色主题（一期只做浅色主力）。

---

## 许可与出处

个人作品，用于展示前端 / 全栈工程能力。代码可在保留出处前提下参考。设计文档见 [`DESIGN.md`](DESIGN.md) 与 [`PRODUCT.md`](PRODUCT.md)（注：二者记录的是换肤前的 "Cool Fog Desk" 阶段，现行视觉以本 README 的晨雾米茶为准）。

<div align="center">

<sub>Built as a single-author execution tool. Project-first, today-only, local-private.</sub>

</div>
