import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    /**
     * 关闭 webpack 构建 worker，避免 Windows（尤其同步盘 / OneDrive 路径）上
     * "Collecting build traces" 阶段多进程并发写 .nft.json / manifest 引发 ENOENT。
     */
    webpackBuildWorker: false,
  },
  webpack: (config, { dev }) => {
    // 关闭生产构建的持久化 webpack 缓存。
    // OneDrive / 同步盘路径在构建结束前就会尝试上传 .pack 文件，与 finalizer
    // 竞争文件句柄，导致缓存截断或 ENOENT。dev 模式保留缓存不影响。
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
