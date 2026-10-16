import { QueryResultRow } from 'pg';
import pool from '../config/database';
import { Ticket, TicketStatus, TicketPriority, CreateTicketDTO, TicketFilters } from '../types';

export class TicketModel {
  /**
   * Create a new ticket
   */
  static async create(data: CreateTicketDTO & {
    priority: TicketPriority;
    aiConfidence?: number;
    urgencyScore?: number;
    sentimentScore?: number;
  }): Promise<Ticket> {
    const query = `
      INSERT INTO tickets (
        title, description, customer_id, priority,
        ai_confidence, urgency_score, sentiment_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, title, description, status, priority,
        customer_id, assigned_agent_id,
        ai_confidence, urgency_score, sentiment_score,
        created_at, updated_at
    `;

    const values = [
      data.title,
      data.description,
      data.customerId,
      data.priority,
      data.aiConfidence || null,
      data.urgencyScore || null,
      data.sentimentScore || null,
    ];

    const result = await pool.query(query, values);
    const created = await this.findById(result.rows[0].id);
    if (!created) {
      throw new Error(`Failed to retrieve newly created ticket #${result.rows[0].id}`);
    }
    return created;
  }

  /**
   * Find ticket by ID
   */
  static async findById(id: number): Promise<Ticket | null> {
    const query = `
      SELECT 
        t.id, t.title, t.description, t.status, t.priority,
        t.customer_id, t.assigned_agent_id,
        t.ai_confidence, t.urgency_score, t.sentiment_score,
        t.created_at, t.updated_at,
        c.name AS customer_name, c.email AS customer_email,
        a.name AS assigned_agent_name, a.email AS assigned_agent_email
      FROM tickets t
      LEFT JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_agent_id = a.id
      WHERE t.id = $1
    `;

    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTicket(result.rows[0]);
  }

  /**
   * Get all tickets with optional filtering
   */
  static async findAll(filters?: TicketFilters): Promise<Ticket[]> {
    let query = `
      SELECT 
        t.id, t.title, t.description, t.status, t.priority,
        t.customer_id, t.assigned_agent_id,
        t.ai_confidence, t.urgency_score, t.sentiment_score,
        t.created_at, t.updated_at,
        c.name AS customer_name, c.email AS customer_email,
        a.name AS assigned_agent_name, a.email AS assigned_agent_email
      FROM tickets t
      LEFT JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_agent_id = a.id
      WHERE 1=1
    `;

    const values: (string | number | boolean | null)[] = [];
    let paramCount = 1;

    if (filters?.status) {
      query += ` AND t.status = $${paramCount}`;
      values.push(filters.status);
      paramCount++;
    }

    if (filters?.priority) {
      query += ` AND t.priority = $${paramCount}`;
      values.push(filters.priority);
      paramCount++;
    }

    if (filters?.customerId) {
      query += ` AND t.customer_id = $${paramCount}`;
      values.push(filters.customerId);
      paramCount++;
    }

    if (filters?.assignedAgentId !== undefined) {
      if (filters.assignedAgentId === null) {
        query += ` AND t.assigned_agent_id IS NULL`;
      } else {
        query += ` AND t.assigned_agent_id = $${paramCount}`;
        values.push(filters.assignedAgentId);
        paramCount++;
      }
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows.map(this.mapRowToTicket);
  }

  /**
   * Update ticket status
   */
  static async updateStatus(id: number, status: TicketStatus): Promise<Ticket | null> {
    const query = `
      UPDATE tickets
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await pool.query(query, [status, id]);
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Update ticket priority (manual override)
   */
  static async updatePriority(id: number, priority: TicketPriority): Promise<Ticket | null> {
    const query = `
      UPDATE tickets
      SET priority = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await pool.query(query, [priority, id]);
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return this.findById(id);
  }

  /**
   * Assign ticket to agent
   */
  static async assignAgent(ticketId: number, agentId: number): Promise<Ticket | null> {
    const query = `
      UPDATE tickets
      SET assigned_agent_id = $1, 
          status = CASE WHEN status = 'New' THEN 'Assigned' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    const result = await pool.query(query, [agentId, ticketId]);
    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return this.findById(ticketId);
  }

  /**
   * Delete ticket by ID (Admin only)
   */
  static async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM tickets WHERE id = $1`;
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get ticket count by agent
   */
  static async getAgentWorkload(agentId: number): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM tickets
      WHERE assigned_agent_id = $1
        AND status NOT IN ('Resolved', 'Closed')
    `;

    const result = await pool.query(query, [agentId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get tickets by status counts (supports role/user filtering)
   */
  static async getStatusCounts(filter?: {
    customerId?: number;
    assignedAgentId?: number;
  }): Promise<Record<TicketStatus, number>> {
    let query = `
      SELECT status, COUNT(*) as count
      FROM tickets
      WHERE 1=1
    `;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (filter?.customerId) {
      query += ` AND customer_id = $${paramIndex++}`;
      values.push(filter.customerId);
    }
    if (filter?.assignedAgentId) {
      query += ` AND assigned_agent_id = $${paramIndex++}`;
      values.push(filter.assignedAgentId);
    }

    query += ` GROUP BY status`;

    const result = await pool.query(query, values);
    
    const counts: Record<TicketStatus, number> = {
      'New': 0,
      'Assigned': 0,
      'In Progress': 0,
      'Resolved': 0,
      'Closed': 0,
    };

    result.rows.forEach(row => {
      counts[row.status as TicketStatus] = parseInt(row.count, 10);
    });

    return counts;
  }

  /**
   * Get tickets by priority counts (supports role/user filtering)
   */
  static async getPriorityCounts(filter?: {
    customerId?: number;
    assignedAgentId?: number;
  }): Promise<Record<TicketPriority, number>> {
    let query = `
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE 1=1
    `;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (filter?.customerId) {
      query += ` AND customer_id = $${paramIndex++}`;
      values.push(filter.customerId);
    }
    if (filter?.assignedAgentId) {
      query += ` AND assigned_agent_id = $${paramIndex++}`;
      values.push(filter.assignedAgentId);
    }

    query += ` GROUP BY priority`;

    const result = await pool.query(query, values);
    
    const counts: Record<TicketPriority, number> = {
      'High': 0,
      'Medium': 0,
      'Low': 0,
    };

    result.rows.forEach(row => {
      counts[row.priority as TicketPriority] = parseInt(row.count, 10);
    });

    return counts;
  }

  /**
   * Map database row to Ticket object
   */
  private static mapRowToTicket(row: QueryResultRow): Ticket {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      customerId: row.customer_id,
      assignedAgentId: row.assigned_agent_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      assignedAgentName: row.assigned_agent_name,
      assignedAgentEmail: row.assigned_agent_email,
      aiConfidence: row.ai_confidence,
      urgencyScore: row.urgency_score,
      sentimentScore: row.sentiment_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
