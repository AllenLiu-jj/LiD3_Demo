# LiD3 Demo

LiD3 的 Demo 与技术实验仓库，用于集中管理 **3D 场景重建、语义分割、空间数据融合、动态场景/4D 重建以及交互与状态变化** 等可运行成果。

当前主要目标是验证：真实场景数据能否从视觉观测逐步转化为带有几何、语义、空间关系和动作状态的结构化数据。本仓库以 **独立、可复现的 Demo** 为基本组织单位；不是已经完成的端到端 Physical AI 产品。

## Demo 索引

| 模块 | Demo | 内容 | 状态 | 入口 |
| --- | --- | --- | --- | --- |
| L1 · 视觉 / 3D 重建 | Garden 3DGS | 公开 Garden 多视角数据 → Gaussian Splatting → 网页浏览 | 已有独立运行版本；待按仓库结构合并 | [查看说明](demos/l1_garden_3dgs/README.md) |
| L2 · 语义 | — | 物体识别、分割和跨帧 ID | 规划中 | — |
| L3 · 空间关系 / Fusion | — | 3D 对象定位、多视角配准、轨迹和关系 | 规划中 | — |
| L4 · Action / State | — | 交互过程、运动证据、前后状态变化 | 规划中 | — |

> **说明**：仅在 `demos/l1_garden_3dgs/` 集成包合并后，以上 Garden 相对链接才会生效。其他模块未完成前不添加空链接。

## 项目结构

推荐按以下形式组织新 Demo。**每个 Demo 独立运行、独立说明，不要求所有模块共用同一套依赖环境**。

```text
LiD3_Demo/
├── README.md                     # 仓库入口和 Demo 索引
├── demos/
│   ├── l1_garden_3dgs/           # Garden：静态 3D Gaussian Splatting
│   │   ├── README.md
│   │   ├── viewer/
│   │   ├── outputs/
│   │   └── serve.py
│   ├── l2_<demo_name>/           # 未来：物体语义
│   ├── l3_<demo_name>/           # 未来：空间关系 / Fusion
│   └── l4_<demo_name>/           # 未来：Action / State
└── ...
```

以上是**推荐目录**，不是对当前远端仓库完整目录的声明。现有主界面代码可保留原位置；增加模块时尽量不改动无关文件。

## 快速开始：Garden 3DGS

集成 Garden 模块后，在仓库根目录执行：

```bash
python demos/l1_garden_3dgs/serve.py
```

如不需要自动打开浏览器：

```bash
python demos/l1_garden_3dgs/serve.py --no-browser
```

具体运行环境、训练来源和资源说明见 [Garden 模块 README](demos/l1_garden_3dgs/README.md)。

Garden 使用 **Mip-NeRF 360 公开数据集**，当前成果是静态 3DGS 场景重建与浏览器可视化；不应称为团队自采户外数据、动态 4D 重建或 Action 识别。

## 如何添加一个新 Demo

1. 在 `demos/` 下新建独立目录，例如 `demos/l2_object_segmentation/`。
2. 放入运行代码、必要配置和示例资源；避免直接复制完整虚拟环境或缓存。
3. 新建该模块的 `README.md`，说明用途、数据来源、安装方式、运行命令、预期输出、当前限制。
4. 核对第三方代码、模型权重和数据集的授权；大型文件尽量使用 Git LFS 或可复现下载方式。
5. 本地验证可运行后，在本页「Demo 索引」增加一行，状态如实标为 `可运行 / 开发中 / 规划中`。
6. 通过 Pull Request 提交，写明改动和验证结果，尽量不影响其他 Demo。

### 新 Demo README 最小模板

```markdown
# <Demo 名称>

## 目标
用一两句话说明这个 Demo 验证什么技术能力。

## 数据
- 来源及使用许可：
- 输入格式：
- 是否自采 / 公开数据：

## 技术栈
- 核心开源项目与链接：
- 自研部分：

## 运行
```bash
# 安装与运行命令
```

## 输出
- 产物路径：
- 截图或演示链接：

## 当前状态与限制
哪些部分已经验证，哪些仍在计划中。
```

## 数据层级与集成原则

| 层级 | 关注的数据 |
| --- | --- |
| L1 · Visual / Geometry | 多视角图像、深度、点云、场景重建、时间索引 |
| L2 · Semantic | 对象类别、实例 Mask、跨帧对象 ID |
| L3 · Spatial / Fusion | 统一坐标系、3D 位置、轨迹、场景关系 |
| L4 · Action / Dynamics | Agent–Object 交互、事件时间段、状态变化 |

各 Demo 可以先独立发展。未来需要集成时，优先对齐 **坐标系、时间戳、对象 ID 和数据来源**，而不是过早把所有研究代码耦合成一个项目。

## 协作约定

- 每个模块至少有一名维护者，新增功能应更新模块 README。
- 代码、模型、示例数据和评测结果应注明来源；**真实输出与演示/手工示意内容要区分**。
- 尽可能保留可复现的处理脚本与配置；避免只上传录屏而没有运行说明。
- 欢迎新增实验、修复问题和改进展示，优先采用分支 + Pull Request 方式协作。

## 项目链接

主仓库：https://github.com/AllenLiu-jj/LiD3_Demo

项目处于持续迭代阶段，欢迎团队成员提交新的重建、语义、时空融合与动作理解 Demo。
