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
      // WavID cards print https://wavewarz.info/wavid/card/<audiusHandle>, and
      // the studio's scanner lives at /wavid/scan. Quan's studio build is a
      // static app that reads those routes from the URL hash, so send the real
      // paths there (temporary on purpose: swap for native pages later).
      { source: "/wavid/scan", destination: "/wavid-studio/index.html#/wavid/scan", permanent: false },
      { source: "/wavid/card/:handle", destination: "/wavid-studio/index.html#/wavid/card/:handle", permanent: false },
    ];
  },
};

export default nextConfig;
