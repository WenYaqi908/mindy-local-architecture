# 温润引文 · 思源宋体资产

本目录提供思源宋体简体中文 Regular 2.003，供温润降级模式的**引文**使用。界面、标题和普通正文沿用无衬线字体；不要因引入宋体而把整页正文改成宋体。

| 文件 | 用途 | 来源性质 | 字节数 |
| --- | --- | --- | ---: |
| SourceHanSerifSC-Regular.otf | 原生平台字体注册 | 与 Adobe 官方 GitHub 记录一致的原始 OTF | 24,543,332 |
| SourceHanSerifSC-Regular.woff2 | Web／H5 本地字体加载 | 由上述 OTF 使用 fontTools 4.60.2 转换的网页字体 | 16,713,472 |

两份文件的内部 family 均为 `Source Han Serif SC`，PostScript 名称为 `SourceHanSerifSC-Regular`，字重为 400；版本字段为 `Version 2.003;hotconv 1.1.1;makeotfexe 2.6.0`。WOFF2 保留原始字符集，没有按业务文案裁剪，也不是另一次官方发布的原始二进制。

## 来源与完整性

下载渠道为[南京大学字体镜像](https://mirrors.nju.edu.cn/adobe-fonts/source-han-serif/OTF/SimplifiedChinese/SourceHanSerifSC-Regular.otf)中的 `source-han-serif2.003SC` 发行资产；来源身份通过 [Adobe 官方 GitHub 文件元数据](https://api.github.com/repos/adobe-fonts/source-han-serif/contents/OTF/SimplifiedChinese/SourceHanSerifSC-Regular.otf?ref=release)核对，而非仅凭镜像文件名判断。[官方仓库文件](https://github.com/adobe-fonts/source-han-serif/blob/release/OTF/SimplifiedChinese/SourceHanSerifSC-Regular.otf)

2026-09-28 本地重算 OTF 的 Git blob SHA-1，得到 `cb41635674be23029e98469f729eded6ebc54611`，与官方 API 记录一致。Git blob 哈希使用 `blob <字节数>\0<文件内容>` 计算，不是裸文件 SHA-1。两份文件的 SHA-256、字节数、名称与加工关系完整记录在 [manifest.json](./manifest.json)。

## 字符范围与使用边界

OTF 和 WOFF2 均有 44,779 个 cmap 码位、65,535 个字形；两份文件的 cmap 码位集合一致。2026-09-28 检查 65 张 App、3 张 Web v2 SVG 的 `text`／`foreignObject` 源文案，排除空白和控制／格式码位后共有 721 个独立码位，宋体覆盖 719 个。未覆盖的 `⌁`（U+2301）和 `▰`（U+25B0）属于装饰符号，需符号字体回退。

这份单文件 WOFF2 约 15.94 MiB；其存在不代表应在每页阻塞式加载。字体未就绪或解码失败时，引文应立即使用本机宋体／通用 serif 回退。静态字符检查不能代替真机字形、行高、换行和动态字号验收。

## 许可与署名

完整许可证保留在 [OFL.txt](./OFL.txt)：Copyright 2017–2022 Adobe，Reserved Font Name 为 `Source`，采用 SIL Open Font License 1.1。分发 OTF、WOFF2 时均保留该文件和字体内部版权／许可记录。WOFF2 的格式转换身份与原始 OTF 的官方身份分别记录，不将项目转换文件表述为 Adobe 新发布的文件。
