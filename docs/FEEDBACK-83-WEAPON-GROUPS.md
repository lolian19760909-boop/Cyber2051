# 开局武器按类型分组

关联 #83。三个武器槽的下拉框现在按官方九类排列，包含全部 183 件官方武器及 15 种通用模板。分组复用官方 `group`，通用模板沿现有标签归类；未知分类仍可出现在清单中。已选武器的说明同时显示类型。

改动位于 `loadout-setup.js` 的选项构造和展示，沿现有装备编号、槽位、品阶和提交路径。义体选择仍按部位独立配置。

- 网页候选 `eec9a95b13198bba9a82` 实际 4 项通过：三个槽位完整分组、390px 改选/清空、返回步骤保留配置、提交与刷新一致。
- 原生成卡 `a329ccbbc6ae8b3b6ccd4f31b602883afee681d16d52a8084a52b4621dd8e4d3` 在实际酒馆 10 项通过，含装备/义体、负资金、自定义外貌、唯一开局点、恢复新路线与下一轮保存。
- 装配和开局流程相关 32 项通过。实际选择为 `sniper_t5`、`berserk_t4`、`-250` 日元；0 和有符号资金的原规则继续沿用。
- 页面异常、付费模型请求均为 0；移动布局采用桌面 Edge 的 390px 视口验证。

证据根：`.cache/feedback-implementation-20261105/weapons83`。复查使用 `tools/opening-weapon-groups-browser.mjs`；原生使用 `CXX_WEAPON_GROUP_CHECK=1`、`CXX_OPENING_CHOICES=1`、`CXX_OPENING_POINT_CHECK=1` 的 `first-open-save-host.cjs`。
