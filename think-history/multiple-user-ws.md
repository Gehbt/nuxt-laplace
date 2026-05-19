# 聊天室应用开发：完整问题排查与解决记录

## 1. crossws 版本冲突

### 问题

显式安装的 crossws 包的 `defineHooks` 与 h3 内置的 crossws 存在 `#private` 字段不匹配，导致 WebSocket handler 无法正常初始化。

### 排查

- Nuxt/Nitro 通过 h3 内部已经 bundle 了一份 crossws
- 手动 `npm install crossws` 安装的版本与 h3 bundle 的版本不同
- 两个版本使用了不同的 Symbol（`#private` 字段），导致类型不兼容

### 解决

- 移除显式安装的 crossws 依赖
- 不再使用 `defineHooks()` 包装 hooks，直接将 hooks 对象传给 Nitro 的 `defineWebSocketHandler`

```ts
// 错误：引入了冲突的 crossws 版本
import { defineHooks } from 'crossws'
export default defineHooks({ open() {}, message() {} })

// 正确：直接使用 Nitro 的 defineWebSocketHandler
export default defineWebSocketHandler({ open() {}, message() {} })
```

---

## 2. WebSocket 路由 404

### 问题

将 WebSocket handler 文件放在 `server/api/_ws.ts`，Nitro 返回 404。

### 排查

- Nitro 的路由系统对 `server/api/` 和 `server/routes/` 有不同的处理
- `server/api/` 下的文件会生成 API endpoint（`/api/*`），Nitro 不会为它们创建 WebSocket 升级路由
- WebSocket handler 必须放在 `server/routes/` 目录下

### 解决

1. 将文件从 `server/api/_ws.ts` 移到 `server/routes/_ws.ts`
2. 在 `nuxt.config.ts` 中启用 WebSocket 实验特性：

```ts
nitro: {
  experimental: {
    websocket: true
  }
}
```

---

## 3. Pinia Store 未自动导入

### 问题

使用 `useChatStore()` 时报错，store 无法被识别。

### 排查

- Pinia 需要通过 Nuxt 模块注册才能提供自动导入
- `@pinia/nuxt` 没有添加到 `nuxt.config.ts` 的 `modules` 数组中

### 解决

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/test-utils', '@pinia/nuxt'],
})
```

---

## 4. Storage 测试时间戳精度问题

### 问题

单元测试中连续添加的消息 `timestamp` 相同（同一毫秒），导致 `before` 过滤器查询失败。

### 排查

- `Date.now()` 在快速循环中可能返回相同值
- `getMessages(roomId, before, limit)` 使用 `timestamp < before` 过滤
- 同一毫秒的 `before` 值会匹配不到刚插入的消息

### 解决

在测试中，消息插入之间加入 5ms 延迟：

```ts
await addMessage(room, 'msg1', 'user1')
await new Promise((r) => setTimeout(r, 5))
await addMessage(room, 'msg2', 'user2')
```

---

## 5. ESLint 格式错误（多次）

### 问题 A：blank layout `<slot>` 作为根元素

Vue 单文件组件要求有单一根元素（Vue 2 风格限制），`<slot>` 不能直接作为根。

**解决：** 用 `<div>` 包裹 `<slot>`：

```vue
<template>
  <div class="h-full"><slot /></div>
</template>
```

### 问题 B：未使用的 `props` 变量

组件解构了 `props` 但未使用，lint 报错。

**解决：** 改为 `_props` 前缀标记为忽略。

### 问题 C：属性顺序

`:disabled` 和 `@click` 的顺序不符合 ESLint 规则。

**解决：** 运行 `--fix` 自动修正属性顺序。

### 问题 D：nuxt.config.ts 键顺序

`compatibilityDate` 等字段位置不符合规范。

**解决：** 按规定顺序重排配置字段。

---

## 6. 聊天区域高度溢出

### 问题

聊天页面使用 `h-screen` 时没有考虑页面 header 和 footer 的高度，导致内容溢出。

### 尝试

- 使用 `h-[calc(100dvh-8rem)]`，但下方空出 4rem，高度没有变化
- 原因：父容器不是 flex 布局，calc 的减法没有实际作用在正确的地方

### 排查

- UApp 组件内部使用 flex 布局
- UMain 组件有 `flex-1`，会占据剩余空间
- blank layout 的根 div 需要设为 `h-full` 而非固定高度
- 聊天容器也需要 `h-full`，让 flex 布局链正确传递高度

### 解决

```vue
<!-- blank.vue -->
<template>
  <div class="h-full"><slot /></div>
</template>

