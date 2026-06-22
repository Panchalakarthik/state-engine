import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Required by Blade: styled-components SSR + stable class names
    styledComponents: true,
  },
};

export default nextConfig;
