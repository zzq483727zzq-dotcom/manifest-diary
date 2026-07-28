# Clarity · 个人项目执行系统

本地优先的个人项目与任务管理系统：项目 → 任务 → 子任务，支持截止日期、耗时记录、今日行动台与月/周日历。

## 运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

首次进入会要求设置本地密码；之后通过 `/unlock` 解锁。数据保存在本机 SQLite，不上传云端。

## 主要能力

- **今日行动台**：逾期 / 今日到期 / 未来 3 天高优 / 进行中
- **项目与任务**：看板 + 列表，详情抽屉编辑
- **子任务与耗时**：拆解执行，手动记录投入分钟
- **日历**：月视图 / 周视图（周一开始），按截止日期查看
- **设置**：修改本地密码，JSON 导出 / 导入备份

## 技术栈

Next.js App Router · React · TypeScript · Tailwind · 本地 SQLite（`node:sqlite`）· Vitest

## 测试

```bash
npm test
npx tsc --noEmit
```