<!-- [roomId].vue -->
<div class="h-full flex bg-white dark:bg-gray-900">
```

**关键理解：** 在 flex 布局中，`h-full` 让子元素撑满父元素的可用空间，而 `h-screen` 或 `calc()` 是硬编码绝对高度，无法自适应 flex 布局中 header/footer 的动态高度。

---

## 7. 页面加载后房间列表为空

### 问题

首次访问 `/chat/general` 时，左侧房间列表不显示任何房间，需要手动操作后才出现。

### 排查

页面加载时的时序：

1. `watch(roomId, ..., { immediate: true })` 立即触发 → 调用 `joinRoom('general')`
2. `joinRoom` 内部调用 `send({ type: 'join', roomId: 'general' })`
3. 但此时 `onMounted` 还没执行，WebSocket 未创建，`ws` 为 `null`
4. `send()` 检查 `ws?.readyState === WebSocket.OPEN` 为 `false`，静默丢弃消息
5. `onMounted` 触发 → `connect()` → WebSocket 连接 → `onopen` 触发
6. `onopen` 中没有自动 join 逻辑，导致房间列表永远不加载

### 解决

在 `ws.onopen` 回调中添加自动 join：

```ts
ws.onopen = () => {
  store.connected = true
  if (store.currentRoomId) {
    send({ type: 'join', roomId: store.currentRoomId })
  }
}
```

这样即使 `watch` 触发时 WS 未连接，连接建立后也会自动加入当前房间。

---

## 8. IME 输入法 Enter 键误发送

### 问题

使用中文输入法等 IME 时，按 Enter 确认候选词会同时发送消息，导致消息被提前发送。

### 排查

- 浏览器在 IME 组合输入（composition）期间会触发 `keydown` 事件
- 需要检查 `e.isComposing` 属性判断是否在组合输入中

### 解决

```ts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    sendMessage()
  }
}
```

---

## 9. 用户身份不持久化

### 问题

用户每次打开页面或刷新后，会被分配新的 peer ID，被视为新用户。之前房间里的在线列表中会残留旧用户。

### 排查

- 服务器端 `peer.id` 是 crossws 为每个 WebSocket 连接分配的随机 UUID
- 每次连接（包括刷新页面）都会得到新的 `peer.id`
- 没有机制将新连接关联到之前的用户

### 解决

1. 客户端在 localStorage 中生成并保存 clientId：

```ts
const CLIENT_ID_KEY = 'chat-client-id'

function getOrCreateClientId(): string {
  if (!import.meta.client) return ''
  let id = localStorage.getItem(CLIENT_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
  }
  return id
}
```

2. 连接 WebSocket 时通过 query param 传递：

```ts
const url = `${protocol}//${window.location.host}/_ws?clientId=${clientId}`
```

3. 服务端用 `peerClientIds` Map 将 `peer.id` 映射到 `clientId`：

```ts
const peerClientIds = new Map<string, string>()

open(peer) {
  const clientId = url.searchParams.get('clientId') || peer.id
  peerClientIds.set(peer.id, clientId)
}
```

4. 所有面向用户的数据使用 `clientId`（通过 `getUserId(peer)` 获取）而非 `peer.id`

---

## 10. 在线用户列表显示重复

### 问题

同一用户打开多个标签页后，在线列表中显示多个相同用户（如 `User 5d793754 x5`）。

### 排查

最初的实现用 `onlineUsers = Map<roomId, Set<peerId>>` 追踪在线用户：

```ts
// 旧实现
const onlineUsers = new Map<string, Set<string>>()

// join 时
onlineUsers.get(roomId)!.add(peer.id)

// 查询时
function mapUsers(users: string[]): string[] {
  return [...new Set(users.map((id) => peerClientIds.get(id) || id))]
}
```

问题在于：

1. 多个 peer.id 可以映射到同一个 clientId（多个标签页）
2. `Set<peerId>` 存储的是 peer 级别的连接，不是用户级别
3. `mapUsers` 用 `new Set()` 在最后做去重，但这是事后补救，不是根源解决
4. 当用户离开房间时，只删除一个 peer.id，但 `mapUsers` 后的去重可能导致另一个同 clientId 的 peer 被误删

### 解决

改用引用计数的 `roomClientCounts` 追踪：

```ts
// roomId → Map<clientId, peerCount>
const roomClientCounts = new Map<string, Map<string, number>>()
```

```ts
function addClientToRoom(roomId: string, clientId: string) {
  if (!roomClientCounts.has(roomId)) {
    roomClientCounts.set(roomId, new Map())
  }
  const counts = roomClientCounts.get(roomId)!
  counts.set(clientId, (counts.get(clientId) || 0) + 1)
}

function removeClientFromRoom(roomId: string, clientId: string) {
  const counts = roomClientCounts.get(roomId)
  if (!counts) return
  const count = counts.get(clientId)
  if (!count) return
  if (count <= 1) {
    counts.delete(clientId)
    if (counts.size === 0) {
      roomClientCounts.delete(roomId)
    }
  } else {
    counts.set(clientId, count - 1)
  }
}

