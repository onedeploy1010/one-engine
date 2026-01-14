/**
 * Supabase Database Types
 * Complete database schema types for ONE Engine
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string | null;
          email: string | null;
          phone: string | null;
          wallet_address: string | null;
          smart_account_address: string | null;
          role: string;
          kyc_status: string;
          kyc_level: number;
          membership_tier: string;
          referral_code: string | null;
          referred_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_active_at: string | null;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          email?: string | null;
          phone?: string | null;
          wallet_address?: string | null;
          smart_account_address?: string | null;
          role?: string;
          kyc_status?: string;
          kyc_level?: number;
          membership_tier?: string;
          referral_code?: string | null;
          referred_by?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_active_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          slug: string;
          description: string | null;
          client_id: string;
          status: string;
          settings: Json;
          thirdweb_client_id: string | null;
          created_at: string;
          updated_at: string;
          // Legacy fields (for backward compatibility)
          owner_id?: string;
          api_key?: string;
          api_secret?: string | null;
          is_active?: boolean;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          slug: string;
          description?: string | null;
          client_id: string;
          status?: string;
          settings?: Json;
          thirdweb_client_id?: string | null;
          created_at?: string;
          updated_at?: string;
          // Legacy fields
          owner_id?: string;
          api_key?: string;
          api_secret?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          address: string;
          smart_account_address: string;
          wallet_type: string;
          chain_id: number;
          is_default: boolean;
          encrypted_key: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          address: string;
          smart_account_address: string;
          wallet_type?: string;
          chain_id?: number;
          is_default?: boolean;
          encrypted_key?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['wallets']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          wallet_id: string;
          chain_id: number;
          tx_hash: string | null;
          type: string;
          status: string;
          from_address: string;
          to_address: string;
          value: string;
          token_address: string | null;
          gas_used: string | null;
          gas_price: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_id: string;
          chain_id: number;
          tx_hash?: string | null;
          type: string;
          status?: string;
          from_address: string;
          to_address: string;
          value: string;
          token_address?: string | null;
          gas_used?: string | null;
          gas_price?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      contracts_registry: {
        Row: {
          id: string;
          project_id: string;
          address: string;
          chain_id: number;
          name: string;
          contract_type: string;
          abi: Json;
          bytecode: string | null;
          verified: boolean;
          deploy_tx_hash: string | null;
          deployer_address: string | null;
          constructor_args: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          address: string;
          chain_id: number;
          name: string;
          contract_type: string;
          abi: Json;
          bytecode?: string | null;
          verified?: boolean;
          deploy_tx_hash?: string | null;
          deployer_address?: string | null;
          constructor_args?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contracts_registry']['Insert']>;
      };
      fiat_transactions: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          type: string;
          fiat_currency: string;
          fiat_amount: number;
          crypto_currency: string;
          crypto_amount: string;
          status: string;
          provider: string;
          external_id: string | null;
          wallet_address: string;
          chain_id: number;
          metadata: Json;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          type: string;
          fiat_currency: string;
          fiat_amount: number;
          crypto_currency: string;
          crypto_amount: string;
          status?: string;
          provider: string;
          external_id?: string | null;
          wallet_address: string;
          chain_id: number;
          metadata?: Json;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['fiat_transactions']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string | null;
          recipient_id: string | null;
          project_id: string | null;
          merchant_id: string | null;
          payment_type: string;
          status: string;
          amount: string;
          currency: string;
          chain_id: number;
          token_address: string | null;
          from_address: string | null;
          to_address: string | null;
          tx_hash: string | null;
          qr_code: string | null;
          description: string | null;
          resource: string | null;
          expires_at: string | null;
          metadata: Json;
          created_at: string;
          paid_at: string | null;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          recipient_id?: string | null;
          project_id?: string | null;
          merchant_id?: string | null;
          payment_type: string;
          status?: string;
          amount: string;
          currency: string;
          chain_id: number;
          token_address?: string | null;
          from_address?: string | null;
          to_address?: string | null;
          tx_hash?: string | null;
          qr_code?: string | null;
          description?: string | null;
          resource?: string | null;
          expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          paid_at?: string | null;
          settled_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      bills: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          category: string;
          provider: string;
          account_number: string;
          amount: number;
          currency: string;
          due_date: string | null;
          status: string;
          tx_hash: string | null;
          paid_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          category: string;
          provider: string;
          account_number: string;
          amount: number;
          currency: string;
          due_date?: string | null;
          status?: string;
          tx_hash?: string | null;
          paid_at?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bills']['Insert']>;
      };
      quant_strategies: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          description: string | null;
          strategy_type: string;
          risk_level: string;
          min_investment: number;
          max_investment: number | null;
          expected_apy_min: number | null;
          expected_apy_max: number | null;
          lock_period_days: number;
          management_fee_rate: number;
          performance_fee_rate: number;
          is_active: boolean;
          is_public: boolean;
          total_aum: number;
          total_users: number;
          win_rate: number;
          max_drawdown: number;
          sharpe_ratio: number;
          parameters: Json;
          supported_pairs: string[];
          supported_chains: string[];
          supported_currencies: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          description?: string | null;
          strategy_type: string;
          risk_level: string;
          min_investment?: number;
          max_investment?: number | null;
          expected_apy_min?: number | null;
          expected_apy_max?: number | null;
          lock_period_days?: number;
          management_fee_rate?: number;
          performance_fee_rate?: number;
          is_active?: boolean;
          is_public?: boolean;
          total_aum?: number;
          total_users?: number;
          win_rate?: number;
          max_drawdown?: number;
          sharpe_ratio?: number;
          parameters?: Json;
          supported_pairs?: string[];
          supported_chains?: string[];
          supported_currencies?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quant_strategies']['Insert']>;
      };
      quant_positions: {
        Row: {
          id: string;
          user_id: string;
          strategy_id: string;
          status: string;
          invested_amount: number;
          current_value: number;
          pnl: number;
          pnl_percent: number;
          shares: number;
          entry_nav: number;
          exit_nav: number | null;
          entry_date: string;
          exit_date: string | null;
          lock_end_date: string | null;
          last_update: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          strategy_id: string;
          status?: string;
          invested_amount: number;
          current_value?: number;
          pnl?: number;
          pnl_percent?: number;
          shares?: number;
          entry_nav?: number;
          exit_nav?: number | null;
          entry_date?: string;
          exit_date?: string | null;
          lock_end_date?: string | null;
          last_update?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quant_positions']['Insert']>;
      };
      quant_daily_pnl: {
        Row: {
          id: string;
          position_id: string;
          strategy_id: string | null;
          date: string;
          opening_value: number;
          closing_value: number;
          daily_pnl: number;
          daily_pnl_percent: number;
          nav_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          strategy_id?: string | null;
          date: string;
          opening_value: number;
          closing_value: number;
          daily_pnl?: number;
          daily_pnl_percent?: number;
          nav_price?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quant_daily_pnl']['Insert']>;
      };
      nav_snapshots: {
        Row: {
          id: string;
          strategy_id: string;
          date: string;
          nav_price: number;
          daily_return: number;
          cumulative_return: number;
          total_aum: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          date: string;
          nav_price: number;
          daily_return?: number;
          cumulative_return?: number;
          total_aum?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['nav_snapshots']['Insert']>;
      };
      trade_orders: {
        Row: {
          id: string;
          position_id: string;
          strategy_id: string | null;
          exchange: string;
          symbol: string;
          side: string;
          order_type: string;
          quantity: number;
          price: number | null;
          stop_price: number | null;
          status: string;
          external_id: string | null;
          filled_qty: number | null;
          avg_price: number | null;
          fee: number | null;
          fee_currency: string | null;
          created_at: string;
          filled_at: string | null;
        };
        Insert: {
          id?: string;
          position_id: string;
          strategy_id?: string | null;
          exchange?: string;
          symbol: string;
          side: string;
          order_type?: string;
          quantity: number;
          price?: number | null;
          stop_price?: number | null;
          status?: string;
          external_id?: string | null;
          filled_qty?: number | null;
          avg_price?: number | null;
          fee?: number | null;
          fee_currency?: string | null;
          created_at?: string;
          filled_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['trade_orders']['Insert']>;
      };
      webhooks: {
        Row: {
          id: string;
          project_id: string;
          url: string;
          events: string[];
          secret: string | null;
          is_active: boolean;
          last_triggered_at: string | null;
          failure_count: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          url: string;
          events: string[];
          secret?: string | null;
          is_active?: boolean;
          last_triggered_at?: string | null;
          failure_count?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['webhooks']['Insert']>;
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event: string;
          payload: Json;
          status: string;
          status_code: number | null;
          response_time: number | null;
          error: string | null;
          attempts: number;
          next_retry_at: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          event: string;
          payload: Json;
          status?: string;
          status_code?: number | null;
          response_time?: number | null;
          error?: string | null;
          attempts?: number;
          next_retry_at?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['webhook_deliveries']['Insert']>;
      };
      system_logs: {
        Row: {
          id: string;
          level: string;
          service: string;
          message: string;
          data: Json | null;
          user_id: string | null;
          project_id: string | null;
          request_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: string;
          service: string;
          message: string;
          data?: Json | null;
          user_id?: string | null;
          project_id?: string | null;
          request_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['system_logs']['Insert']>;
      };
      rate_limits: {
        Row: {
          id: string;
          identifier: string;
          endpoint: string;
          count: number;
          window_start: string;
          window_end: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          endpoint: string;
          count?: number;
          window_start: string;
          window_end: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rate_limits']['Insert']>;
      };
      // Multi-tenant tables
      teams: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          billing_plan: string;
          billing_email: string | null;
          max_projects: number;
          max_api_calls_per_month: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          billing_plan?: string;
          billing_email?: string | null;
          max_projects?: number;
          max_api_calls_per_month?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string;
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: string;
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>;
      };
      project_api_keys: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          key_type: string;
          key_hash: string;
          key_prefix: string;
          allowed_domains: string[] | null;
          allowed_ips: string[] | null;
          permissions: Json;
          rate_limit_per_minute: number;
          last_used_at: string | null;
          total_requests: number;
          is_active: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          key_type: string;
          key_hash: string;
          key_prefix: string;
          allowed_domains?: string[] | null;
          allowed_ips?: string[] | null;
          permissions?: Json;
          rate_limit_per_minute?: number;
          last_used_at?: string | null;
          total_requests?: number;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_api_keys']['Insert']>;
      };
      project_users: {
        Row: {
          id: string;
          project_id: string;
          external_id: string | null;
          email: string | null;
          phone: string | null;
          auth_method: string | null;
          auth_provider_id: string | null;
          wallet_address: string | null;
          smart_account_address: string | null;
          thirdweb_user_id: string | null;
          thirdweb_wallet_id: string | null;
          metadata: Json;
          status: string;
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          external_id?: string | null;
          email?: string | null;
          phone?: string | null;
          auth_method?: string | null;
          auth_provider_id?: string | null;
          wallet_address?: string | null;
          smart_account_address?: string | null;
          thirdweb_user_id?: string | null;
          thirdweb_wallet_id?: string | null;
          metadata?: Json;
          status?: string;
          last_active_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_users']['Insert']>;
      };
      project_wallets: {
        Row: {
          id: string;
          project_id: string;
          project_user_id: string;
          address: string;
          wallet_type: string;
          chain_ids: number[];
          smart_account_config: Json | null;
          thirdweb_wallet_id: string | null;
          is_primary: boolean;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          project_user_id: string;
          address: string;
          wallet_type: string;
          chain_ids?: number[];
          smart_account_config?: Json | null;
          thirdweb_wallet_id?: string | null;
          is_primary?: boolean;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_wallets']['Insert']>;
      };
      project_backend_wallets: {
        Row: {
          id: string;
          project_id: string;
          label: string;
          address: string;
          key_type: string;
          key_id: string | null;
          encrypted_private_key: string | null;
          thirdweb_backend_wallet_id: string | null;
          nonce: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          label: string;
          address: string;
          key_type: string;
          key_id?: string | null;
          encrypted_private_key?: string | null;
          thirdweb_backend_wallet_id?: string | null;
          nonce?: number;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_backend_wallets']['Insert']>;
      };
      project_transactions: {
        Row: {
          id: string;
          project_id: string;
          from_address: string;
          backend_wallet_id: string | null;
          to_address: string;
          chain_id: number;
          data: string | null;
          value: string;
          gas_limit: string | null;
          max_fee_per_gas: string | null;
          max_priority_fee_per_gas: string | null;
          status: string;
          tx_hash: string | null;
          block_number: number | null;
          gas_used: string | null;
          error_message: string | null;
          retry_count: number;
          thirdweb_queue_id: string | null;
          metadata: Json;
          submitted_at: string | null;
          mined_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          from_address: string;
          backend_wallet_id?: string | null;
          to_address: string;
          chain_id: number;
          data?: string | null;
          value?: string;
          gas_limit?: string | null;
          max_fee_per_gas?: string | null;
          max_priority_fee_per_gas?: string | null;
          status?: string;
          tx_hash?: string | null;
          block_number?: number | null;
          gas_used?: string | null;
          error_message?: string | null;
          retry_count?: number;
          thirdweb_queue_id?: string | null;
          metadata?: Json;
          submitted_at?: string | null;
          mined_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_transactions']['Insert']>;
      };
      api_usage: {
        Row: {
          id: string;
          project_id: string;
          api_key_id: string | null;
          endpoint: string;
          method: string;
          status_code: number | null;
          response_time_ms: number | null;
          ip_address: string | null;
          user_agent: string | null;
          origin: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          api_key_id?: string | null;
          endpoint: string;
          method: string;
          status_code?: number | null;
          response_time_ms?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          origin?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['api_usage']['Insert']>;
      };
      project_contracts: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          address: string;
          chain_id: number;
          contract_type: string | null;
          abi: Json | null;
          deployer_address: string | null;
          deploy_tx_hash: string | null;
          deployed_at: string | null;
          thirdweb_contract_id: string | null;
          status: string;
          verified: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          address: string;
          chain_id: number;
          contract_type?: string | null;
          abi?: Json | null;
          deployer_address?: string | null;
          deploy_tx_hash?: string | null;
          deployed_at?: string | null;
          thirdweb_contract_id?: string | null;
          status?: string;
          verified?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_contracts']['Insert']>;
      };
      project_payments: {
        Row: {
          id: string;
          project_id: string;
          project_user_id: string | null;
          payment_type: string;
          fiat_amount: number | null;
          fiat_currency: string | null;
          crypto_amount: string | null;
          crypto_currency: string | null;
          chain_id: number | null;
          provider: string | null;
          provider_tx_id: string | null;
          status: string;
          destination_address: string | null;
          tx_hash: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          project_user_id?: string | null;
          payment_type: string;
          fiat_amount?: number | null;
          fiat_currency?: string | null;
          crypto_amount?: string | null;
          crypto_currency?: string | null;
          chain_id?: number | null;
          provider?: string | null;
          provider_tx_id?: string | null;
          status?: string;
          destination_address?: string | null;
          tx_hash?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_payments']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: 'user' | 'admin';
      kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
      membership_tier: 'free' | 'basic' | 'plus' | 'premium' | 'enterprise';
      wallet_type: 'eoa' | 'smart' | 'custodial';
      transaction_status: 'pending' | 'submitted' | 'confirmed' | 'failed';
      transaction_type: 'transfer' | 'swap' | 'bridge' | 'contract_call' | 'deploy';
      contract_type: 'erc20' | 'erc721' | 'erc1155' | 'custom';
      fiat_status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
      payment_type: 'qr' | 'x402' | 'invoice' | 'recurring';
      payment_status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired' | 'refunded';
      bill_category: 'electricity' | 'water' | 'gas' | 'internet' | 'phone' | 'cable' | 'insurance' | 'subscription' | 'other';
      bill_status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
      strategy_type: 'momentum' | 'arbitrage' | 'grid' | 'dca' | 'trend_following' | 'mean_reversion' | 'hft' | 'custom';
      risk_level: 'conservative' | 'moderate' | 'aggressive' | 'high_risk';
      position_status: 'pending' | 'active' | 'paused' | 'closing' | 'closed' | 'liquidated';
      order_status: 'pending' | 'open' | 'partial' | 'filled' | 'cancelled' | 'failed';
      webhook_event: 'user.created' | 'user.updated' | 'wallet.created' | 'transaction.pending' | 'transaction.confirmed' | 'transaction.failed' | 'payment.created' | 'payment.paid' | 'payment.failed' | 'position.opened' | 'position.closed' | 'order.filled' | 'strategy.signal';
      delivery_status: 'pending' | 'success' | 'failed';
    };
  };
}

// Helper types for Supabase queries
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
