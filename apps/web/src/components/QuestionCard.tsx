import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Check, Plus, Minus, Edit, Trash2 } from 'lucide-react';
import { GameQuestion } from '../stores/game-store';
import { cn } from '../lib/utils';
import { FlagButton } from './FlagButton';

interface QuestionCardProps {
  question: GameQuestion;
  isSelected?: boolean;
  isCustom?: boolean;
  onSelect?: () => void;
  onDeselect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFlagged?: (flagCount: number, isFlagged: boolean, isHidden: boolean) => void;
  disabled?: boolean;
}

const typeColors = {
  would_you_rather: 'bg-blue-100 text-blue-800 border-blue-200',
  trivia: 'bg-green-100 text-green-800 border-green-200',
  word_association: 'bg-purple-100 text-purple-800 border-purple-200',
  drawing: 'bg-orange-100 text-orange-800 border-orange-200',
};

const typeIcons = {
  would_you_rather: '🤔',
  trivia: '🧠',
  word_association: '💭',
  drawing: '🎨',
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  isSelected = false,
  isCustom = false,
  onSelect,
  onDeselect,
  onEdit,
  onDelete,
  onFlagged,
  disabled = false,
}) => {
  const handleToggle = () => {
    if (disabled) return;
    
    if (isSelected) {
      onDeselect?.();
    } else {
      onSelect?.();
    }
  };

  const handleFlagged = (flagCount: number, isFlagged: boolean, isHidden: boolean) => {
    onFlagged?.(flagCount, isFlagged, isHidden);
  };

  // If question is hidden, show a different card state
  if (question.isHidden) {
    return (
      <Card className="relative opacity-60 bg-gray-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <Badge variant="destructive" className="text-xs">
              Hidden
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <CardTitle className="text-sm font-medium leading-relaxed mb-3 text-gray-500">
            This question has been hidden due to community reports
          </CardTitle>
          <div className="text-xs text-gray-400">
            {question.flagCount || 0} flag{(question.flagCount || 0) !== 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        'relative transition-all duration-200 hover:shadow-md cursor-pointer',
        isSelected && 'ring-2 ring-primary ring-offset-2 selected',
        disabled && 'opacity-50 cursor-not-allowed',
        question.isFlagged && 'border-orange-200 bg-orange-50'
      )}
      onClick={handleToggle}
      data-testid="question-card"
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="bg-primary text-primary-foreground rounded-full p-1">
            <Check className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Flag indicator */}
      {question.isFlagged && (
        <div className="absolute -top-2 -left-2 z-10">
          <div className="bg-orange-500 text-white rounded-full p-1">
            <span className="text-xs">🚩</span>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[question.type]}</span>
            <Badge 
              variant="outline" 
              className={cn('text-xs', typeColors[question.type])}
            >
              {question.type.replace('_', ' ')}
            </Badge>
            {isCustom && (
              <Badge variant="secondary" className="text-xs">
                Custom
              </Badge>
            )}
            {question.isFlagged && (
              <Badge variant="destructive" className="text-xs">
                Flagged
              </Badge>
            )}
          </div>
          
          {/* Action buttons for custom questions */}
          {isCustom && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <CardTitle className="text-sm font-medium leading-relaxed mb-3">
          {question.question}
        </CardTitle>

        {/* Options for multiple choice questions */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-2 mb-3">
            {question.options.map((option, index) => (
              <div
                key={index}
                className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
              >
                {String.fromCharCode(65 + index)}. {option}
              </div>
            ))}
          </div>
        )}

        {/* Category */}
        {question.category && (
          <div className="text-xs text-muted-foreground">
            Category: {question.category}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex justify-between items-center">
          <FlagButton
            questionId={question.id}
            flagCount={question.flagCount}
            isFlagged={question.isFlagged}
            isHidden={question.isHidden}
            onFlagged={handleFlagged}
            size="sm"
            variant="ghost"
            className="h-8 px-2"
          />
          
          <Button
            variant={isSelected ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={disabled}
            className="h-8 px-3"
          >
            {isSelected ? (
              <>
                <Minus className="h-3 w-3 mr-1" />
                Remove
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Select
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}; 