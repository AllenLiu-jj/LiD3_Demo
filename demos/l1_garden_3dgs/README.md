# Garden 3DGS · L1 视觉重建

静态 Garden 场景的 3D Gaussian Splatting 交互展示，属于 LiD3 第一层（L1 / 4D Visual）的静态 3D 子模块。支持自由视角、自动环绕、原片参考、画质切换和全屏；不代表已实现动态 4D、语义、追踪或动作理解。

## 数据与技术来源

- 公开数据：[Mip-NeRF 360 / Garden](https://jonbarron.info/mipnerf360/)，不是团队自行采集的数据；185 个拍摄视角。
- 下载镜像及来源声明见 [source.json](viewer/source.json)。
- 训练工具：[Brush](https://github.com/ArthurBrussee/brush)，随包记录版本 0.3.0。
- 方法：[3D Gaussian Splatting](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)。
- 浏览器渲染：[Three.js](https://threejs.org/) + [Spark](https://github.com/sparkjsdev/spark)，所需模块已随附。
- 模型为重建输出 SPZ；参考图片为公开数据原片，演示视频及对照图为随包展示产物。数据使用须遵守原始数据集条款；第三方模块许可证见 [licenses](licenses/)。

## 环境与运行

Python 3.10+（此次验证为 3.11.9），仅使用标准库，无需 pip/npm 安装。浏览器需支持 WebGL 2，并启用硬件加速，推荐新版 Chrome / Edge。仓库不包含 Python 运行环境。

在仓库根目录运行：

```bash
python demos/l1_garden_3dgs/serve.py
# 不自动打开浏览器
python demos/l1_garden_3dgs/serve.py --no-browser
```

macOS/Linux 可使用 python3。Windows 也可双击本目录的“打开Demo.cmd”（需 python 在 PATH 中）。

打开终端输出的本机地址；保留终端，Ctrl+C 结束服务。端口自动选择，只监听 127.0.0.1。不要直接双击 HTML，否则模型不能正常加载。

鼠标拖动环绕、滚轮缩放、右键平移。模型约 36 MiB，首次加载请等待；性能不足可切换“流畅”。仅看效果可直接播放 [环绕展示.mp4](环绕展示.mp4)，或查看 [原片与重建对照.jpg](原片与重建对照.jpg)。

## 文件与输出

- serve.py：本机 HTTP 服务与浏览器启动器。
- viewer/：网页、原片、相机参数、来源信息及 vendored 渲染模块。
- outputs/garden_gaussian/garden.spz：已有训练模型，可直接展示。
- outputs/garden_gaussian/status.json：随包训练状态与指标。
- 环绕展示.mp4、原片与重建对照.jpg：展示产物。
- licenses/：Three.js、Spark 的原始许可证。

## 已有记录与验证边界

随包 status.json 记录 30,000 步、1,357,652 个 Gaussian、161 个训练视角及 24 个检验视角，PSNR 27.221148、SSIM 0.8552858。这些是原包记录，本次入库未重新训练或独立复算指标，不能据此声称完成新实验。公开 COLMAP 标定使用完整数据，指标不应直接与严格隔离标定的测试协议比较。

本包提供已有模型的展示复现，不包含原始训练数据、训练脚本、完整配置和训练日志；完整训练复现仍需补充这些材料及精确版本/commit。远处树冠和边缘可能存在拉伸瑕疵，尚未实现动态 4D、物体语义、轨迹、动作和状态变化。浏览器渲染性能取决于显卡。
