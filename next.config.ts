import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  pageExtensions: ["ts", "tsx"],

  env: {
    NEXT_PUBLIC_VERSION: process.env.npm_package_version ?? "0.0.0",
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().split("T")[0],
  },

  async redirects() {
    return [
      {
        source: "/reset_password_active",
        destination: "/reset-password-active",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
