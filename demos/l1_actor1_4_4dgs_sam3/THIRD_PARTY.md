# 上游与资产来源

本目录是项目编写的适配/导出代码；不包含上游源码、训练数据、模型权重或字体。安装脚本取回的各组件保持其各自许可证，不因本目录发布而改变授权。

| 组件 | 固定版本/来源 |
|---|---|
| [HUST 4D-GS](https://github.com/hustvl/4DGaussians) | `843d5ac636c37e4b611242287754f3d4ed150144` |
| depth-diff-gaussian-rasterization | `e49506654e8e11ed8a62d22bcb693e943fdecacf`，通过上游 submodule 获取 |
| simple-knn | `44f764299fa305faf6ec5ebd99939e0508331503`，通过上游 submodule 获取 |
| [SAM3](https://github.com/facebookresearch/sam3) | `7f473cfd983d5eb43040ff608f66bff0d7bdcb53` |
| [SAM3 官方 ModelScope](https://modelscope.cn/models/facebook/sam3) | revision `f8ee5d16d5c30d0e87b1d22cbd358ce97761df56` |
| [ENeRF-Outdoor](https://github.com/zju3dv/ENeRF/blob/master/docs/enerf_outdoor.md) | actor1_4，输入为配套 N200 精简包；原始包有更多帧，不能混用帧号 |

SAM3 `sam3.pt` SHA-256：

```text
9999e2341ceef5e136daa386eecb55cb414446a00ac2b55eb2dfd2f7c3cf8c9e
```

HUST 适配仅移除未使用的 open3d/tkinter 导入，并补 simple-knn 的 `<cfloat>` 头文件。训练/形变/光栅化数学实现及权重不修改。以上研究组件及资产的商业使用、再分发和其他权限应以其官方条款为准。
