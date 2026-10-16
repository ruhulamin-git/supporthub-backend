import { Router, Request, Response } from 'express';
import { TicketService } from '../services/ticket.service';
import { UserModel } from '../models/user.model';
import { verifyToken, checkRole } from '../middleware/auth.middleware';
import { CreateTicketDTO, TicketFilters, TicketStatus, TicketPriority } from '../types';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/tickets
 * Create a new ticket
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const data: CreateTicketDTO = {
      title: req.body.title,
      description: req.body.description,
      customerId: req.user.userId,
    };

    const result = await TicketService.createTicket(data);

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/tickets/agents
 * Get all support agents for assignment controls
 */
router.get('/agents', checkRole(['agent', 'admin']), async (_req: Request, res: Response) => {
  try {
    const agents = await UserModel.findByRole('agent');
    res.json({
      success: true,
      agents: agents.map(a => ({ id: a.id, name: a.name, email: a.email })),
    });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch agents',
    });
  }
});

/**
 * GET /api/tickets
 * Get all tickets (with optional filters)
 */
router.get('/', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const filters: TicketFilters = {};

    if (req.query.status) filters.status = req.query.status as TicketStatus;
    if (req.query.priority) filters.priority = req.query.priority as TicketPriority;
    if (req.query.customerId) {
      const parsed = parseInt(req.query.customerId as string, 10);
      if (!Number.isNaN(parsed)) filters.customerId = parsed;
    }
    
    if (req.query.unassigned === 'true') {
      filters.assignedAgentId = null;
    } else if (req.query.assignedAgentId) {
      const parsed = parseInt(req.query.assignedAgentId as string, 10);
      if (!Number.isNaN(parsed)) filters.assignedAgentId = parsed;
    }

    // If customer, only show their tickets
    if (req.user.role === 'customer') {
      filters.customerId = req.user.userId;
    }

    const tickets = await TicketService.getAllTickets(filters);

    res.json({
      success: true,
      tickets,
      count: tickets.length,
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/tickets/:id
 * Get ticket by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const ticket = await TicketService.getTicketById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        error: true,
        message: 'Ticket not found',
      });
    }

    // Check authorization (customer can only see their own tickets)
    if (req.user.role === 'customer' && ticket.customerId !== req.user.userId) {
      return res.status(403).json({
        error: true,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Update ticket status
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: true,
        message: 'Status is required',
      });
    }

    const ticket = await TicketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        error: true,
        message: 'Ticket not found',
      });
    }

    if (req.user.role === 'customer') {
      if (ticket.customerId !== req.user.userId) {
        return res.status(403).json({
          error: true,
          message: 'Access denied',
        });
      }
      if (ticket.status !== 'Resolved' || status !== 'Closed') {
        return res.status(403).json({
          error: true,
          message: 'Customers can only close resolved tickets',
        });
      }
    }

    const result = await TicketService.updateStatus(
      ticketId,
      status as TicketStatus,
      req.user.userId
    );

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.json({
      success: true,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/tickets/:id/assign
 * Assign ticket to agent
 * - Agent can only claim ticket for themselves
 * - Admin can assign/reassign to any agent or trigger auto-assign
 */
router.post('/:id/assign', checkRole(['agent', 'admin']), async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    let agentId = req.body.agentId ? parseInt(req.body.agentId, 10) : undefined;

    // Agent can only claim ticket for themselves
    if (req.user.role === 'agent') {
      if (agentId && agentId !== req.user.userId) {
        return res.status(403).json({
          error: true,
          message: 'Support agents can only claim tickets for themselves. Only administrators can reassign tickets to other agents.',
        });
      }
      agentId = req.user.userId;
    }

    const result = await TicketService.assignTicket(ticketId, agentId);

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.json({
      success: true,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * PATCH /api/tickets/:id/priority
 * Admin only: Override AI ticket priority
 */
router.patch('/:id/priority', checkRole(['admin']), async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const { priority } = req.body;

    if (!priority || !['High', 'Medium', 'Low'].includes(priority)) {
      return res.status(400).json({
        error: true,
        message: 'Valid priority (High, Medium, Low) is required',
      });
    }

    const result = await TicketService.updatePriority(ticketId, priority);

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.json({
      success: true,
      ticket: result.ticket,
    });
  } catch (error) {
    console.error('Update priority error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/tickets/:id
 * Admin only: Delete ticket permanently
 */
router.delete('/:id', checkRole(['admin']), async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const result = await TicketService.deleteTicket(ticketId);

    if (!result.success) {
      return res.status(404).json({
        error: true,
        message: result.message || 'Ticket not found',
      });
    }

    res.json({
      success: true,
      message: 'Ticket deleted successfully',
      ticketId,
    });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/tickets/:id/comments
 * Get all comments for a ticket
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const ticket = await TicketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: true, message: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.customerId !== req.user.userId) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    const comments = await TicketService.getComments(ticketId);

    res.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const ticket = await TicketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: true, message: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.customerId !== req.user.userId) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Comment text is required',
      });
    }

    const result = await TicketService.addComment(
      ticketId,
      req.user.userId,
      text
    );

    if (!result.success) {
      return res.status(400).json({
        error: true,
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      comment: result.comment,
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: true, message: 'Authentication required' });
  }

  try {
    const ticketId = parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ error: true, message: 'Invalid ticket ID' });
    }

    const ticket = await TicketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: true, message: 'Ticket not found' });
    }

    if (req.user.role === 'customer' && ticket.customerId !== req.user.userId) {
      return res.status(403).json({ error: true, message: 'Access denied' });
    }

    const history = await TicketService.getStatusHistory(ticketId);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

export default router;
