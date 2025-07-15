import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Plus, X } from 'lucide-react';
import { GameQuestion } from '../stores/game-store';

const questionSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters').max(500, 'Question must be less than 500 characters'),
  type: z.enum(['would_you_rather', 'trivia', 'word_association', 'drawing']),
  category: z.string().min(1, 'Category is required'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
});

type QuestionFormData = z.infer<typeof questionSchema>;

interface CustomQuestionFormProps {
  onSubmit: (question: Omit<GameQuestion, 'id' | 'roundNumber' | 'status'>) => void;
  onCancel: () => void;
  initialData?: Partial<QuestionFormData>;
}

const questionTypes = [
  { value: 'would_you_rather', label: 'Would You Rather', icon: '🤔' },
  { value: 'trivia', label: 'Trivia', icon: '🧠' },
  { value: 'word_association', label: 'Word Association', icon: '💭' },
  { value: 'drawing', label: 'Drawing', icon: '🎨' },
];

export const CustomQuestionForm: React.FC<CustomQuestionFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: initialData || {
      question: '',
      type: 'would_you_rather',
      category: '',
      options: ['', ''],
    },
  });

  const selectedType = watch('type');

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    setValue('options', newOptions.filter(opt => opt.trim() !== ''));
  };

  const handleFormSubmit = (data: QuestionFormData) => {
    const questionData = {
      question: data.question,
      type: data.type,
      category: data.category,
      options: showOptions ? options.filter(opt => opt.trim() !== '') : undefined,
      correctAnswer: data.correctAnswer,
    };

    onSubmit(questionData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>✍️</span>
          Write Custom Question
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Question Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Question Type</Label>
            <Select
              value={selectedType}
              onValueChange={(value) => setValue('type', value as any)}
            >
              <SelectTrigger data-testid="type-select">
                <SelectValue placeholder="Select question type" />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} data-testid={`type-option-${type.value}`}>
                    <span className="flex items-center gap-2">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              placeholder="Enter your question here..."
              className="min-h-[100px]"
              {...register('question')}
              data-testid="question-input"
            />
            {errors.question && (
              <p className="text-sm text-destructive">{errors.question.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Fun, Science, History, etc."
              {...register('category')}
              data-testid="category-input"
            />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          {/* Options for multiple choice questions */}
          {(selectedType === 'would_you_rather' || selectedType === 'trivia') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOptions(!showOptions)}
                >
                  {showOptions ? 'Hide' : 'Show'} Options
                </Button>
              </div>
              
              {showOptions && (
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                      />
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index)}
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Correct Answer for trivia */}
          {selectedType === 'trivia' && showOptions && (
            <div className="space-y-2">
              <Label htmlFor="correctAnswer">Correct Answer</Label>
              <Input
                id="correctAnswer"
                placeholder="Enter the correct answer"
                {...register('correctAnswer')}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
              data-testid="submit-question"
            >
              {isSubmitting ? 'Creating...' : 'Create Question'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}; 