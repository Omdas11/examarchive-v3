/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // Required for static export
  },
  async headers() {
    return [
      {
        // /about is server-rendered per user (header shows login state), so
        // the browser cache must be private and short-lived — never shared.
        // 1 day: repeat visits load from the browser (0 server hits, 0 reads);
        // the header refreshes at most daily (hard-refresh to update sooner).
        source: "/about",
        headers: [
          { key: "Cache-Control", value: "private, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