function getOnlineUsers(roomId: string): string[] {
  return [...(roomClientCounts.get(roomId)?.keys() || [])]
}
```

**核心思想：** 按 clientId 而非 peerId 追踪，每个 clientId 在同一房间维护引用计数。只有引用计数归零时才从列表移除。`getOnlineUsers` 直接返回 Map 的 keys，天然去重。

---

## 11. totalOnline 在切换房间时不断递增

### 问题

`totalOnline` 显示的在线用户数在切换房间时不断增加，不会回落。

### 排查

#### 原因 A：`peerRooms.size` 不准确

`totalOnlineCount()` 原来返回 `peerRooms.size`：

```ts
function totalOnlineCount(): number {
  return peerRooms.size
}
```

但 `peerRooms` 只在 `join` handler 中被写入（不在 `open` 中），所以：

1. WS 打开时 peer 不在 `peerRooms` 中 → `totalOnlineCount()` 不包含新 peer
2. `join` 触发后才加入 `peerRooms` → 但没有发布 online-count 更新
3. 时序问题导致计数不准确

#### 原因 B：客户端僵尸重连

客户端 `disconnect()` 的实现：

```ts
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close() // 触发 close 握手
  ws = null
}
```

但 `ws.close()` 是异步的，close 事件稍后才触发：

```ts
ws.onclose = () => {
  store.connected = false
  reconnectTimer = setTimeout(connect, 3000) // 会创建新的重连定时器！
}
```

即使 `disconnect()` 清除了旧的 `reconnectTimer`，`onclose` 回调仍然会创建一个新的定时器。3 秒后这个"僵尸"定时器会建立新的 WebSocket 连接，但此时组件已卸载，没有人管理这个连接。

### 解决

#### 修复 A：独立的 clientPeerCounts 追踪

新增 `clientPeerCounts` Map，在 `open`/`close` 时维护，不依赖 `join`：

```ts
const clientPeerCounts = new Map<string, number>()

// open 时
clientPeerCounts.set(clientId, (clientPeerCounts.get(clientId) || 0) + 1)

// close 时
const pCount = clientPeerCounts.get(userId)
if (pCount !== undefined) {
  if (pCount <= 1) clientPeerCounts.delete(userId)
  else clientPeerCounts.set(userId, pCount - 1)
}

function totalOnlineCount(): number {
  return clientPeerCounts.size
}
```

`clientPeerCounts.size` 返回唯一 clientId 的数量，准确反映在线用户数。

#### 修复 B：断开前移除 onclose 处理器

```ts
function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.onclose = null // 关键：阻止 onclose 创建僵尸重连
    ws.close()
    ws = null
  }
}
```

`ws.onclose = null` 确保 `ws.close()` 触发的 close 事件不会执行重连逻辑。

---

## 12. 局域网 WebSocket 消息无法实时送达

### 问题

A 发一条消息，局域网另一台机器 B 无法实时收到，只有刷新后（通过 history 加载）才能看到。

### 排查

#### 步骤 1：确认数据流

服务端 `chat` case：

```ts
peer.send({ type: 'chat', message: msg }) // 发给自己 ✓
peer.publish(`room:${roomId}`, { type: 'chat', message: msg }) // 发给房间内其他人 ✗
```

`peer.send` 正常（发送者能看到消息），问题出在 `peer.publish`。

#### 步骤 2：阅读 crossws 源码

定位到 `node_modules/crossws/dist/_chunks/node.mjs` 中 `NodePeer.publish`：

```js
publish(topic, data, options) {
    const dataBuff = toBufferLike(data);
    const isBinary = typeof data !== "string";
    const sendOptions = { compress: options?.compress, binary: isBinary, ...options };
    for (const peer of this._internal.peers)
      if (peer !== this && peer._topics.has(topic))
        peer._internal.ws.send(dataBuff, sendOptions);
}
```

逻辑：遍历 `this._internal.peers`（同 namespace 下的所有 peer），排除自己，找到订阅了该 topic 的 peer，调用底层 `ws.send`。

#### 步骤 3：检查 peers 集合来源

在 Node adapter 的 `connection` 回调中：

```js
wss.on("connection", (ws, nodeReq) => {
    const peers = getPeers(globalPeers, nodeReq._namespace);
    const peer = new NodePeer({ ws, request, peers, ... });
    peers.add(peer);
});
```

`getPeers` 按 namespace 从 `globalPeers` Map 中取 Set。同一 namespace 的 peer 在同一个 Set 中。

#### 步骤 4：检查 namespace 逻辑

在 `AdapterHookable.upgrade` 中：

```js
async upgrade(request) {
    let namespace = this.options.getNamespace?.(request)
                   ?? new URL(request.url).pathname;
}
```

`NodeReqProxy` 构造 URL 的方式：

```js
const host = req.headers['host'] || 'localhost'
const url = `http(s)://${host}${req.url}`
```

- A（localhost）：`http://localhost:4331/_ws?clientId=xxx` → pathname `/_ws`
- B（LAN IP）：`http://192.168.x.x:4331/_ws?clientId=xxx` → pathname `/_ws`

