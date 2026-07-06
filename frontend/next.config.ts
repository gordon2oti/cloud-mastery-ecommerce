import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: [
      "loremflickr.com",
      "placehold.co",
      "storage.cloud.google.com",
      "storage.googleapis.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.cloud.google.com",
        pathname: "/cloud_mastery_images/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/cloud_mastery_images/**",
      },
      { hostname: "loremflickr.com" },
      { hostname: "placehold.co" },
      { hostname: "images.unsplash.com" },
      { hostname: "storage.cloud.google.com" },
      { hostname: "storage.googleapis.com" },
      { hostname: "gstatic.com" },
    ],
  },
};

export default nextConfig;
