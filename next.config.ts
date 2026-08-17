import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: "/events", destination: "/benefits", permanent: true },
    ];
  },
};

export default nextConfig;
