import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent the app from being embedded in iframes on other origins (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop browsers from MIME-sniffing responses away from the declared content-type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send full referrer within the same origin; only the origin on cross-origin requests.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict which browser features this site can use or grant to third parties.
  // Geolocation is self-only (the map view uses it); camera and microphone are blocked.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl", "react-map-gl"],
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
