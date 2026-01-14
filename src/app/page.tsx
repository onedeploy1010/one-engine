export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ONE Engine API</h1>
      <p>Unified backend engine for the ONE ecosystem</p>
      <hr style={{ margin: '1rem 0' }} />
      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>POST /api/v1/auth/otp</code> - Send OTP</li>
        <li><code>POST /api/v1/auth/otp/verify</code> - Verify OTP</li>
        <li><code>POST /api/v1/auth/wallet</code> - Wallet auth</li>
        <li><code>GET /api/v1/wallet</code> - Get wallets</li>
        <li><code>POST /api/v1/wallet</code> - Create wallet</li>
        <li><code>GET /api/v1/assets</code> - Get balances</li>
        <li><code>GET /api/v1/assets/portfolio</code> - Get portfolio</li>
        <li><code>POST /api/v1/swap/quote</code> - Get swap quote</li>
        <li><code>GET /api/v1/contracts</code> - Get contracts</li>
        <li><code>POST /api/v1/contracts/read</code> - Read contract</li>
        <li><code>POST /api/v1/fiat/onramp</code> - Create onramp session</li>
        <li><code>POST /api/v1/payments</code> - Create payment</li>
        <li><code>GET /api/v1/quant/strategies</code> - Get strategies</li>
        <li><code>POST /api/v1/quant/positions</code> - Open position</li>
      </ul>
      <hr style={{ margin: '1rem 0' }} />
      <p>
        <a href="https://docs.one.eco" target="_blank" rel="noopener noreferrer">
          Documentation
        </a>
      </p>
    </main>
  );
}
