export class Validator {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  static isValidLength(value: string, min: number, max: number): boolean {
    const length = value.length;
    return length >= min && length <= max;
  }

  static validateRequiredFields<T extends object>(
    data: T,
    requiredFields: (keyof T | string)[]
  ): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];
    const record = data as Record<string, unknown>;

    for (const field of requiredFields) {
      const key = String(field);
      if (
        record[key] === undefined ||
        record[key] === null ||
        record[key] === ''
      ) {
        missing.push(key);
      }
    }

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  static isValidTicketDescription(description: string): boolean {
    return this.isValidLength(description, 10, 2000);
  }

  static isValidCommentLength(text: string): boolean {
    return this.isValidLength(text, 1, 1000);
  }
}
