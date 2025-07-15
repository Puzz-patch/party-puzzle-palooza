import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  error?: string;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly openaiApiKey: string;

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
  }

  async moderateContent(content: string): Promise<ModerationResult> {
    if (!this.openaiApiKey) {
      this.logger.warn('OpenAI API key not configured, skipping moderation');
      return {
        flagged: false,
        categories: {},
        categoryScores: {}
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          input: content
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const result = data.results[0];

      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores
      };
    } catch (error) {
      this.logger.error('Moderation service error:', error);
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async isContentAppropriate(content: string): Promise<boolean> {
    const result = await this.moderateContent(content);
    
    if (result.error) {
      // If moderation fails, we'll be conservative and reject
      this.logger.warn('Moderation failed, rejecting content:', result.error);
      return false;
    }

    // Check for inappropriate categories
    const inappropriateCategories = [
      'hate', 'hate/threatening', 'self-harm', 'sexual', 'sexual/minors',
      'violence', 'violence/graphic'
    ];

    const hasInappropriateContent = inappropriateCategories.some(
      category => result.categories[category]
    );

    if (hasInappropriateContent) {
      this.logger.warn('Inappropriate content detected:', result.categories);
    }

    return !hasInappropriateContent;
  }
} 