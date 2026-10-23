# NekBox：同一个 App 内按域名分流

## 为什么要域名分流

网关中的 SCNet、OpenAI、微信 API 和媒体 CDN 请求，全部由 **Claw App** 发出。仅把微信 App 排除代理，并不能决定 OpenClaw 微信插件的请求走哪条线路。

本次实践的目标：

| 请求 | 本次采用的策略 |
| --- | --- |
| SCNet | 直连 |
| OpenAI / ChatGPT | 通过可用代理 |
| 微信 API 与默认媒体 CDN | 直连 |

这是当前环境的排障策略，不代表这些站点在所有地区和网络都必须如此。代理节点是否可用、服务是否允许该地区访问，都要实际测试。

## 1. 分应用代理

用户截图中开启的是“**代理被勾选应用的流量**”，但 `Claw / com.openclaw.android` 未勾选。因此需要勾选 Claw，让请求进入 NekBox 的路由判断。

微信原生 App 可保持不勾选；这与网关插件的网络分流是两件事。

## 2. 路由规则

在“路由”页面新增规则，`domain` 字段每行一项。`domain:` 匹配域名及子域名；`full:` 只匹配完整域名。不要在该字段粘贴 `https://` URL 或混入中文备注。

### 国内服务直连

名称可写“SCNet和微信直连”，domain：

```text
domain:scnet.cn
domain:weixin.qq.com
```

outbound 选择“**绕过**”（直连），保存并启用。

微信插件的默认 API 为 `ilinkai.weixin.qq.com`，默认 CDN 为 `novac2c.cdn.weixin.qq.com`，均由此规则覆盖。若服务返回其他媒体 URL，需要根据实际日志确认其主机，不保证这两行覆盖所有未来 CDN。

### OpenAI 代理

名称可写“OpenAI代理”，domain：

```text
domain:openai.com
domain:chatgpt.com
domain:oaistatic.com
domain:oaiusercontent.com
```

outbound 选择“**代理**”，保存并启用。

把明确的域名规则放在可能抢先匹配的宽泛规则之前，保留其他应用原有规则。截图中已有其他中国域名/IP规则但开关关闭，不要仅看到规则名称就误以为它们正在生效。

## 3. DNS 与重连

本次过程中 FakeDNS 曾与“解析到特殊地址被拦截”同时出现，排障时保持关闭。不要把 `198.*` 的所有地址都叫 Fake IP；例如日志里的 `198.44.*` 不属于常见的 `198.18.0.0/15` 假地址段。

保存后停止并重新连接 NekBox，再重启前台网关，让新连接重新进行 DNS 和路由选择。

## 4. 不带密钥的连通性测试

```bash
node scripts/network-check.cjs
```

默认 POST 到 SCNet 的 `/anthropic/v1/messages`，请求体为空、不带密钥。收到 `400` 或 `401` 等响应只证明已拿到 HTTP 响应，不证明账号、额度、模型或工具调用成功。

临时去掉终端显式代理变量：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy node scripts/network-check.cjs
```

这**不会关闭安卓 VPN**，也不会覆盖 NekBox 的域名规则。测试链路后，再进行一次短模型请求，最终以实际回复/请求状态确认。

## 5. 错误分类

| 错误 | 含义与下一步 |
| --- | --- |
| `ECONNRESET`、TLS 握手前断开 | 连接被重置，先比较直连、代理、Wi-Fi/移动网络；不能直接断言密钥错误 |
| `ECONNREFUSED host:443` | TCP 连接被拒绝；确认实际请求主机、路由与代理节点 |
| `ETIMEDOUT` | 连接/请求超时；检查对应服务，不要先无限延长超时 |
| `401/403` | 已收到 HTTP 响应，但鉴权/服务权限或上游策略仍需检查 |
| `429 insufficient_quota` | 服务返回额度问题；网络和聊天订阅不等于该接口有额度 |
| SCNet `200`，OpenAI 失败 | 两条独立服务链路状态不同，不能合并为“整个网关断网” |

为保护凭据，网络测试不打印请求头、密钥、OAuth Token 或完整私有环境文件。
