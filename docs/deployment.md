# 部署指南

## 前置准备
1. Supabase 项目已创建并跑过所有迁移（见 `supabase/migrations/`）
2. GitHub 仓库已连接 Vercel
3. 环境变量已配置

## 触发部署
Git push 到主分支会自动触发 Vercel 重新部署：

```bash
git push origin master
```

## 手动在 Vercel 配置
如果首次部署，需在 Vercel 中设置以下环境变量：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`

## Supabase 认证配置
Authentication → URL Configuration:
- Site URL: https://manifest-diary-rouge.vercel.app
- Redirect URLs: https://manifest-diary-rouge.vercel.app/auth/callback

## 上线冒烟测试清单
1. 首页 → 跳转 /login
2. 注册/登录 → 看到首页（早晨脚本视图）
3. /reflect → 写复盘 → AI 梳理 → 三件套出现
4. /manifest → 选分类 → 写意图 → 看到回响
5. /history → 看到日历 → 点某天 → 看到详情
6. /history/search → 搜索关键词 → 看到高亮结果
7. /admin/ai-logs → 看到调用统计

## 灰度文案
Hi，Manifest Diary 初步可用了！它会在每晚陪你复盘，用 AI 帮你提炼今日高光、指出认知盲点，并生成明天的无脑执行脚本。也支持显化日记和语音输入。
数据只你自己能看，免费试用。
链接：https://manifest-diary-rouge.vercel.app