import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../entities/GameRound';
import { Game } from '../entities/Game';
import { GamePlayer } from '../entities/GamePlayer';
import { PlayerAnswer } from '../entities/PlayerAnswer';

export interface ArchivedPromptDto {
  id: string;
  roundId: string;
  roundNumber: number;
  question: string;
  options: string[];
  correctAnswer?: string;
  revealed: boolean;
  archivedAt: string;
  totalPlayers: number;
  respondedPlayers: number;
  winner?: string;
  winnerScore?: number;
}

@Injectable()
export class ArchivedPromptsService {
  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepository: Repository<GamePlayer>,
    @InjectRepository(PlayerAnswer)
    private playerAnswerRepository: Repository<PlayerAnswer>,
  ) {}

  async getArchivedPrompts(gameId: string): Promise<{ prompts: ArchivedPromptDto[] }> {
    // Get all completed rounds for the game
    const rounds = await this.gameRoundRepository.find({
      where: { gameId },
      relations: ['question'],
      order: { roundNumber: 'DESC' }
    });

    // Get total players in the game
    const totalPlayers = await this.gamePlayerRepository.count({
      where: { gameId }
    });

    const archivedPrompts: ArchivedPromptDto[] = [];

    for (const round of rounds) {
      // Get responses for this round
      const responses = await this.playerAnswerRepository.find({
        where: { roundId: round.id },
        relations: ['player']
      });

      // Find the winner (player with highest score)
      let winner: string | undefined;
      let winnerScore: number | undefined;
      
      if (responses.length > 0) {
        const maxScore = Math.max(...responses.map(r => r.score || 0));
        const winningResponse = responses.find(r => (r.score || 0) === maxScore);
        if (winningResponse) {
          winner = winningResponse.player.name;
          winnerScore = winningResponse.score || 0;
        }
      }

      const archivedPrompt: ArchivedPromptDto = {
        id: round.id,
        roundId: round.id,
        roundNumber: round.roundNumber,
        question: round.question.question,
        options: round.question.options,
        correctAnswer: round.revealed ? round.question.correctAnswer : undefined,
        revealed: round.revealed,
        archivedAt: round.updatedAt.toISOString(),
        totalPlayers,
        respondedPlayers: responses.length,
        winner,
        winnerScore
      };

      archivedPrompts.push(archivedPrompt);
    }

    return { prompts: archivedPrompts };
  }

  async archiveRound(roundId: string): Promise<void> {
    // This method would be called when a round is completed
    // For now, we just mark the round as archived
    await this.gameRoundRepository.update(roundId, {
      archived: true,
      archivedAt: new Date()
    });
  }

  async revealRound(roundId: string): Promise<void> {
    // This method would be called when a round is revealed
    await this.gameRoundRepository.update(roundId, {
      revealed: true,
      revealedAt: new Date()
    });
  }
} 