# LightRead 图标资源

`source/` 保存 SVG 母版；`manifest.json` 记录设计稿符号来源、导出路径和颜色。伴聊、听读与导航图标取自 app-mockups-v2 的对应页面，发送、删除、空状态沿用项目原资源。

设计稿提取的图标以 24 × 24 为基准，默认线宽 1.75，保留符号自身的局部覆盖。导出文件使用明确颜色，避免独立 SVG 图片无法继承页面 `currentColor`。通用图标同时提供 72 × 72 PNG，供原生端引用。

修改母版或清单后，使用可用的 `sharp` 环境重新导出：

```sh
node scripts/build-ui-icons.mjs
```

若 `sharp` 位于独立工具环境，可通过 `LIGHTREAD_SHARP_PATH` 指定模块路径。应用构建直接使用已生成资源，不依赖该工具。脚本也会从五个角色主头像生成 120 × 120 缩略图，保持同一角色的形象一致。

导航资源包含 neutral、warm、gold、diamond 四组颜色，已由 `AppBottomNav.vue` 接入个人页底栏。这里的主题颜色用于图标本身，底色仍由导航组件提供。
