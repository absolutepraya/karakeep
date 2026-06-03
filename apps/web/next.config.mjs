import bundleAnalyzer from "@next/bundle-analyzer";
import { execSync } from "node:child_process";

// Fork versioning: surface the git commit as SERVER_VERSION so the sidebar
// shows the build you're running. Docker builds set SERVER_VERSION via a build
// arg; locally we derive it from git (no-op when git isn't available).
if (!process.env.SERVER_VERSION) {
  try {
    process.env.SERVER_VERSION = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // No git in this environment (e.g. inside the Docker build); keep whatever
    // SERVER_VERSION the build arg provided.
  }
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  async headers() {
    return [
      {
        // Routes this applies to
        source: "/api/(.*)",
        // Headers
        headers: [
          // Allow for specific domains to have access or * for all
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          // Allows for specific methods accepted
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          // Allows for specific headers accepted (These are a few standard ones)
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },

  // transpilePackages: ["@karakeep/shared", "@karakeep/db", "@karakeep/trpc"],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },

  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(","),
};

export default withBundleAnalyzer(nextConfig);
