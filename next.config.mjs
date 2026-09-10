/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // The action enforces a 10 MB file limit; this allows multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;