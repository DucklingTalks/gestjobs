/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PDF/DOCX text extraction libraries load their own workers and use
  // import.meta; run them from node_modules instead of bundling them.
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    serverActions: {
      // The action enforces a 10 MB file limit; this allows multipart overhead.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;