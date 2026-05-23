/** next.config.js */
const nextConfig = {
  output: 'export', // 이미 배포용 설정
  async rewrites() {
    return [
      {
        source: '/admin/:path*',   // 기존 middleware 처리하던 경로
        destination: '/api/proxy/:path*', // 실제 처리할 API route
      },
    ]
  },
}

module.exports = nextConfig