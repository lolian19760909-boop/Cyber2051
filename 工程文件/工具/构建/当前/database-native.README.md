# 数据库1.3兼容候选

此候选基于项目已固定的龙血玄黄数据库1.3原件，修复长档SQLite查询的WASM栈归还、原生世界书完整字段保存，以及同名世界书读改写并发。

上游项目：https://github.com/AlbusKen/shujuku

版本：`1.3.0+cyber2051.1`。生成入口：`node 工程文件/工具/构建/当前/database-native.cjs`。`compatibility.json`记录原件、补丁清单及产物SHA256；重复生成的index.js字节固定。

原件SHA256：`1ac8688fff869c9467f1c72690d711002074259a5bbe900bb4f752ce9d8556b9`

候选index.js SHA256：`75f2a3caf2ce3593e4cfbe06a919d656cfc5a640e23a417fadee3ce7b71ec54e`

安装前保存聊天并关闭酒馆，备份原数据库扩展到扩展目录以外。将本候选的index.js与manifest.json放入原数据库扩展目录，保留原插件已有其它文件，再启动并刷新。每次只启用一个数据库实例。角色卡使用原有数据库接口，玩家资料和数据库表沿原位置保存。

当前已在隔离SillyTavern1.19.0、Tavern Helper4.11.3完成新建、保存读回、旧字段保持、开局点恢复和后续游玩验收。正式安装采用作者确认的目标实例；回退时关闭酒馆并恢复备份的原插件文件，玩家聊天和数据库记录继续保留。
