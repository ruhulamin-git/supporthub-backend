import { Router, Request, Response } from 'express';
import { TicketModel } from '../models/ticket.model';
import { UserModel } from '../models/user.model';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(verifyToken);

/**
 * GET /api/dashboard/metrics
 * Get dashboard metrics tailored to the authenticated user's role
 */
router.get('/metrics', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required',
    });
  }

  try {
    const userRole = req.user.role;
    const userId = req.user.userId;

    // Filter tickets according to user role
    const filter: { customerId?: number; assignedAgentId?: number } = {};
    if (userRole === 'customer') {
      filter.customerId = userId;
    } else if (userRole === 'agent') {
      filter.assignedAgentId = userId;
    }
    // For admin, filter remains empty to view system-wide data

    // Get ticket counts by status for this role
    const statusCounts = await TicketModel.getStatusCounts(filter);

    // Get ticket counts by priority for this role
    const priorityCounts = await TicketModel.getPriorityCounts(filter);

    // Calculate total tickets
    const totalTickets = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    // Get agent workloads based on role
    const agentWorkloads: Record<string, number> = {};
    if (userRole === 'admin') {
      const agents = await UserModel.findByRole('agent');
      for (const agent of agents) {
        agentWorkloads[agent.name] = await TicketModel.getAgentWorkload(agent.id);
      }
    } else if (userRole === 'agent') {
      const currentAgent = await UserModel.findById(userId);
      const myWorkload = await TicketModel.getAgentWorkload(userId);
      agentWorkloads[currentAgent?.name || 'My Queue'] = myWorkload;
    }

    res.json({
      success: true,
      metrics: {
        totalTickets,
        statusCounts,
        priorityCounts,
        agentWorkloads,
      },
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

export default router;
