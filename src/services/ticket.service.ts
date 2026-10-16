import { TicketModel } from '../models/ticket.model';
import { CommentModel } from '../models/comment.model';
import { StatusHistoryModel } from '../models/status-history.model';
import { UserModel } from '../models/user.model';
import { AIClassifierService } from './ai-classifier.service';
import { WebSocketService } from './websocket.service';
import { Validator } from '../utils/validation';
import { 
  CreateTicketDTO, 
  Ticket, 
  TicketStatus, 
  TicketPriority, 
  Comment, 
  TicketFilters, 
  CommentWithUser, 
  StatusHistoryWithUser 
} from '../types';

export class TicketService {
  /**
   * Create a new ticket with AI classification
   */
  static async createTicket(data: CreateTicketDTO): Promise<{
    success: boolean;
    ticket?: Ticket;
    message?: string;
  }> {
    // Validate required fields
    const validation = Validator.validateRequiredFields(data, [
      'title',
      'description',
      'customerId',
    ]);

    if (!validation.isValid) {
      return {
        success: false,
        message: `Missing required fields: ${validation.missing.join(', ')}`,
      };
    }

    // Validate description length
    if (!Validator.isValidTicketDescription(data.description)) {
      return {
        success: false,
        message: 'Description must be between 10 and 2000 characters',
      };
    }

    // Sanitize inputs
    const sanitizedTitle = Validator.sanitizeInput(data.title);
    const sanitizedDescription = Validator.sanitizeInput(data.description);

    try {
      // Run AI classification
      const classification = AIClassifierService.classifyTicket(
        `${sanitizedTitle} ${sanitizedDescription}`
      );

      // Create ticket with AI classification results
      const ticket = await TicketModel.create({
        title: sanitizedTitle,
        description: sanitizedDescription,
        customerId: data.customerId,
        priority: classification.priority,
        aiConfidence: classification.confidence,
        urgencyScore: classification.urgencyScore,
        sentimentScore: classification.sentimentScore,
      });

      // Record initial status in history
      await StatusHistoryModel.create(
        ticket.id,
        null,
        'New',
        data.customerId
      );

      // Broadcast ticket created event
      WebSocketService.broadcastTicketCreated(ticket);
      WebSocketService.broadcastMetricsUpdated();

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error('Ticket creation error:', error);
      return {
        success: false,
        message: 'Failed to create ticket',
      };
    }
  }

  /**
   * Get ticket by ID
   */
  static async getTicketById(id: number): Promise<Ticket | null> {
    return TicketModel.findById(id);
  }

  /**
   * Get all tickets with optional filters
   */
  static async getAllTickets(filters?: TicketFilters): Promise<Ticket[]> {
    return TicketModel.findAll(filters);
  }

  /**
   * Update ticket status
   */
  static async updateStatus(
    ticketId: number,
    newStatus: TicketStatus,
    userId: number
  ): Promise<{
    success: boolean;
    ticket?: Ticket;
    message?: string;
  }> {
    try {
      // Get current ticket
      const currentTicket = await TicketModel.findById(ticketId);
      if (!currentTicket) {
        return { success: false, message: 'Ticket not found' };
      }

      // Validate status transition
      const isValid = AIClassifierService.isValidStatusTransition(
        currentTicket.status,
        newStatus
      );

      if (!isValid) {
        return {
          success: false,
          message: `Invalid status transition from ${currentTicket.status} to ${newStatus}`,
        };
      }

      // Update status
      const ticket = await TicketModel.updateStatus(ticketId, newStatus);
      if (!ticket) {
        return {
          success: false,
          message: 'Failed to update ticket status',
        };
      }

      // Record in history
      await StatusHistoryModel.create(
        ticketId,
        currentTicket.status,
        newStatus,
        userId
      );

      // Broadcast status change
      WebSocketService.broadcastStatusChanged(ticketId, currentTicket.status, newStatus);
      WebSocketService.broadcastTicketUpdated(ticket);
      WebSocketService.broadcastMetricsUpdated();

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error('Status update error:', error);
      return {
        success: false,
        message: 'Failed to update status',
      };
    }
  }

