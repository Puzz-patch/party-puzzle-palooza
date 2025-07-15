import { Controller, Post, Get, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { QuestionFlagService } from '../services/question-flag.service';
import { JwtPlayerGuard } from '../auth/jwt-player.guard';
import { PlayerId } from '../auth/player.decorator';
import { FlagQuestionDto, FlagQuestionResponseDto } from '../dto/question-flag.dto';

@ApiTags('Question Flagging')
@Controller('questions')
@UseGuards(JwtPlayerGuard)
export class QuestionFlagController {
  constructor(private readonly questionFlagService: QuestionFlagService) {}

  @Post(':qid/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Flag a question',
    description: 'Flag a question for inappropriate content. After 3 unique flags, the question is automatically flagged and hidden.'
  })
  @ApiParam({ name: 'qid', description: 'Question ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Question flagged successfully',
    type: FlagQuestionResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Already flagged or invalid request'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Question not found'
  })
  async flagQuestion(
    @Param('qid') questionId: string,
    @Body() flagDto: FlagQuestionDto,
    @PlayerId() playerId: string
  ): Promise<FlagQuestionResponseDto> {
    return this.questionFlagService.flagQuestion(questionId, playerId, flagDto);
  }

  @Get(':qid/flags')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get flags for a question',
    description: 'Get all flags for a specific question (moderator only)'
  })
  @ApiParam({ name: 'qid', description: 'Question ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Flags retrieved successfully'
  })
  async getQuestionFlags(@Param('qid') questionId: string) {
    const flags = await this.questionFlagService.getQuestionFlags(questionId);
    return {
      success: true,
      data: {
        questionId,
        flags,
        flagCount: flags.length
      }
    };
  }

  @Get('flagged')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get all flagged questions',
    description: 'Get all questions that have been flagged (moderator only)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Flagged questions retrieved successfully'
  })
  async getFlaggedQuestions() {
    const questions = await this.questionFlagService.getFlaggedQuestions();
    return {
      success: true,
      data: {
        questions,
        count: questions.length
      }
    };
  }

  @Get('flags/statistics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Get flag statistics',
    description: 'Get overall flagging statistics (moderator only)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistics retrieved successfully'
  })
  async getFlagStatistics() {
    const stats = await this.questionFlagService.getFlagStatistics();
    return {
      success: true,
      data: stats
    };
  }
} 