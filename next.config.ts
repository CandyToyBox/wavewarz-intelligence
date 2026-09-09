import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // The API changelog page reads docs/API-CHANGELOG.md at request time — make
  // sure the file ships with the serverless bundle.
  outputFileTracingIncludes: {
    '/api-docs/changelog': ['./docs/API-CHANGELOG.md'],
  },
  async redirects() {
    return [
      { source: "/events", destination: "/benefits", permanent: true },
    ];
  },
};

export default nextConfig;
