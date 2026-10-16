import { SentimentAnalyzer, PorterStemmer } from 'natural';
import { ClassificationResult, TicketPriority, TicketStatus } from '../types';

export class AIClassifierService {
  private static readonly HIGH_URGENCY_KEYWORDS = [
    // Direct urgency keywords
    'urgent', 'urgently', 'critical', 'emergency', 'asap', 'immediately', 'blocker', 'blocked',
    // Inability / Failure keywords (with variations)
    'cannot', 'cant', "can't", 'can not', 'unable', 'unable to', 'could not', "couldn't", 'couldnt',
    // System down / Not running / Broken
    'not working', 'not work', 'does not work', "doesn't work",
    'not running', 'cannot run', "can't run", 'cant run', 'can not run', 'fails to run', 'failed to run',
    'broken', 'down', 'failed', 'failing', 'failure', 'error', 'crash', 'crashed', 'crashing',
    'stuck', 'freeze', 'frozen', 'outage', 'unresponsive'
  ];

  private static readonly MEDIUM_URGENCY_KEYWORDS = [
    'issue', 'issues', 'problem', 'problems', 'help', 'need help', 'important',
    'soon', 'quickly', 'bug', 'bugs', 'wrong', 'fix', 'slow', 'delay', 'delayed', 'glitch'
  ];

  private static readonly LOW_URGENCY_KEYWORDS = [
    'minor', 'small', 'whenever', 'eventually', 'suggestion', 'suggestions',
    'nice to have', 'feature request', 'enhancement', 'cosmetic', 'optional'
  ];

  static classifyTicket(content: string): ClassificationResult {
    // Normalize text: lowercase, normalize curly quotes, collapse multiple spaces
    const text = (content || '')
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const urgencyScore = this.analyzeUrgency(text);
    const sentimentScore = this.analyzeSentiment(text);
    const keywords = this.extractKeywords(text);
    const priority = this.calculatePriority(urgencyScore, sentimentScore);
    const confidence = this.calculateConfidence(urgencyScore, sentimentScore, keywords.length);

    return {
      priority,
      confidence,
      urgencyScore,
      sentimentScore,
      keywords,
    };
  }

  private static analyzeUrgency(text: string): number {
    let highMatchesCount = 0;
    let medMatchesCount = 0;
    let lowMatchesCount = 0;

    for (const keyword of this.HIGH_URGENCY_KEYWORDS) {
      if (text.includes(keyword)) {
        highMatchesCount++;
      }
    }

    for (const keyword of this.MEDIUM_URGENCY_KEYWORDS) {
      if (text.includes(keyword)) {
        medMatchesCount++;
      }
    }

    for (const keyword of this.LOW_URGENCY_KEYWORDS) {
      if (text.includes(keyword)) {
        lowMatchesCount++;
      }
    }

    let score = 0;

    // High urgency keywords give a strong baseline of 5.5 (instant High priority)
    if (highMatchesCount > 0) {
      score = 5.5 + (highMatchesCount - 1) * 2.0;
    }

    // Medium urgency keywords
    if (medMatchesCount > 0) {
      score += 2.5 + (medMatchesCount - 1) * 1.5;
    }

    // Low urgency penalty
    score -= lowMatchesCount * 1.5;

    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }

  private static analyzeSentiment(text: string): number {
    try {
      const tokens = text.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return 0;

      const analyzer = new SentimentAnalyzer('English', PorterStemmer, 'afinn');
      const sentiment = analyzer.getSentiment(tokens);

      return Number.isFinite(sentiment) ? Math.max(-5, Math.min(5, Math.round(sentiment * 5 * 10) / 10)) : 0;
    } catch {
      return 0;
    }
  }

  private static calculatePriority(
    urgencyScore: number,
    sentimentScore: number
  ): TicketPriority {
    const finalScore = urgencyScore + (sentimentScore * -0.5);

    if (finalScore >= 5.0) {
      return 'High';
    }
    if (finalScore >= 2.5) {
      return 'Medium';
    }
    return 'Low';
  }

  private static calculateConfidence(
    urgencyScore: number,
    sentimentScore: number,
    keywordCount: number
  ): number {
    const finalScore = urgencyScore + (sentimentScore * -0.5);
    let conf = 55 + (keywordCount * 8) + (finalScore * 3);
    conf = Math.max(50, Math.min(98, Math.round(conf)));
    return conf;
  }

  private static extractKeywords(text: string): string[] {
    const found: string[] = [];

    const allKeywords = [
      ...this.HIGH_URGENCY_KEYWORDS,
      ...this.MEDIUM_URGENCY_KEYWORDS,
      ...this.LOW_URGENCY_KEYWORDS,
    ];

    for (const keyword of allKeywords) {
      if (text.includes(keyword)) {
        found.push(keyword);
      }
    }

    return Array.from(new Set(found));
  }

  static isValidStatusTransition(
    from: TicketStatus,
    to: TicketStatus
  ): boolean {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      'New': ['Assigned', 'In Progress'],
      'Assigned': ['In Progress', 'Resolved'],
      'In Progress': ['Resolved', 'Assigned'],
      'Resolved': ['Closed', 'In Progress'],
      'Closed': [],
    };

    return Boolean(validTransitions[from]?.includes(to));
  }
}
