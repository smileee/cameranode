/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // No special externals needed now that we use ffmpeg-static
    
    // Exclude fsevents from being bundled by Webpack
    if (!isServer) {
      config.externals.push('fsevents');
    }

    // This is the correct way to handle .node files in a Next.js project.
    // It tells Webpack to use the 'node-loader' for any .node files.
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
  // Allow custom server
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig; 