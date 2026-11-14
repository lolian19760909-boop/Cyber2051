# Cyber2051

东京都2051／赛博小祥2051的游戏前后端源码。欢迎通过 [Issues](https://github.com/lolian19760909-boop/Cyber2051/issues) 报告问题、讨论创作，通过 Pull Request 提交修改。

3.2.0恢复梦限大五人及45张立绘，修复创角草稿容量、保存误报与图片缓存重取。安装和更新见[3.2.0说明](docs/RELEASE-3.2.0.md)，游玩入口为[网页版](https://cyber2051.top/play/)；网页引擎沿用3.0.0，内容与资源按版本更新。问题接续见[当前问题](docs/HANDOFF.md)。

## 目录

- `工程文件/网页独立版`：网页引擎、界面、模型适配和酒馆接入。
- `工程文件/网站/gateway`：网站后端、账号与模型转发。
- `工程文件/卡片源码`：运行脚本、世界书、预设和游戏数据。
- `工程文件/工具`、`测试`、`配套扩展`：构建工具、测试和共用模块。

## 本地检查

需要Node.js 24及以上。

```sh
git submodule update --init --recursive
npm ci
npm run setup:source
node 工程文件/网页独立版/tools/generation-contract-check-300.mjs
```

完整打包还需要[资源输入](docs/ASSETS.md)。源码仓库不存放运行数据、密钥、素材包、缓存或旧发行包。

协作方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。第三方源码沿用各组件已有许可证与来源记录。
