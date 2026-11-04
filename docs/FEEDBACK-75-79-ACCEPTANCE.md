# 模型错误详情与战斗入口修复

关联 #75、#79，实施基线`bbdfab3856d2b09d1bdd8b90a08b57c6b478fae4`。

流式及HTTP200错误响应现在复用既有详情提取、密钥脱敏和限长处理，页面与诊断可显示供应商原因。收到的正文继续沿既有候选保留和处理入口。

网页“终端→人物→战斗→故事存档”先关闭终端modal，再打开设置popover。原生Gal战斗按钮挂到当前工具栏；速决/纯文本在没有战报时打开现有空战报页，即时战术及活动旧战斗保持原交互入口。

| 验证 | 结果与范围 |
| --- | --- |
| 模型错误详情检查 | 23项通过；原源码新增SSE断言失败，修后通过；覆盖200 JSON、SSE、NDJSON、正常回复、脱敏与长度 |
| 连接设置/失败候选 | 16项连接、6项候选行为通过；请求次数与原已保存状态保持 |
| 战斗定向检查 | 21项通过；原fast/text无战报可见性反例失败，修后通过；旧战斗实际挂载回归替换源码字符串断言 |
| 当前完整回归 | 1597通过、0失败 |
| 网页实际入口 | 最终构建`6c8649b679fd32aa9976`，战斗/存档3项、错误正文/390px2项通过；页面异常0 |
| 隔离SillyTavern1.19.0 | 成卡`7171afacb49e…`导入、创建、保存、刷新及战斗入口共10项通过；页面异常/控制台error为0 |

实际浏览器为Edge Chromium156，桌面1280×900、窄屏390×844。模型使用受控响应，付费调用0。实体手机触控与输入法仍归#80/#81；供应商具体400/502归#78。

可重跑入口：

```powershell
node 工程文件/网页独立版/tools/model-error-detail-check.mjs
node --test 工程文件/测试/当前/feedback-battle-lifecycle.test.cjs 工程文件/测试/当前/battle-mode.test.cjs 工程文件/测试/当前/battle-entry.test.cjs
node 工程文件/工具/构建/当前/tests.cjs
node 工程文件/网页独立版/tools/feedback-75-79-browser.mjs --root <候选目录> --scenario combat --out <证据目录>
node 工程文件/网页独立版/tools/feedback-75-79-browser.mjs --root <候选目录> --scenario stream --out <证据目录>
```

原生实际检查复用`first-open-save-host.cjs`，启用`CXX_BATTLE_ENTRY_CHECK=1`，传入本次候选并设置专用`CXX_EVIDENCE`。运行前确认既有隔离宿主的监听进程和数据目录，复用现有实例。

本机原始回执、修前失败和截图位于`.cache/feedback-implementation-20261105/`；阶段完整经过由项目进度指向。当前结果属于本批候选验收，正式发行在相应发布记录核对。
