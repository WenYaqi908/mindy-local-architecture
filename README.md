# 心享本地测试：代码怎么读

这是一台 Mac 上实际跑起来的本地验收环境，不是线上环境。线上数据库、线上短信和云端实时语音都没有接。

先看两张图，再按下面的目录对照代码：

- [空间架构](docs/空间架构.md)：各部分放在哪里，谁连谁。
- [流程架构](docs/流程架构.md)：从登录、听读、聊天到听记，按时间怎么走。
- [给老师的进度说明](给老师的进度说明.md)：热点测试和后面三项改动做到哪一步。

`框架.png` 和 `框架2.png` 是原来的目标图。上面两张图画的是现在这台 Mac 上的实际结构。

## 组成部分

| 目录或文件 | 是什么 | 老师看代码时看哪里 |
|---|---|---|
| `phone-app/` | iPhone 外壳。负责打开本机加密页面，把麦克风和播放交给页面。 | `phone-app/MindyPocket/main.swift` |
| `tools/mindy-local-k8s/manifests/` | 本地 Kubernetes 里的各个服务。 | 见下一节 |
| `tools/mindy-local-k8s/config/application-local.yml` | 业务服务的本地配置：数据库、缓存、音频和语音地址。 | 同一文件 |
| `tools/mindy-local-k8s/web/` | 手机打开的听读和聊天页面，以及把它装进入口的方式。 | `web/Dockerfile`，页面在 `web/h5/` |
| `tools/mindy-local-k8s/sql/local-schema-align.sql` | 本地库补表脚本。听记表和先前缺的几张表在这里。可重复执行。 | 同一文件 |
| `tools/mindy-local-k8s/backup/` | 加密备份和恢复演练。演练导入临时库，核对后删除，不替换正在用的库。 | `backup.sh`、`restore-drill.sh` |
| `tools/mindy-local-k8s/certs/` | 测试证书的公钥。手机信任后才能打开加密地址。私钥没有放进仓库。 | `certs/ca/`、`certs/tls.crt` |
| `tools/local-realtime-voice.py` | 本地语音替身。业务服务把通话转到这里，不走云端语音。 | 同一文件 |
| `tools/local-realtime-voice-echo-test.py` | 检查短句追问不会被当成回声丢掉。 | 同一文件 |
| `product-delta/` | 页面仓库和业务仓库里还没提交的本地改动。不是两套完整产品代码。 | `product-delta/README.md` |

## 本地 Kubernetes 里有什么

这些文件都在 `tools/mindy-local-k8s/manifests/`。

| 文件 | 作用 |
|---|---|
| `namespace.yaml` | 命名空间 `mindy`。下面的服务都在这里。 |
| `nginx.yaml` | 加密入口。手机只访问它。它提供页面，并把登录、文章、聊天转到业务服务；临时音频链接在这里校验后再去取文件。 |
| `engine.yaml` | 业务服务。只监听本机，不直接对手机开放。登录、听读、聊天和听记都从这里进入。 |
| `mysql.yaml` | 账号、文章、聊天记录和听记状态。 |
| `redis.yaml` | 临时状态。 |
| `seaweedfs.yaml` | 音频文件。手机不能直接访问它，要经过入口上的临时链接。 |

## 本地语音怎么分成三段

`tools/local-realtime-voice.py` 不是云端语音，是本机的替身：

1. Whisper Small 负责把话说成文字。
2. Qwen2.5 3B 负责写一两句回答。
3. macOS 自带的 `say` 负责读出来。中文是 Tingting，英文是 Samantha。

说完一句后大约等 1.4 秒才开始识别，避免换气时把长句子切断。模型权重留在这台 Mac 上，没有放进仓库。

## 页面和业务的本地改动

完整的页面仓库和业务仓库不在这里，基线都是各自远程上的 `feature/english-version`。`product-delta/` 只放这台 Mac 上还没提交的改动：

- `product-delta/lightread-app/`：手机听读地址、外壳麦克风，以及播放后的回声等待。
- `product-delta/ai-content-engine/`：本地听读音频的临时链接，以及会话长文本字段。

这些文件不要直接合并进 `feature/english-version`。

## 没有放进仓库的东西

私钥、备份密钥、加密备份、模型权重、JDK、Node、MySQL 安装包和手机编译产物留在这台 Mac 上。清单里的数据库口令只用于这个本地测试库，不是线上口令。
