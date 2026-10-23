# NekBox 域名规则

先在“代理被勾选应用”模式下勾选 Claw。

规则一，出站“绕过”：

```text
domain:scnet.cn
domain:weixin.qq.com
```

规则二，出站“代理”：

```text
domain:openai.com
domain:chatgpt.com
domain:oaistatic.com
domain:oaiusercontent.com
```

保存、启用，排在会抢先匹配的宽泛规则前面。保持排障期间 FakeDNS 关闭，重连 NekBox 和网关。这里是供 UI 的 domain 字段粘贴的规则，不是完整 sing-box JSON。
