# actor1_4：4D-GS + SAM3 移动视角视频

使用 **HUST 4D-GS 的已训练 actor1_4 N200 模型**，生成约 65° 横移、推近再拉远的视频；对每张渲染图片运行 SAM3，绘制实体轮廓与二维关系候选。

- 完整使用源状态 `0..199` 各一次：**200 帧、8 秒、1280×720、25 FPS 播放**。
- 同时输出纯画面版、轮廓关系版和可下载的静态预览页。
- 实体只描边，不填充。没有检出的实体不补造标注。

```text
已训练 4D-GS + 相机参数 → 移动视角 RGB → SAM3 → 轮廓/二维关系 → MP4 + 逐帧 JSON
```

## 1. 环境

所有渲染、安装、测试和编码在 **Linux NVIDIA GPU 服务器**运行。本机可保存代码、资产和成品。

已验证环境：Python 3.12、PyTorch 2.8 / CUDA 12.8、RTX PRO 6000 Blackwell、PyAV 19。需要可编译 CUDA 扩展的 `nvcc`，显存需求应在目标机器实测。

```bash
cd demos/l1_actor1_4_4dgs_sam3
python3.12 -m venv --system-site-packages .venv
source .venv/bin/activate
python -m pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
python -m pip install -e '.[dev]'
bash scripts/setup_upstreams.sh
```

`setup_upstreams.sh` 固定上游提交，编译 rasterizer / simple-knn，仅修正缺少的 `<cfloat>` 和两处未使用的可选导入。依赖与模型来源见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 2. 准备输入

### 已训练的 N200 资产

模型和数据不随源代码提交。团队已有的 `delivery-semantic-200.tar.gz` 解压后包含：

```text
delivery/
├── model-200/             # model.json、PLY、三份完整 deformation 资产
├── dataset-200.json       # 已去畸变/对齐的相机、帧号、场景边界及输入身份
└── semantics-200/         # manifest.json、labels.npy；仅作人物身份匹配参考
```

从该目录导入可搬运的推理资产，无需原训练图片，也无需修改清单内的历史绝对路径：

```bash
python scripts/prepare_assets.py --source /path/to/delivery --output assets
```

也支持 `--source /path/to/cloud4d-4dgs`，读取现有服务器的 `trained-v2-200` 和 `data-200`。脚本检查模型、形变、数据清单与语义标签的哈希后复制，拒绝覆盖非空目录。

清单必须含 `frameIds=0..199`、`cameraId=14` 的内参、`worldUp=[0,0,1]` 和场景 `bounds`；保留原清单内容以通过模型身份校验。

这是本项目已训练的 **HUST 4D-GS** 资产；官方 **4K4D NPZ** 采用另一种表示，不能替代这里的 PLY / deformation 模型。重新训练请参考 [HUST 4D-GS](https://github.com/hustvl/4DGaussians)；本目录的入口从已训练结果开始。

### SAM3 与中文字体

```bash
python scripts/fetch_sam3.py --output assets/sam3.pt
```

该脚本从固定的官方 ModelScope `facebook/sam3` revision 获取约 3.45 GB 权重，SHA-256 通过后才更名。也可放入已合法取得、哈希一致的 `sam3.pt`。如上游渠道需要许可或认证，请按其官方流程办理，勿将令牌提交到仓库。

准备支持中文的字体，例如安装 `fonts-noto-cjk` 后使用 `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`。字体文件不随仓库分发。

## 3. 导出视频

```bash
actor-video \
  --model assets/model/model.json \
  --dataset assets/dataset.json \
  --labels assets/semantics/manifest.json \
  --upstream vendor/4dgs \
  --sam3-source vendor/sam3 \
  --sam3-checkpoint assets/sam3.pt \
  --font /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc \
  --output outputs/wide-200
```

未安装命令入口时可用 `python -m actor_demo.export`，参数相同。可用 `--config` 更换文本提示与类别配置，`--fps` 设置播放速度。默认配置为人物、西瓜道具、熊猫玩偶、地面、墙面，SAM3 confidence 为 0.5。

输出：

| 文件 | 内容 |
|---|---|
| `actor1_4-wide-200.mp4` | 纯画面 |
| `actor1_4-wide-200-semantic.mp4` | 实体轮廓、名称及关系候选 |
| `annotations.jsonl.gz` | 逐帧源状态、相机、图像哈希、轮廓、关系及证据 |
| `report.json` | 帧数、模型/视频哈希、检出覆盖和关系计数 |
| `index.html` / `contact-sheet.jpg` | 视频预览与六个镜头位置 |

导出器完整解码核对两个 MP4 的帧数和尺寸后才发布正式文件名。

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory outputs/wide-200
# 经自己的 SSH 转发访问预览页；也可直接取回 MP4。
```

## 4. 模块与验证

`src/actor_demo/` 中，`camera.py` 生成轨迹，`renderer.py` 校验/渲染模型，`segmenter.py` 调用官方 SAM3，`predictions.py` 匹配人物参考身份，`relations.py` 推断二维候选，`drawing.py` 描边，`export.py` 组织导出。辅助资产检查在 `assets.py`，高斯身份参考光栅化在 `raster.py`。

```bash
python -m pytest -q
```

回归覆盖完整时间轴、刚体相机、模型/数据错配、权重损坏、无证据不输出关系及无法关联人物时使用视角内 ID。GPU 验收使用完整 200 帧导出，不以单元测试替代真实渲染。

## 5. 结果含义与边界

- SAM3 对**二维渲染图片**分割。语义高斯仅辅助 A/B 匹配，无法保证跨视角、跨时间的物理实体身份；无法匹配的人物使用 `person-view-*`。
- `holding_candidate_2d` 是人物与物体的“持有候选”；`lower_boundary_near_ground_2d` 是人物下缘与地面的二维邻接。二者均不证明三维接触。
- 没有识别人物自身动作，也没有运行 ConceptGraphs。检出覆盖不是准确率，置信分数不是经过校准的正确概率。
- 25 FPS 是播放设置；轨迹约 ±32.5°，半径 5.35→4.49→5.35 为场景坐标单位。它不证明完整场地的 360° 重建质量，模型模糊和 SAM3 漏检会保留。

本 Demo 复用公开 ENeRF-Outdoor 的 actor1_4 场景。本仓库不重新授权第三方数据、权重和代码；使用前遵守各自条款。项目运行问题持续记录于工作空间统一的 `docs/RELATION_ISSUES.md`，不在这里复制私人运行日志。

本目录已在独立服务器目录及 Python 环境完成资产导入、6 项回归和完整 200 帧导出。两段 MP4 的 SHA-256 与已交付视频完全一致，验收摘要见 [configs/verified-result.json](configs/verified-result.json)。此次验证只读复用已有通用依赖与固定上游源码，没有重新训练。
