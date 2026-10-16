import { QueryResultRow } from 'pg';
import pool from '../config/database';
import { StatusHistory, StatusHistoryWithUser, TicketStatus } from '../types';

export class StatusHistoryModel {
  static async create(
    ticketId: number,
    fromStatus: TicketStatus | null,
    toStatus: TicketStatus,
    changedBy: number
  ): Promise<StatusHistory> {
    const query = `
      INSERT INTO status_history (ticket_id, from_status, to_status, changed_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, ticket_id, from_status, to_status, changed_by, changed_at
    `;

    const result = await pool.query(query, [ticketId, fromStatus, toStatus, changedBy]);
    return this.mapRowToStatusHistory(result.rows[0]);
  }

  static async findByTicketId(ticketId: number): Promise<StatusHistory[]> {
    const query = `
      SELECT id, ticket_id, from_status, to_status, changed_by, changed_at
      FROM status_history
      WHERE ticket_id = $1
      ORDER BY changed_at ASC
    `;

    const result = await pool.query(query, [ticketId]);
    return result.rows.map(row => this.mapRowToStatusHistory(row));
  }

  static async findByTicketIdWithUsers(ticketId: number): Promise<StatusHistoryWithUser[]> {
    const query = `
      SELECT 
        sh.id, sh.ticket_id, sh.from_status, sh.to_status, 
        sh.changed_by, sh.changed_at,
        u.name as changed_by_name
      FROM status_history sh
      JOIN users u ON sh.changed_by = u.id
      WHERE sh.ticket_id = $1
      ORDER BY sh.changed_at ASC
    `;

    const result = await pool.query(query, [ticketId]);
    return result.rows.map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedBy: row.changed_by,
      changedByName: row.changed_by_name,
      changedAt: row.changed_at,
    }));
  }

  private static mapRowToStatusHistory(row: QueryResultRow): StatusHistory {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
    };
  }
}
