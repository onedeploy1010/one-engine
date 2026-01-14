/**
 * Project Features Management
 * GET /api/v1/projects/:projectId/features - Get project features
 * PATCH /api/v1/projects/:projectId/features - Update features
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { projectService } from '@/services/project/project.service';
import { success, errors } from '@/lib/response';
import { requireAuth } from '@/middleware/auth';
import { validateBody } from '@/middleware/validation';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const AVAILABLE_FEATURES = [
  'wallet',
  'swap',
  'contracts',
  'fiat',
  'payments',
  'quant',
  'ai',
  'x402',
] as const;

/**
 * Get project features
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;

    const project = await projectService.getProject(projectId);

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to view this project');
    }

    // Return feature status and descriptions
    const features = {
      wallet: {
        enabled: project.settings.features.wallet ?? false,
        name: 'Wallet',
        description: 'Smart wallet creation and management',
        description_zh: '智能钱包创建和管理',
      },
      swap: {
        enabled: project.settings.features.swap ?? false,
        name: 'Token Swap',
        description: 'Cross-chain token swaps',
        description_zh: '跨链代币交换',
      },
      contracts: {
        enabled: project.settings.features.contracts ?? false,
        name: 'Smart Contracts',
        description: 'Contract deployment and interaction',
        description_zh: '智能合约部署和交互',
      },
      fiat: {
        enabled: project.settings.features.fiat ?? false,
        name: 'Fiat On/Off Ramp',
        description: 'Buy and sell crypto with fiat',
        description_zh: '法币买卖加密货币',
      },
      payments: {
        enabled: project.settings.features.payments ?? false,
        name: 'Payments',
        description: 'Bill payments and transfers',
        description_zh: '账单支付和转账',
      },
      quant: {
        enabled: project.settings.features.quant ?? false,
        name: 'Quant Trading',
        description: 'AI quantitative trading strategies',
        description_zh: 'AI量化交易策略',
      },
      ai: {
        enabled: project.settings.features.ai ?? false,
        name: 'AI Agents',
        description: 'AI-powered trading agents with configurable strategies',
        description_zh: 'AI智能交易代理和可配置策略',
      },
      x402: {
        enabled: project.settings.features.x402 ?? false,
        name: 'X402 Protocol',
        description: 'X402 payment protocol for web3 payments',
        description_zh: 'X402支付协议用于Web3支付',
      },
    };

    return success({
      features,
      availableFeatures: AVAILABLE_FEATURES,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return errors.internal('Failed to fetch features');
  }
}

const updateFeaturesSchema = z.object({
  wallet: z.boolean().optional(),
  swap: z.boolean().optional(),
  contracts: z.boolean().optional(),
  fiat: z.boolean().optional(),
  payments: z.boolean().optional(),
  quant: z.boolean().optional(),
  ai: z.boolean().optional(),
  x402: z.boolean().optional(),
});

/**
 * Update project features
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(req);
    const { projectId } = await params;
    const body = await validateBody(req, updateFeaturesSchema);

    const project = await projectService.getProject(projectId);

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.userId) {
      return errors.forbidden('Not authorized to update this project');
    }

    // Merge new features with existing
    const updatedFeatures = {
      ...project.settings.features,
      ...body,
    };

    const updatedProject = await projectService.updateProject(projectId, {
      settings: {
        ...project.settings,
        features: updatedFeatures,
      },
    });

    return success({
      project: updatedProject,
      message: 'Features updated successfully',
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }
    return errors.internal('Failed to update features');
  }
}
