# 版本分支与快照来源

目标仓库：https://github.com/Jessica-yaoyao/Glimpse。main 对应最新发布状态，各 release 分支固定保留对应版本。标签 v0.4.0、v0.5.0、v0.5.1 用于下载与检出，不把图标／静态打包另造为新版本号。

| 版本 | 恢复依据 | 说明 |
| --- | --- | --- |
| 0.4.0 | v0.5 开发前保存的完整 src/、desktop/、package.json 快照 | 应用包的版本信息为 0.4.0 / build 8 |
| 0.5.0 | v0.5.1 开发前保存的 src/、package.json、Glimpse.swift 和 Info.plist，配合未变化的原生模块及旧打包脚本 | 应用包的版本信息为 0.5.0 / build 9；原生模块与保留快照逐项核对 |
| 0.5.1 | 最新 src/、desktop/ 与锁文件 | 0.5.1 / build 10；包括粉笔、图标和静态分发子迭代 |

原始工作区没有 Git 历史。本仓库的提交为快照导入，导入日期 2026-10-21；CHANGELOG 保存原交付日期。不是逐日开发过程的重新编造。

共同配置（Vite、TypeScript、pnpm 锁文件）取自各版本未改变的工程基础。为了脱离原工作区构建，各历史版本打包临时路径统一改为 .build/desktop，默认输出 .build/macos。版本中 src 的原始哈希和发布 ZIP 哈希保存在 [导入清单](releases/import-manifest.json)。

安装包沿用原交付包，不用今天重新构建的二进制冒充历史包。v0.5.1 的最终 macOS 包含新图标，静态包使用既有 Mock。所有二进制放在 GitHub Releases，源码树只保存代码、文档与示例截图。

检出某一版本：

```bash
git switch release/0.5.0
# 或 git checkout v0.5.0
```

分支内容不含用户照片、真实评分任务、Keychain 数据、Token 账本、开发机工作路径或凭据。视觉截图使用示例／隔离记录，模型能力边界见 ACCEPTANCE.md。
