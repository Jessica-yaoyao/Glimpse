# GitHub Pages 网页演示

在线入口：https://jessica-yaoyao.github.io/Glimpse/

仓库：https://github.com/Jessica-yaoyao/Glimpse

首次部署日期：2026-10-22。

## 发布方式

源码保存在 main，编译后的静态文件单独放在 gh-pages 分支，Pages 的发布源为该分支根目录。无需后端、服务器或付费模型凭据。

当前 GitHub 授权具备仓库写入权限，没有另行申请修改 GitHub Actions workflow 的权限。因此采用 GitHub Pages 支持的发布分支方式；没有写入自定义 workflow。Pages 会在 gh-pages 更新后执行内建部署流程，但仅推送 main 不会自动构建新的网页。

更新站点：

```bash
pnpm install --frozen-lockfile
# 完成修改、检查并提交到 main 后：
pnpm deploy:pages
```

该命令先运行 TypeScript 和 Vite 构建，在新临时目录准备 gh-pages 提交，并正常 push。再次部署会延续 gh-pages 历史，不强制覆盖。命令要求 source 工作树干净，使用当前配置的 Git 凭据与作者信息。首次启用 Pages 由仓库管理员配置；后续部署不再修改权限。

发布的 deployment.json 记录版本与确切的 main 提交编号，便于核对网页来源。

## 可用功能

首次引导、照片上传／拍照入口、框选、粉笔精细选区、擦除、撤销／重做、描述、处理进度、SVG 显影、对比滑块、原图、日志、时间轴和月历。数据只属于当前浏览器，不会同步本机应用中的照片、评分或 Keychain。

显影使用既有 MockRevealProvider。示例为预置狐狸，上传照片为明确标注的通用实验线稿；网页没有真实 Kimi 理解能力，也没有原生 MapKit 或 Vision 桥接。真实识别与系统地图仍由 macOS 版本提供。

## 相机与定位

GitHub Pages 使用 HTTPS。相机和定位仍取决于设备、浏览器和使用者授权；在应用内嵌浏览器中还可能受宿主权限限制。拒绝时可继续上传照片或手工填写地点。

## 回滚

gh-pages 保留每次部署历史。可将先前部署的静态文件恢复为一个新提交，再正常推送该分支。不要改写历史版本标签，也不要把私人照片、API Key、质量任务或 Token 账本提交到发布分支。
