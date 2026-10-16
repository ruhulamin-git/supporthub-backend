export type UserRole = 'customer' | 'agent' | 'admin';
export type TicketStatus = 'New' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'High' | 'Medium' | 'Low';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customerId: number;
  assignedAgentId: number | null;
  customerName?: string;
  customerEmail?: string;
  assignedAgentName?: string;
  assignedAgentEmail?: string;
  aiConfidence: number | null;
  urgencyScore: number | null;
  sentimentScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: number;
  ticketId: number;
  userId: number;
  text: string;
  createdAt: Date;
}

export interface StatusHistory {
  id: number;
  ticketId: number;
  fromStatus: string | null;
  toStatus: string;
  changedBy: number;
  changedAt: Date;
}

// DTOs (Data Transfer Objects)
export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface CreateTicketDTO {
  title: string;
  description: string;
  customerId: number;
}

export interface ClassificationResult {
  priority: TicketPriority;
  confidence: number;
  urgencyScore: number;
  sentimentScore: number;
  keywords: string[];
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  customerId?: number;
  assignedAgentId?: number | null;
  search?: string;
}

export interface CommentWithUser extends Comment {
  userName?: string;
  userRole?: UserRole;
}

export interface StatusHistoryWithUser extends StatusHistory {
  changedByName?: string;
}

export interface AuthenticatedUser {
  userId: number;
  role: UserRole;
}

