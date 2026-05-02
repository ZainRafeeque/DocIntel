/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // react-pdf uses the canvas package which we don't need to bundle on the server
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
