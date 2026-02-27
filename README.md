# Web Terminal

基于 Node.js 和 React 的 Web 终端应用，支持通过浏览器直接执行本地 Shell 命令。

## 功能特性

- **统一终端界面**：
  - 完整终端模拟器（xterm.js）：支持颜色、快捷键、完整交互体验
  - 简易命令输入：底部命令输入框，支持快速执行命令和历史记录导航
  - 输出统一显示在终端区域，提供一致的视觉体验
- **用户认证**：JWT Token 认证，支持用户注册和登录
- **实时通信**：WebSocket 双向通信，实时传输命令结果
- **会话管理**：创建/销毁终端会话
- **安全控制**：命令过滤，危险命令拦截，会话超时
- **多种传输模式**：支持 WebSocket 和 Polling 两种传输方式

## 项目结构

```
web-terminal/
├── server/                 # 后端服务器
│   ├── index.js           # Express 服务器入口
│   ├── socket.js          # WebSocket 处理
│   ├── terminal.js        # PTY 终端管理
│   ├── auth.js            # JWT 认证逻辑
│   ├── middleware/        # 中间件
│   │   └── authMiddleware.js
│   └── utils/             # 工具函数
│       └── commandFilter.js
├── client/                # 前端应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── App.jsx
│   │   │   ├── Auth.jsx
│   │   │   └── Terminal.jsx
│   │   └── services/      # API 服务
│   │       ├── api.js
│   │       └── websocket.js
│   └── public/
│       └── index.html
├── package.json
└── .env                   # 环境变量
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd /root/web-terminal
npm install

# 安装前端依赖
cd client
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件（可选）：

```env
PORT=8080
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
MAX_SESSIONS=10
SESSION_TIMEOUT=300000
```

### 3. 启动应用

#### 开发模式（同时启动前后端）

```bash
cd /root/web-terminal
npm run dev
```

#### 分别启动

```bash
# 终端 1：启动后端
cd /root/web-terminal
npm run server

# 终端 2：启动前端
cd /root/web-terminal/client
npm run dev
```

### 4. 访问应用

- 前端界面：http://localhost:3000
- 后端 API：http://localhost:8080
- WebSocket：ws://localhost:8080

## 使用说明

### 界面功能

1. **连接管理**
   - 点击侧边栏的 "Connect" 按钮连接到服务器
   - 可选择 WebSocket 或 Polling 传输模式
   - 点击 "Disconnect" 断开连接

2. **会话管理**
   - 点击 "New Session" 创建新的终端会话
   - 点击 "Close Session" 关闭当前会话

3. **终端操作**
   - 主终端区域：完整的终端交互体验，支持所有 ANSI 转义序列、颜色输出、快捷键等
   - 底部命令输入框：快速输入命令并执行
     - 支持方向键 ↑/↓ 浏览历史命令
     - 按 Enter 执行命令
     - 命令输出会实时显示在终端区域

4. **调整大小**
   - 拖动底部手柄可调整终端高度
   - 终端会自动适应窗口大小变化

### 快捷键

- `Ctrl+C`：中断当前命令
- `Ctrl+L`：清屏（在终端模式下）
- `↑/↓`：浏览历史命令（在命令输入框中）

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

**⚠️ 重要：生产环境请立即修改默认密码和 JWT_SECRET！**

## API 端点

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/verify` - 验证 Token

### 状态

- `GET /api/status` - 获取状态信息（需要认证）

## WebSocket 事件

### 客户端 → 服务器

- `create_session` - 创建新会话
- `input_command` - 发送命令
- `resize` - 调整终端大小
- `close_session` - 关闭会话
- `list_sessions` - 列出会话

### 服务器 → 客户端

- `output_data` - 命令输出数据
- `session_created` - 会话创建成功
- `session_closed` - 会话关闭
- `sessions_list` - 会话列表
- `error` - 错误信息

## 安全注意事项

1. **生产环境必须更改** `JWT_SECRET`
2. **强密码策略**：要求用户使用复杂密码
3. **命令白名单**：根据需要调整 `server/utils/commandFilter.js` 中的命令列表
4. **HTTPS**：生产环境建议使用 HTTPS
5. **速率限制**：建议添加 express-rate-limit 中间件
6. **日志记录**：建议添加执行日志记录
7. **访问控制**：考虑添加 IP 白名单或防火墙规则

## 生产部署

### 构建前端

```bash
cd /root/web-terminal/client
npm run build
```

### 启动生产服务器

```bash
cd /root/web-terminal
NODE_ENV=production npm run server
```

## 技术栈

### 后端
- Node.js + Express
- Socket.io（WebSocket）
- node-pty（伪终端）
- JWT（认证）
- bcryptjs（密码加密）

### 前端
- React 18
- Vite（构建工具）
- xterm.js（终端模拟器）
- Socket.io-client（WebSocket 客户端）
- Axios（HTTP 客户端）

## 故障排除

### 后端无法启动

- 检查端口 8080 是否被占用
- 检查依赖是否正确安装
- 查看错误日志

### 前端无法连接后端

- 确认后端服务器正在运行
- 检查 WebSocket 代理配置
- 检查浏览器控制台错误

### 命令执行失败

- 检查命令是否在白名单中
- 检查用户权限
- 查看服务器日志

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
