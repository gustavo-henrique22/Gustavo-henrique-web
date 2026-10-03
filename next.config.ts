import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Comprovantes e logos do Recebi são enviados por server actions (até 5 MB).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
