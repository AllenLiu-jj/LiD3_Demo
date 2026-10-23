# cutting_steak · 200k 4D Gaussian Splatting

切烤肉场景前 2 秒的连续时间高斯重建与网页交互展示，属于 LiD3 的 L1 视觉层。支持时间轴、播放、标定相机切换、原地转向、FOV 调整和 PNG 导出。

## 数据与技术来源

- **训练数据：[facebookresearch/Neural_3D_Video](https://github.com/facebookresearch/Neural_3D_Video)** 的公开 `cut_roasted_beef` 场景，本 Demo 命名为 `cutting_steak`。
- 原分辨率 **2704 × 2028**，前 2 秒，30 FPS；20 台同步相机，每台 60 帧，共 **1,200 帧**。
- 训练：PyTorch + [gsplat](https://github.com/nerfstudio-project/gsplat)，采用自定义多项式时变高斯表示。
- 展示：WebGL + [Three.js](https://threejs.org/)，模块已随附。许可证见 [Three.js](vendor/LICENSE-three.txt) 和 [Python](runtime/LICENSE.txt)；数据遵循原始数据集条款。

## 运行

浏览器需支持 WebGL 2，推荐启用硬件加速的 Edge / Chrome。模型约 91.5 MiB，首次加载请稍候。

**Windows 64 位：**双击本目录的 `打开4D查看器.cmd`。已附带 Python 3.12，无需安装 CUDA 或训练环境。

也可从仓库根目录运行：

```powershell
cd demos/l1_cutting_steak_4dgs
.\runtime\python.exe launch.py
```

**Linux / macOS：**使用系统 Python 3.10+，仅需标准库。

```bash
cd demos/l1_cutting_steak_4dgs
python3 serve.py --no-browser
```

打开终端输出的本机地址，Ctrl+C 结束服务。端口占用时可使用 `python3 serve.py --port 8767 --no-browser`。

拖动时间轴调整时间，空格播放/暂停，←/→ 逐帧。拖动画面原地转向；相机位置固定，可通过下拉菜单切换标定相机。时间轴覆盖 60 个采样，末帧为 `59/30 ≈ 1.967` 秒。

## 训练方式与规模

| 项目 | 设置 / 结果 |
|---|---|
| 训练步数 | **200,000 个优化步**，每步随机抽取一个相机帧 |
| 训练数据 | 20 台相机、1,200 帧全部参与训练，无独立测试视角 |
| 初始化 | 从随机初始化的 **100,000 个高斯**开始 |
| 最终高斯数量 | **249,780**，增密上限 250,000 |
| 训练分辨率 | **2704 × 2028**，原分辨率渲染 |
| 外观表示 | **SH 3 阶**，表达视角相关颜色 |
| 优化器 | Adam，学习率从 `0.001` 指数衰减至 `0.0001` |
| 损失函数 | `SmoothL1(RGB) + 0.2 × (1 − SSIM)`；SSIM 分支使用 4 倍平均池化 |
| 密度控制 | 基于位置梯度进行克隆、分裂与裁剪 |
| 最后 1,000 步平均 loss | 约 **0.003259**，为训练 loss |

高斯中心采用二次时间函数，尺度在对数空间随时间线性变化，旋转四元数随时间线性变化后归一化。不透明度与 SH 系数本身不随时间变化。通过 gsplat 渲染与多相机图像比较，联合优化高斯参数及数量。

模型位于 [assets/gaussians.bin](assets/gaussians.bin)，训练信息、时间映射和相机内外参见 [assets/model.json](assets/model.json)。本目录提供已训练模型的展示，不含训练数据及续训检查点。

## 当前限制

- 浏览器 WebGL 与训练端 gsplat 存在画质差异，精确评估需使用与训练一致的渲染器。
- 当前模型尚未分离静态背景和动态对象，遮挡区域、非刚体细节与未观测视角仍有局限。

## 后续技术路线

下一阶段目标是：**学习一组动态 3D Gaussians，解释已拍摄视频中的动态变化。**

1. 先建立静态 3D 场景重建，再学习动态对象的高斯变化；优先验证刚体，再研究非刚体变形。
2. 改善相机覆盖与多视角约束，重点处理遮挡区域，并与单纯增加训练步数的效果比较。

评估时将对齐展示端与训练端的渲染，并设置独立测试视角，区分表示能力、视角覆盖与渲染误差。以上为后续计划。
