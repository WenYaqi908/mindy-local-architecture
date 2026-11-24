# 心享AI · MindyAI N1 AI Logo

来源：`lightread-design-v3/logo/`，设计提交 `a7f9807`（2026-10-10）。2026-10-12 确认同步到 app 与 web；使用已批准的金色细笔画 AI，字形为固定路径。

- `mark-primary.svg` 用于浅色背景；`mark-on-dark.svg` / `mark-plus.svg` 用于深色背景。
- `static/profile-ai-history/brand-mark*.svg` 使用相同几何，仅收紧画板以适配现有横向位置。
- `app-icon-light.svg` / `app-icon-dark.svg` 保留正式展示图标；默认打包采用设计规范推荐的深色版。
- `favicon-16.svg`、`favicon-32.svg` 为设计提供的小尺寸光学校正版，禁止以主标缩放替代。
- `static/app-icons/` 是 manifest 引用的可跟踪打包资产。打包 PNG 使用不透明方形背景，由系统应用外部圆角遮罩。

重新生成 PNG（沿用项目已有 sharp 环境变量约定）：

```sh
LIGHTREAD_SHARP_PATH=/path/to/sharp node scripts/generate-brand-icons.mjs
```

本次更新为源码和资源替换；已安装 app 的桌面图标须重新打包安装后更新。

2026-10-12：产品中文显示名改为「心享AI」，英文显示名改为「MindyAI」。现有域名、包标识、URL scheme、支付商品标识与存储键继续沿用；此更名只涉及对外显示。
