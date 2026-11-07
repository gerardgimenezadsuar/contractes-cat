import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Company pages are ISR-cached, so they can't read searchParams. The
      // `?name=` used for anonymised DNIs ("*** 0721 **") becomes a path segment.
      beforeFiles: [
        {
          source: "/empreses/:id",
          has: [{ type: "query", key: "name", value: "(?<name>.+)" }],
          destination: "/empreses/:id/nom/:name",
        },
      ],
    };
  },
};

export default nextConfig;
