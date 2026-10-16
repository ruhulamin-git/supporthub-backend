import { Server } from 'socket.io';
import { Ticket, CommentWithUser } from '../types';

export class WebSocketService {
  private static io: Server;

  /**
   * Initialize WebSocket service with Socket.io instance
   */
  static initialize(io: Server) {
    this.io = io;
  }

  /**
   * Broadcast ticket created event to all clients
   */
  static broadcastTicketCreated(ticket: Ticket) {
    if (this.io) {
      this.io.emit('ticket:created', { ticket });
    }
  }

  /**
   * Broadcast ticket updated event to all clients
   */
  static broadcastTicketUpdated(ticket: Ticket) {
    if (this.io) {
      this.io.emit('ticket:updated', { ticket });
    }
  }

  /**
   * Broadcast status change event
   */
  static broadcastStatusChanged(ticketId: number, oldStatus: string, newStatus: string) {
    if (this.io) {
      this.io.emit('ticket:status_changed', { ticketId, oldStatus, newStatus });
    }
  }

  /**
   * Notify specific agent about ticket assignment
   */
  static notifyAgent(agentId: number, ticket: Ticket) {
    if (this.io) {
      // In a more complete implementation, we'd track socket IDs by user ID
      // For now, broadcast to all and let clients filter
      this.io.emit('ticket:assigned', { agentId, ticket });
    }
  }

  /**
   * Broadcast new comment added
   */
  static broadcastCommentAdded(ticketId: number, comment: CommentWithUser) {
    if (this.io) {
      this.io.emit('comment:added', { ticketId, comment });
    }
  }

  /**
   * Broadcast dashboard metrics updated
   */
  static broadcastMetricsUpdated() {
    if (this.io) {
      this.io.emit('metrics:updated');
    }
  }
}