namespace 都是 `/_ws`，应该在同一个 peers Set 中。

#### 步骤 5：检查 Nitro 的 WebSocket 集成

`nitropack/dist/presets/_nitro/runtime/nitro-dev.mjs`：

```js
import wsAdapter from 'crossws/adapters/node'
const { handleUpgrade } = wsAdapter(nitroApp.h3App.websocket)
server.on('upgrade', handleUpgrade)
```

Nitro dev 模式直接使用 crossws Node adapter，传入 `h3App.websocket` options。h3 的 `websocketOptions` 提供 `resolve` 函数按路径匹配 hooks。

#### 步骤 6：结论

crossws 的 `publish` 源码逻辑正确，namespace 一致，但实际在局域网环境中 `peer.publish` 未能正确将消息送达另一台机器的 peer。可能原因：

- crossws 内部 peers Set 的管理在特定场景下有问题
- `peer._topics` 在 `await`（如 `addMessage` 的异步操作）后状态不一致
- crossws 与 h3/Nitro 集成时的 adapter 初始化方式导致 peers 集合不完整

### 解决

**彻底绕过 crossws 的 publish/subscribe 机制，使用手动广播。**

#### 核心改动

新增 `allPeers` Map 存储所有已连接的 peer 对象：

```ts
const allPeers = new Map<string, { id: string; send: (data: unknown) => void }>()
```

两个广播函数：

```ts
function broadcastToRoom(roomId: string, data: unknown, excludePeerId?: string) {
  for (const [peerId, room] of peerRooms) {
    if (peerId !== excludePeerId && room === roomId) {
      allPeers.get(peerId)?.send(data)
    }
  }
}

function broadcastGlobal(data: unknown, excludePeerId?: string) {
  for (const [peerId, peer] of allPeers) {
    if (peerId !== excludePeerId) {
      peer.send(data)
    }
  }
}
```

#### 替换对照

| 原代码                                 | 新代码                                   |
| -------------------------------------- | ---------------------------------------- |
| `peer.subscribe('global')`             | 移除                                     |
| `peer.subscribe('room:${roomId}')`     | 移除                                     |
| `peer.unsubscribe(...)`                | 移除                                     |
| `peer.publish('global', data)`         | `broadcastGlobal(data, peer.id)`         |
| `peer.publish('room:${roomId}', data)` | `broadcastToRoom(roomId, data, peer.id)` |

#### 数据来源

- `broadcastToRoom` 利用已有的 `peerRooms`（`Map<peerId, roomId>`）判断哪些 peer 在目标房间
- `broadcastGlobal` 直接遍历 `allPeers`（所有已连接 peer）
- 两者都通过 `excludePeerId` 排除发送者

#### 生命周期管理

```ts
open(peer) {
    allPeers.set(peer.id, peer)
}
close(peer) {
    allPeers.delete(peer.id)
}
```

---

## 总结

| 问题             | 根因                                                 | 解决方案                                                   |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| crossws 版本冲突 | h3 bundle 的 crossws 与显式安装版本不兼容            | 不用 `defineHooks`，直接用 `defineWebSocketHandler`        |
| WebSocket 404    | handler 文件放在 `server/api/` 而非 `server/routes/` | 移到 `server/routes/`，启用 `nitro.experimental.websocket` |
| Pinia 未导入     | `@pinia/nuxt` 未注册到 modules                       | 添加到 modules 数组                                        |
| 测试时间戳精度   | `Date.now()` 同毫秒                                  | 测试中插入 5ms 延迟                                        |
| ESLint 格式错误  | slot 根元素、未用变量、属性顺序等                    | 修复每个具体 lint 问题                                     |
| 聊天高度溢出     | `h-screen` 不适应 flex 布局                          | 改为 `h-full` 依赖 flex 链                                 |
| 房间列表为空     | watch immediate 时 WS 未连接                         | `onopen` 中自动 join                                       |
| IME 误发送       | 未检查 `e.isComposing`                               | 添加 `!e.isComposing` 条件                                 |
| 身份不持久       | peer.id 每次连接都变                                 | localStorage clientId + query param                        |
| 在线用户重复     | peer 级追踪 + 事后去重                               | 引用计数 clientId 级追踪                                   |
| totalOnline 递增 | `peerRooms.size` 不准确 + 僵尸重连                   | 独立 `clientPeerCounts` + 移除 onclose                     |
| 局域网消息不送达 | crossws `publish` 机制不可靠                         | 手动广播替代 `peer.publish`                                |