  /**
   * Assign ticket to agent with lowest workload
   */
  static async assignTicket(
    ticketId: number,
    agentId?: number
  ): Promise<{
    success: boolean;
    ticket?: Ticket;
    message?: string;
  }> {
    try {
      let selectedAgentId: number;

      if (agentId) {
        // Manual assignment
        selectedAgentId = agentId;
      } else {
        // Automatic assignment - find agent with lowest workload
        const agents = await UserModel.findByRole('agent');

        if (agents.length === 0) {
          return {
            success: false,
            message: 'No agents available',
          };
        }

        // Find agent with lowest workload
        let minWorkload = Infinity;
        let bestAgent = agents[0];

        for (const agent of agents) {
          const workload = await TicketModel.getAgentWorkload(agent.id);
          if (workload < minWorkload) {
            minWorkload = workload;
            bestAgent = agent;
          }
        }

        selectedAgentId = bestAgent.id;
      }

      // Assign ticket
      const ticket = await TicketModel.assignAgent(ticketId, selectedAgentId);

      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }

      // Broadcast assignment
      WebSocketService.notifyAgent(selectedAgentId, ticket);
      WebSocketService.broadcastTicketUpdated(ticket);
      WebSocketService.broadcastMetricsUpdated();

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error('Assignment error:', error);
      return {
        success: false,
        message: 'Failed to assign ticket',
      };
    }
  }

  /**
   * Add comment to ticket
   */
  static async addComment(
    ticketId: number,
    userId: number,
    text: string
  ): Promise<{
    success: boolean;
    comment?: Comment;
    message?: string;
  }> {
    // Validate comment length
    if (!Validator.isValidCommentLength(text)) {
      return {
        success: false,
        message: 'Comment must be between 1 and 1000 characters',
      };
    }

    // Sanitize input
    const sanitizedText = Validator.sanitizeInput(text);

    try {
      const comment = await CommentModel.create(ticketId, userId, sanitizedText);

      // Broadcast comment added
      const commentWithUser = await CommentModel.findByTicketIdWithUsers(ticketId);
      const newComment = commentWithUser[commentWithUser.length - 1];
      if (newComment) {
        WebSocketService.broadcastCommentAdded(ticketId, newComment);
      }

      return {
        success: true,
        comment,
      };
    } catch (error) {
      console.error('Comment creation error:', error);
      return {
        success: false,
        message: 'Failed to add comment',
      };
    }
  }

  /**
   * Get comments for a ticket
   */
  static async getComments(ticketId: number): Promise<CommentWithUser[]> {
    return CommentModel.findByTicketIdWithUsers(ticketId);
  }

  static async getStatusHistory(ticketId: number): Promise<StatusHistoryWithUser[]> {
    return StatusHistoryModel.findByTicketIdWithUsers(ticketId);
  }

  /**
   * Delete ticket by ID (Admin only)
   */
  static async deleteTicket(ticketId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const deleted = await TicketModel.delete(ticketId);
      if (!deleted) {
        return { success: false, message: 'Ticket not found' };
      }
      WebSocketService.broadcastMetricsUpdated();
      return { success: true };
    } catch (error) {
      console.error('Delete ticket error:', error);
      return { success: false, message: 'Failed to delete ticket' };
    }
  }

  /**
   * Override ticket priority (Admin only)
   */
  static async updatePriority(
    ticketId: number,
    priority: TicketPriority
  ): Promise<{ success: boolean; ticket?: Ticket; message?: string }> {
    try {
      const ticket = await TicketModel.updatePriority(ticketId, priority);
      if (!ticket) {
        return { success: false, message: 'Ticket not found' };
      }
      WebSocketService.broadcastTicketUpdated(ticket);
      WebSocketService.broadcastMetricsUpdated();
      return { success: true, ticket };
    } catch (error) {
      console.error('Update priority error:', error);
      return { success: false, message: 'Failed to update priority' };
    }
  }
}
