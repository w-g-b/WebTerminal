# API 接口文档

## HTTP REST API 接口

### 1. 用户登录
```
POST /api/auth/login
```

**请求体:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应成功:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

**响应失败:**
```json
{
  "error": "User not found"
}
```

**使用方案:**
- 默认用户名: `admin`
- 默认密码: `admin123`
- 登录成功后会返回获得 JWT token，后续请求需在 Authorization header 中携带该 token
- Token 有效期: 24 小时

**Curl 示例:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

### 2. 验证 Token
```
POST /api/auth/verify
```

**请求头:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "valid": true,
  "user": {
    "username": "admin"
  }
}
```

**使用方案:**
- 需要在请求头中携带有效的 JWT token
- 用于验证当前用户身份是否有效

**Curl 示例:**
```bash
curl -X POST http://localhost:8080/api/auth/verify \
  -H "Authorization: Bearer your-jwt-token"
```

---

### 3. 获取服务器状态
```
GET /api/status
```

**请求头:**
```
Authorization: Bearer <token>
```

**响应:**
```json
{
  "status": "ok",
  "user": {
    "username": "admin"
  },
  "stats": {
    "totalSessions": 2,
    "maxSessions": 10
  }
}
```

**使用方案:**
- 需要在请求头中携带有效的 JWT token
- 返回当前服务器状态和终端会话统计信息

**Curl 示例:**
```bash
curl -X GET http://localhost:8080/api/status \
  -H "Authorization: Bearer your-jwt-token"
```

---

