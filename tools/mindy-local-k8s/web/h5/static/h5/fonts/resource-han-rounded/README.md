# 资源圆体 · LightRead V2 字体资产

本目录用于 LightRead V2 的设计稿、网页预览和 SVG 导出，采用 **Resource Han Rounded SC 0.990** 的三个真实静态字重。

## 来源与发布范围

字体由 Cyano Hao 基于思源黑体制作圆角字形。上游版本为 [Resource Han Rounded 0.990](https://github.com/CyanoHao/Resource-Han-Rounded/releases/tag/v0.990)，网页切片由 [ZeoSeven Fonts](https://fonts.zeoseven.com/items/989/) 使用 cn-font-split 发布。

本地发布清单覆盖所选三个字重的全部 **752 个 WOFF2 切片**：

| 字重 | 样式 | 源 CSS | 切片数 |
| --- | --- | --- | ---: |
| 400 | Regular | [main/result.css](https://fontsapi.zeoseven.com/989/main/result.css) | 250 |
| 500 | Medium | [sc-medium/result.css](https://fontsapi.zeoseven.com/989/sc-medium/result.css) | 250 |
| 700 | Bold | [sc-bold/result.css](https://fontsapi.zeoseven.com/989/sc-bold/result.css) | 252 |

这里的“完整发布集”指上述三个字重对应源 CSS 声明的全部切片。其覆盖范围以各条 `unicode-range` 和字体实际字形为准；完整清单不等于支持所有 Unicode 字符。

`regular-source.css`、`medium-source.css`、`bold-source.css` 保留来源元数据，三者均标注版本 `0.990`、正常样式与 OFL 1.1。`manifest.json` 记录每个切片的字重、原始 URL、本地文件名、Unicode 范围、字节数和 SHA-256。2026-09-28 核对了全部 752 个本地文件，均与清单哈希一致。

## 字体名称与使用方式

源 CSS 中 Regular、Bold 的 family 为 `Resource Han Rounded SC`，Medium 的 family 为 `Resource Han Rounded SC Medium`。网页使用统一的 CSS 别名；原生注册时使用各文件实际的 PostScript 名称，见 [原生字体说明](./native/README.md)。

项目在 `fonts.css` 中统一使用 CSS family 别名 **`Resource Han Rounded SC`**，通过 `font-weight: 400 / 500 / 700` 选择实际字重。网页切片仅调整 CSS family 映射、资源路径和本地文件名，下载的 WOFF2 二进制保持原样。网页样式禁用合成字重，确保中等与粗体使用相应字体文件。`native/` 中的 TTF 是另行重组、裁剪后的派生产物，不适用“二进制保持原样”的描述。

普通网页可加载本目录的 `fonts.css`，浏览器依据 `unicode-range` 按需读取切片。源 CSS 中保留的 `local()` 引用只用于来源记录；项目生成的 CSS 使用本地资源文件，避免预览随设备已安装的字体版本变化。

## SVG 导出

`tools/lib/rounded-typography.mjs` 从 SVG 文本提取字符，并在清单中选择 Unicode 范围与这些字符相交的切片，将其以 Base64 内嵌到 SVG。选择过程覆盖三个字重，保留原切片的 `unicode-range`。

因此，每张 SVG 携带当前文本涉及的切片；切片本身保持来源文件的完整内容，不再逐字裁剪。修改 SVG 文本后应重新运行相应生成流程，让新字符对应的切片进入导出文件。本目录保留三个字重的完整发布清单，供后续新增文案继续使用。

## 生产 App 接入

本项目已在 [native/](./native/README.md) 提供 `Regular.ttf`、`Medium.ttf`、`Bold.ttf`。它们由当前三个字重的全部 WOFF2 切片重组，再删除声明的 Hangul 码位范围；每个字重保留 33,131 个 cmap 字符。**这些文件是项目加工的原生字体包，不是作者官方发布的原始 TTF 二进制。** 原始切片、来源清单、版权和 OFL 文件均保留。

原生包的实际 family、PostScript 名称、输出校验值、加工步骤及构建方式见 [native/README.md](./native/README.md)。当前设计基于 0.990；如以后改用[作者官方 Releases](https://github.com/CyanoHao/Resource-Han-Rounded/releases)中的其他版本或格式，需重新确认字宽、行高、换行和字重映射。

上线前应使用实际业务字符做覆盖与渲染测试，包括中文标点、数字、货币符号、中英混排、用户姓名、生僻字及业务支持的其他语言，并在目标 iOS／Android 设备上检查缺字回退、粗体、截断与动态字号。设计稿按当前文案内嵌的切片适合预览导出；生产内容的字体包和回退策略应按实际字符需求配置。

2026-09-28 的静态覆盖核验包含 65 张 App 与 3 张 Web v2 SVG 的 `text`／`foreignObject` 源文案，共 721 个非空白、非控制码位。三个原生字重均覆盖其中 719 个；未覆盖的 `⌁`（U+2301）和 `▰`（U+25B0）使用符号字体回退。此结果不代表任意新增文案都已覆盖，也不替代真机排版验证。温润降级方案的引文宋体另见 [warm-serif](../warm-serif/README.md)。

## 许可与署名

字体许可证原文见同目录 [OFL.txt](./OFL.txt)，分发字体时应一并保留该文件、版权声明和源元数据。

- 0.990 源 CSS 元数据：© 2018–2019 Cyano Hao；部分版权 © 2014、2015、2018 Adobe。
- 随附上游 OFL 文件：© 2018–2022 Cyano Hao；部分版权 © 2014–2021 Adobe；保留字体名称为 `Source`。
- 切片服务与构建：ZeoSeven Fonts；切片工具：cn-font-split。

具体许可条件以 [OFL.txt](./OFL.txt) 原文为准。
