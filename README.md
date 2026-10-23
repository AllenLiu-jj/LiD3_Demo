# LiD3_Demo


**LiD3 — Real2Sim Spatial Data Engine for Physical AI**

本仓库用于管理 LiD3 团队的各类技术 Demo，包括：

- 3D 场景重建（3D Reconstruction）
- 4D 动态场景重建（4D Reconstruction）
- 语义分割与物体追踪（Semantic Segmentation & Tracking）
- 空间数据融合（Spatial Data Fusion）
- 动作重建与状态变化（Action Reconstruction & State Transition）
- Physical AI 多层数据可视化

我们希望将真实世界的视觉与空间数据，逐步转化为具有几何、语义、空间关系和动作状态信息的结构化数据，为 Physical AI 的训练、仿真与评测提供基础。

本仓库主要用于技术探索、开源项目复现、实验验证和 Demo 集成。

欢迎团队成员添加、修改和完善各类 Demo。

---

## 1. Project Overview

LiD3 聚焦复杂真实场景中的空间智能数据处理。

整体技术路线：

```text
Real World
    │
    ▼
Multi-view / Multimodal Capture
    │
    ▼
3D / 4D Reconstruction
    │
    ▼
Semantic Understanding
    │
    ▼
Spatial Data Fusion
    │
    ▼
Action & State Reconstruction
    │
    ▼
Structured Physical AI Data
```

我们重点关注四层时空数据：

| Layer | 数据层 | 主要内容 |
|---|---|---|
| L1 | 4D Visual | RGB-D、Point Cloud、3DGS、Geometry、Time |
| L2 | Semantic | Object、Instance Segmentation、Persistent ID |
| L3 | Spatial | 3D Position、Pose、Trajectory、Spatial Relations |
| L4 | Action & State | Interaction、Action、State Transition |

四层数据共享统一的世界坐标系、时间轴和对象身份，逐步形成完整的 Physical AI Episode。

---

## 2. Demo List

本仓库采用模块化结构，每个 Demo 可以独立运行。

| Demo | Layer | Description | Status |
|---|---|---|---|
| [Garden 3DGS](demos/l1_garden_3dgs/) | L1 | 真实场景的 Gaussian Splatting 重建与网页可视化 | Available |
| [actor1_4 4D-GS + SAM3](demos/l1_actor1_4_4dgs_sam3/) | L1 / L2 / 二维关系 | 200 帧大幅移动视角视频、实体轮廓与二维关系候选 | Available |
| [cutting_steak 4DGS](demos/l1_cutting_steak_4dgs/) | L1 | 切烤肉场景的连续时间 4D Gaussian 交互查看器 | Available |
| Semantic Segmentation | L2 | 物体识别、语义分割与跨帧追踪 | Planned |
| Spatial Fusion | L3 | 多视角数据对齐、3D 物体定位与空间融合 | Planned |
| Action Reconstruction | L4 | 对象轨迹、交互事件及状态变化重建 | Planned |
| Dynamic 4D Reconstruction | L1 / L4 | 动态对象与时空场景重建 | Planned |

> Demo 状态会随着项目进展持续更新。Garden 模块当前为静态 3DGS 重建，不包含完整动态 4D 重建。

---

## 3. Repository Structure

推荐采用以下目录结构：

```text
LiD3_Demo/
│
├── README.md
│
├── demos/
│   │
│   ├── l1_garden_3dgs/
│   │   ├── README.md
│   │   ├── serve.py
│   │   ├── viewer/
│   │   ├── outputs/
│   │   └── licenses/
│   │
│   ├── l2_semantic/
│   │
│   ├── l3_spatial_fusion/
│   │
│   └── l4_action/
│
└── ...
```

以上为推荐结构，未创建的 Demo 目录不需要提前建立。

每个 Demo 应尽可能保持独立，便于开发、调试和复现。

---

## 4. Current Demo: Garden 3D Gaussian Splatting

### 4.1 Introduction

Garden 3DGS 是 LiD3 的第一层视觉重建 Demo，作为demo样例。

基于公开的 **Mip-NeRF 360 Garden Dataset**，使用 Gaussian Splatting 完成真实场景重建，并通过 Three.js + Spark 实现浏览器端交互展示。

当前实现包括：

- 多视角真实场景重建
- 3D Gaussian Splatting
- 自由视角浏览
- 场景旋转、平移与缩放
- 原始图像与重建结果展示
- 浏览器端 3D 可视化

### 4.2 Technical Stack

| Component | Technology |
|---|---|
| Dataset | Mip-NeRF 360 Garden |
| Reconstruction | 3D Gaussian Splatting |
| Training | Brush |
| Rendering | Spark |
| Web Viewer | Three.js |
| Model Format | SPZ |
| Local Server | Python |

### 4.3 Quick Start

进入项目根目录后运行：

```bash
python demos/l1_garden_3dgs/serve.py
```

也可以选择不自动打开浏览器：

```bash
python demos/l1_garden_3dgs/serve.py --no-browser
```

具体安装要求、运行方式和文件说明，请查看：

[Garden Demo README](demos/l1_garden_3dgs/README.md)

### 4.4 Current Limitations

当前 Garden Demo 主要验证静态 3D 场景重建与可视化。

尚未包括：

- 动态 4D Gaussian Reconstruction
- 物体级语义标注
- 真实运动轨迹重建
- Action Recognition
- State Transition

这些能力将在后续 Demo 中逐步探索和集成。

---

## 5. Adding a New Demo

欢迎团队成员在仓库中添加新的技术实验。

### Step 1: Create a Directory

在对应层加入代码库和demo展示

例如：

```text
l2_object_segmentation/
```

### Step 2: Add Source Code

建议包含：

```text
demo_name/
├── README.md
├── src/
├── configs/
├── scripts/
├── assets/
└── outputs/
```

根据实际项目情况调整，不要求完全一致。

### Step 3: Write a README

每个 Demo 最好有独立的 README，至少说明：

1. Demo 的目标与功能
2. 使用的开源技术及参考链接
3. 输入数据与数据来源
4. 环境与依赖
5. 安装和运行命令
6. 输出结果
7. 已完成能力与当前限制

### Step 4: Update Main README

在本文件的 `Demo List` 中增加对应条目。

### Step 5: Submit Changes

推荐通过 Git Branch 和 Pull Request 协作，也可以根据仓库维护规则直接提交。

---

## 6. Development Guidelines

### Modularity

每个 Demo 尽量保持独立。

不同研究项目可以使用各自的 Python 环境、依赖和模型，不要求强行使用统一技术栈。

### Reproducibility

尽量提供：

- 运行代码
- 环境依赖
- 模型配置
- 数据来源
- 运行说明
- 示例结果

### Data Management

不要上传无关的缓存、虚拟环境或大型临时文件。

大型模型和数据集可以考虑：

- Git LFS
- GitHub Releases
- 外部数据存储
- 下载脚本

### Data Integrity

必须区分：

- 真实采集数据
- 公开数据集
- 重建数据
- 仿真数据
- 模型推断
- 人工标注
- 模拟或可
