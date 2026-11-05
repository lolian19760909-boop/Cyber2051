# 辅助模型用途协议选择

关联 #78 的配置调查。当前已确认一个兼容配置缺口：辅助用途仅指定`family: 'google-gemini'`时，原会话仍沿正文的OpenAI adapter发送请求，产生错误路径和请求体。

`session.mjs`统一用`modelForPurpose()`选择实际模型、提示来源和用途配置。选择顺序为用途adapter、用途family、正文协议；已有连接继承规则保持。独立连接的凭据采用该用途归一化结果，旧apiKey别名也遵循同一规则。

验证：

- 新8组实际session→model port→adapter检查通过，family-only原反例由失败转为通过；每组同时核对body、memory、archive。
- 原16项连接与23项错误详情检查通过；本机HTTP转发1项通过，原会话状态接收检查通过。
- 独立复核补充主连接family/旧apiKey、summary→compact的Claude配置两组通过。
- 所有地址、型号、响应与凭据均为虚构夹具；供应商请求0。

```powershell
node 工程文件/网页独立版/tools/provider-purpose-check.mjs
node 工程文件/网页独立版/tools/provider-connection-check.mjs
node 工程文件/网页独立版/tools/model-error-detail-check.mjs
node 工程文件/网页独立版/tools/model-network-check.mjs
```

本修复对应上述已复现的配置路径。玩家原始火山502、官D400仍需结合具体用途、响应原话和实际端点对应；当前设置UI同时写入adapter/family，所以本条结果分别记录兼容缺口修复与供应商个案待定位。
