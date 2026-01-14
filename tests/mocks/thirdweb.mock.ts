/**
 * Thirdweb Mock
 * Mock implementation for Thirdweb SDK
 */

import { vi } from 'vitest';

export const createThirdwebMock = () => {
  return {
    getContract: vi.fn((options: { client: any; chain: any; address: string }) => ({
      address: options.address,
      chain: options.chain,
    })),
    readContract: vi.fn(async (options: { contract: any; method: string; params: any[] }) => {
      const { method, params } = options;

      // Mock common ERC20 methods
      if (method === 'balanceOf') {
        return BigInt('1000000000000000000'); // 1 token
      }
      if (method === 'decimals') {
        return 18;
      }
      if (method === 'symbol') {
        return 'TEST';
      }
      if (method === 'name') {
        return 'Test Token';
      }
      if (method === 'totalSupply') {
        return BigInt('1000000000000000000000000');
      }
      if (method === 'allowance') {
        return BigInt('0');
      }

      return null;
    }),
    prepareContractCall: vi.fn((options: { contract: any; method: string; params: any[] }) => ({
      to: options.contract.address,
      data: '0x',
      value: BigInt(0),
    })),
    sendTransaction: vi.fn(async (options: { account: any; transaction: any }) => ({
      transactionHash: '0x' + '1'.repeat(64),
    })),
    waitForReceipt: vi.fn(async (options: { client: any; chain: any; transactionHash: string }) => ({
      status: 'success',
      blockNumber: BigInt(12345678),
      gasUsed: BigInt(21000),
    })),
    smartWallet: vi.fn((options: { chain: any; sponsorGas: boolean }) => ({
      chain: options.chain,
      sponsorGas: options.sponsorGas,
    })),
    privateKeyToAccount: vi.fn((options: { client: any; privateKey: string }) => ({
      address: '0x' + '1'.repeat(40),
      signMessage: vi.fn(async () => '0x' + '1'.repeat(130)),
      signTypedData: vi.fn(async () => '0x' + '1'.repeat(130)),
    })),
    Bridge: {
      Sell: {
        prepare: vi.fn(async () => ({
          steps: [],
          destinationAmount: '1000000000000000000',
          originAmount: '1000000000000000000',
        })),
        execute: vi.fn(async () => ({
          transactionHash: '0x' + '2'.repeat(64),
        })),
      },
      Buy: {
        prepare: vi.fn(async () => ({
          steps: [],
          destinationAmount: '1000000000000000000',
          originAmount: '1000000000000000000',
        })),
        execute: vi.fn(async () => ({
          transactionHash: '0x' + '3'.repeat(64),
        })),
      },
      routes: vi.fn(async () => [
        {
          originChainId: 1,
          destinationChainId: 137,
          originTokenAddress: '0x' + 'a'.repeat(40),
          destinationTokenAddress: '0x' + 'b'.repeat(40),
        },
      ]),
    },
    deployContract: vi.fn(async (options: { client: any; chain: any; account: any; bytecode: string; abi: any[] }) => ({
      address: '0x' + '4'.repeat(40),
      transactionHash: '0x' + '5'.repeat(64),
    })),
  };
};

export const mockChains = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://eth.llamarpc.com'] } },
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: { default: { http: ['https://polygon.llamarpc.com'] } },
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://arb1.arbitrum.io/rpc'] } },
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet.optimism.io'] } },
  },
  base: {
    id: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
  },
};

export type ThirdwebMock = ReturnType<typeof createThirdwebMock>;
