# Multimodal Message Content — 实现记录

执行计划：[2026-06-11-multimodal-message-content.md](superpowers/plans/2026-06-11-multimodal-message-content.md)
分支：`feat/multimodal-content`

本文记录执行过程中**偏离 plan 的实现决策**与**顺带修复的预存 bug**，供后续 review 与维护参考。

## 偏离 plan 的实现决策

| #   | 位置                            | plan 方案                                  | 实际实现                                                                                                                             | 原因                                                                                                                                 |
| --- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `schema.ts` content 列          | 裸 `jsonb('content')`                      | `.jsonb().$type<MessagePart[]>()`                                                                                                    | 裸 jsonb 返回 `unknown`，repository 返回类型与 `ChatMessage.content` 不匹配，typecheck 必失败                                        |
| 2   | `_ws.ts` chat case              | `if (!data.content) return`                | 追加 `data.content.length === 0`                                                                                                     | content 从 string（空串 falsy）变 array（空数组 truthy），原检查会让空消息误存                                                       |
| 3   | `useChatCache.ts` 缓存迁移      | 导出 `clearAllCaches` + app load 手动调用  | upgrade 回调内 `deleteObjectStore` + recreate                                                                                        | 迁移清理应在迁移发生处，避免「忘记调用」导致 v1 string 缓存渲染错乱                                                                  |
| 4   | 上传与静态服务                  | `publicAssets` 配置服务 uploads/           | 写入 `resolve('uploads')` + server route `server/routes/uploads/[...path].get.ts` 流式服务（路径穿越防护 + content-type + cache 头） | publicAssets 在 build 时 bundle，**dev 与生产都不服务运行时上传的新文件**（实测 404）；server route 按请求读文件系统，dev/生产均可用 |
| 5   | `MessageBubble.vue` 图片全屏    | 模板内联 `(e) => (e.currentTarget as ...)` | 独立 `openFullscreen(e)` 方法                                                                                                        | 可读性，避免 template 内 cast                                                                                                        |
| 6   | `MessageInput.vue` 删除按钮     | 文本 `x`                                   | `<UIcon name="i-lucide-x">`                                                                                                          | 与项目 Nuxt UI 图标风格一致                                                                                                          |
| 7   | `[roomId].vue` aiMessagesAsChat | `map` + `filter` 两步                      | `flatMap` 一步                                                                                                                       | 单次遍历 + 类型安全 narrowing，更简洁                                                                                                |
| 8   | `_ws.ts` AI context 构建        | 内联在 handleAiChat，不可测                | 提取 `buildAiContextMessages` 到 `server/utils/ai-context.ts` 并单测                                                                 | multimodal 转换是 plan 核心逻辑，应可单测                                                                                            |

## 顺带修复的预存 bug

以下问题在 plan Task 11（验证）阶段才暴露 —— `storage.test.ts` 此前因 `useRuntimeConfig` 在 import 阶段崩溃，**从未真正执行过**，掩盖了这些问题。

### 1. drizzle 生成的迁移缺 `USING` 子句

`bun run db:generate` 对 `text → jsonb` 只生成：

```sql
ALTER TABLE "chat"."messages" ALTER COLUMN "content" SET DATA TYPE jsonb;
```

直接 cast 在有数据时失败。手动补数据转换：

```sql
ALTER TABLE "chat"."messages" ALTER COLUMN "content" SET DATA TYPE jsonb USING (
  jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
);
```

25 行现有文本正确转为 `[{"type":"text","text":...}]`。

### 2. `__drizzle_migrations` 历史断裂

项目的表通过 `db:push` 创建，`__drizzle_migrations` 表存在但**空**（0 行）。导致任何 `db:migrate` 都从 0000 重跑，撞上已存在的表而失败。

修复：用真实 `sha256(文件全部内容)` + journal.when 记录 0000/0001/0002。drizzle migrator 按 `created_at`（= journal `when`）比较，跳过 `folderMillis <= lastApplied` 的迁移，migrate 恢复一致。

> drizzle hash 算法：`crypto.createHash('sha256').update(fileContent).digest('hex')`，见 `node_modules/drizzle-orm/migrator.cjs`。

### 3. `storage.test.ts` 测试分类错误

该测试是集成测试（import `client.ts` 的 `useRuntimeConfig`，连真实 DB），却放在 `unit` project（node 环境，无 Nitro），import 阶段即 `ReferenceError: useRuntimeConfig is not defined`。

修复：`git mv test/unit/storage.test.ts test/nuxt/storage.test.ts`，跑在有 Nitro 环境的 nuxt project。

### 4. `storage.test.ts` DELETE 无 schema 前缀

`beforeEach` 用 `DELETE FROM messages`，但表在 `chat` schema（`chat.messages`），报 `relation "messages" does not exist`。

修复：改为 `DELETE FROM chat.messages` / `chat.rooms`。

---

_验证结果：typecheck ✓ / lint ✓ / test 28/28 ✓（含 ai-context 多模态转换 5 + storage-upload 3）_
