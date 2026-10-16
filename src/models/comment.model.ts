import { QueryResultRow } from 'pg';
import pool from '../config/database';
import { Comment, CommentWithUser } from '../types';

export class CommentModel {
  static async create(
    ticketId: number,
    userId: number,
    text: string
  ): Promise<Comment> {
    const query = `
      INSERT INTO comments (ticket_id, user_id, text)
      VALUES ($1, $2, $3)
      RETURNING id, ticket_id, user_id, text, created_at
    `;

    const result = await pool.query(query, [ticketId, userId, text]);
    return this.mapRowToComment(result.rows[0]);
  }

  static async findByTicketId(ticketId: number): Promise<Comment[]> {
    const query = `
      SELECT id, ticket_id, user_id, text, created_at
      FROM comments
      WHERE ticket_id = $1
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [ticketId]);
    return result.rows.map(row => this.mapRowToComment(row));
  }

  static async findByTicketIdWithUsers(ticketId: number): Promise<CommentWithUser[]> {
    const query = `
      SELECT 
        c.id, c.ticket_id, c.user_id, c.text, c.created_at,
        u.name as user_name, u.role as user_role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = $1
      ORDER BY c.created_at ASC
    `;

    const result = await pool.query(query, [ticketId]);
    return result.rows.map(row => ({
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      text: row.text,
      createdAt: row.created_at,
      userName: row.user_name,
      userRole: row.user_role,
    }));
  }

  private static mapRowToComment(row: QueryResultRow): Comment {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      text: row.text,
      createdAt: row.created_at,
    };
  }
}
