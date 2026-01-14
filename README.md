# ONE Engine

Unified backend API and SDK for the ONE ecosystem. A comprehensive infrastructure for building Web3 applications with wallet management, trading, payments, and more.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                   │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ ONE Wallet  │  │  Web Dashboard  │  │      Ecosystem Apps         │  │
│  │ (Mobile)    │  │    (React)      │  │   (Using ONE Engine SDK)    │  │
│  └─────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway (Next.js)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    /api/v1/* Endpoints                              ││
│  │  • /auth     • /wallet    • /assets   • /swap     • /contracts     ││
│  │  • /fiat     • /payments  • /bills    • /quant    • /trading       ││
│  │  • /webhooks • /projects  • /admin    • /health                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  Auth Layer   │        │  Core Services  │        │  Trading Layer  │
│ ┌───────────┐ │        │ ┌─────────────┐ │        │ ┌─────────────┐ │
│ │ Supabase  │ │        │ │   Wallet    │ │        │ │   Bybit     │ │
│ │   Auth    │ │        │ │   Asset     │ │        │ │   (CCXT)    │ │
│ └───────────┘ │        │ │   Swap      │ │        │ └─────────────┘ │
│ ┌───────────┐ │        │ │   Contract  │ │        │ ┌─────────────┐ │
│ │ Thirdweb  │ │        │ │   Payment   │ │        │ │    Quant    │ │
│ │   Auth    │ │        │ │   Bills     │ │        │ │  Strategies │ │
│ └───────────┘ │        │ └─────────────┘ │        │ └─────────────┘ │
└───────────────┘        └─────────────────┘        └─────────────────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Blockchain Layer                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     Thirdweb SDK v5                                 ││
│  │  • Smart Wallets (EIP-4337)  • Universal Bridge  • Contract Deploy ││
│  │  • Multi-chain Support (200+ chains)  • Gas Sponsorship            ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Database (Supabase)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   users     │  │   wallets   │  │ transactions│  │  payments   │    │
│  │  projects   │  │  contracts  │  │   bills     │  │  webhooks   │    │
│  │ strategies  │  │  positions  │  │   orders    │  │    logs     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### Core Services
- **Auth Service** - Supabase Auth + Thirdweb wallet authentication
- **Wallet Service** - Smart Wallet management via Thirdweb (EIP-4337)
- **Asset Service** - Multi-chain balance tracking and portfolio management
- **Swap Service** - Cross-chain swaps via Thirdweb Universal Bridge
- **Contract Service** - Deploy, read, and write smart contracts
- **Fiat Service** - On/off ramp integration via Onramper
- **Payment Service** - QR payments and X402 protocol support
- **Bills Service** - Utility bill payment management

### Trading & Quant
- **Quant Service** - Strategy and position management
- **Trading Service** - Bybit API integration for CEX trading
- **AI Service** - OpenAI integration for trading signals

### Infrastructure
- **Webhook Service** - Event notifications with retry logic
- **Project Service** - Multi-tenant project management
- **Background Workers** - Cron jobs for automated tasks

## Quick Start

### Prerequisites
- Node.js >= 22.0.0
- Supabase account
- Thirdweb account

### Installation

```bash
# Clone the repository
cd one-engine

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Configure your environment variables
# See Environment Variables section below

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Thirdweb
THIRDWEB_CLIENT_ID=your-client-id
THIRDWEB_SECRET_KEY=your-secret-key

# Trading (Bybit)
BYBIT_API_KEY=your-api-key
BYBIT_API_SECRET=your-api-secret
BYBIT_TESTNET=true

# OpenAI
OPENAI_API_KEY=your-openai-key

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-encryption-key
```

## SDK Usage

### Installation

```bash
npm install @one-ecosystem/engine
```

### Basic Usage

```typescript
import { OneEngineClient } from '@one-ecosystem/engine';

const client = new OneEngineClient({
  baseUrl: 'https://api.one-engine.com',
  projectId: 'your-project-id',
  apiKey: 'pk_live_xxx',
});

// Authentication
const auth = await client.auth.loginWithOtp({ email: 'user@example.com' });
await client.auth.verifyOtp({ email: 'user@example.com', otp: '123456' });

// Get wallets
const { wallets } = await client.wallet.list();

// Get portfolio
const { portfolio } = await client.assets.getPortfolio();

// Get swap quote
const { quote } = await client.swap.getQuote({
  fromChainId: 1,
  toChainId: 137,
  fromTokenAddress: '0x...',
  toTokenAddress: '0x...',
  amount: '1000000000000000000',
});

// Create payment
const { payment } = await client.payments.create({
  type: 'qr',
  amount: 10.00,
  currency: 'USD',
});

// Trading
const { market } = await client.trading.getMarketData('BTCUSDT');
```

## API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/otp` | POST | Request OTP |
| `/api/v1/auth/otp/verify` | POST | Verify OTP |
| `/api/v1/auth/wallet` | POST | Wallet authentication |
| `/api/v1/auth/refresh` | POST | Refresh token |

### Wallet
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/wallet` | GET | List wallets |
| `/api/v1/wallet` | POST | Create wallet |
| `/api/v1/wallet/:id` | GET | Get wallet |

### Assets
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/assets` | GET | Get balances |
| `/api/v1/assets/portfolio` | GET | Get portfolio |

### Swap
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/swap/quote` | GET | Get swap quote |
| `/api/v1/swap/tokens` | GET | List supported tokens |

### Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/payments` | GET | List payments |
| `/api/v1/payments` | POST | Create payment |
| `/api/v1/payments/:id` | GET | Get payment |
| `/api/v1/payments/:id/verify` | POST | Verify payment |

### Bills
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/bills` | GET | List bills |
| `/api/v1/bills` | POST | Create bill |
| `/api/v1/bills/:id` | GET | Get bill |
| `/api/v1/bills/:id/pay` | POST | Pay bill |
| `/api/v1/bills/providers` | GET | List providers |
| `/api/v1/bills/categories` | GET | List categories |

### Quant
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/quant/strategies` | GET | List strategies |
| `/api/v1/quant/strategies/:id` | GET | Get strategy |
| `/api/v1/quant/positions` | GET | List positions |
| `/api/v1/quant/positions` | POST | Open position |
| `/api/v1/quant/positions/:id/close` | POST | Close position |

### Trading
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/trading/market` | GET | Get market data |
| `/api/v1/trading/orders` | GET | List orders |
| `/api/v1/trading/orders` | POST | Place order |

### Webhooks
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/webhooks` | GET | List webhooks |
| `/api/v1/webhooks` | POST | Create webhook |
| `/api/v1/webhooks/:id` | PATCH | Update webhook |
| `/api/v1/webhooks/:id` | DELETE | Delete webhook |
| `/api/v1/webhooks/:id/test` | POST | Test webhook |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/users` | GET | List users |
| `/api/v1/admin/projects` | GET | List projects |
| `/api/v1/admin/stats` | GET | Get statistics |

## Webhook Events

Subscribe to the following events:

- `user.created` - New user registered
- `user.updated` - User profile updated
- `wallet.created` - New wallet created
- `transaction.pending` - Transaction submitted
- `transaction.confirmed` - Transaction confirmed
- `transaction.failed` - Transaction failed
- `payment.created` - Payment request created
- `payment.paid` - Payment completed
- `payment.failed` - Payment failed
- `position.opened` - Trading position opened
- `position.closed` - Trading position closed
- `order.filled` - Trade order filled
- `strategy.signal` - AI strategy signal generated

## Development

### Project Structure

```
src/
├── app/
│   └── api/
│       ├── health/
│       └── v1/
│           ├── auth/
│           ├── wallet/
│           ├── assets/
│           ├── swap/
│           ├── contracts/
│           ├── fiat/
│           ├── payments/
│           ├── bills/
│           ├── quant/
│           ├── trading/
│           ├── webhooks/
│           ├── projects/
│           └── admin/
├── config/
├── database/
│   └── migrations/
├── lib/
├── middleware/
├── repositories/
├── sdk/
│   └── modules/
├── services/
├── types/
├── utils/
└── workers/
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm run db:migrate   # Run database migrations
```

## Supported Chains

ONE Engine supports 200+ EVM-compatible chains including:

- Ethereum (1)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Base (8453)
- BNB Chain (56)
- Avalanche (43114)
- And many more...

## Security

- JWT-based authentication
- Rate limiting per endpoint
- Request validation with Zod
- Row Level Security (RLS) in Supabase
- Encrypted sensitive data storage
- CORS protection

## License

MIT License - see LICENSE file for details.
