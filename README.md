# ID-Photo

免费在线生成证件照（自定义尺寸及背景颜色）。

纯浏览器端证件照制作工具：AI 抠图、换底色、多种尺寸预设、排版打印、文件大小控制。

**照片全程不离开浏览器**，无需服务端，无需注册登录。

**在线使用：[https://huozhiyan.github.io/ID-Photo/](https://huozhiyan.github.io/ID-Photo/)**

## 功能

- **AI 抠图**：基于 [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) 模型，浏览器端 ONNX 推理
- **防抠洞优化**：中值滤波去杂点 + 内部洞回填 + 背景浮斑清除，保护头发/面部/衣服细节
- **常用尺寸**：一寸、大一寸、小一寸、二寸、小二寸、大二寸、护照/签证，支持自定义 mm（10–100mm）
- **背景色**：白、红、蓝、深蓝、浅蓝、灰，支持自定义颜色与透明底
- **排版打印**：5/6/7 寸与 A4 相纸，横竖可选，裁切线，自动计算可排数量
- **文件大小控制**：JPG 导出可指定 KB 上限（如网报要求 ≤50KB），自动降画质/像素并报告实际参数
- **DPI 可选**：150 / 300 / 600
- **纯 ASCII 文件名**：规避网报系统对中文文件名的限制
- **隐私安全**：所有处理在浏览器完成，不上传任何数据；模型自托管，运行时零外网请求

## 技术栈

- Vue 3 + Vite
- @huggingface/transformers 3.8.1（ONNX Runtime WASM，单线程，无需 COOP/COEP 头）
- 模型（44MB）与 ORT WASM 运行时全部自托管进仓库

## 本地开发

```bash
# 安装依赖（postinstall 会自动拷贝 ORT wasm 到 public/ort/）
npm install

# 如果 public/models/ 下缺少模型文件（仓库已包含则跳过）：
# 中国大陆用户请加 --mirror 使用 hf-mirror.com
node scripts/download-model.mjs --mirror

# 启动开发服务器
npm run dev
```

## 部署到 GitHub Pages

本仓库已配置 GitHub Actions 自动部署（见 `.github/workflows/deploy.yml`）：

1. 推送到 `main` 分支
2. 进入仓库 **Settings → Pages → Source**，选择 **GitHub Actions**
3. Action 自动执行 `npm ci && npm run build`，把 `dist/` 部署到 Pages

部署完成后访问 `https://<username>.github.io/<repo>/`。

> Vite `base: './'` + 模型路径用 `document.baseURI` 拼接，子路径部署无需额外配置。

## 许可

- **代码**：[MIT](LICENSE)
- **AI 抠图模型**：[RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) 采用 **CC-BY-NC-SA 4.0** 许可，**仅限非商业用途**。本仓库捆绑了该模型的量化权重（`public/models/RMBG-1.4/`），请勿将本项目用于商业服务。
