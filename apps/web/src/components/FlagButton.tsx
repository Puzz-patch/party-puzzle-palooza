import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Flag, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export enum FlagReason {
  INAPPROPRIATE = 'inappropriate',
  OFFENSIVE = 'offensive',
  SPAM = 'spam',
  DUPLICATE = 'duplicate',
  MISLEADING = 'misleading',
  OTHER = 'other'
}

interface FlagButtonProps {
  questionId: string;
  flagCount?: number;
  isFlagged?: boolean;
  isHidden?: boolean;
  onFlagged?: (flagCount: number, isFlagged: boolean, isHidden: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

const flagReasons = [
  { value: FlagReason.INAPPROPRIATE, label: 'Inappropriate Content', description: 'Content that is not suitable for all audiences' },
  { value: FlagReason.OFFENSIVE, label: 'Offensive', description: 'Content that is offensive or harmful' },
  { value: FlagReason.SPAM, label: 'Spam', description: 'Repeated or unwanted content' },
  { value: FlagReason.DUPLICATE, label: 'Duplicate', description: 'Question already exists' },
  { value: FlagReason.MISLEADING, label: 'Misleading', description: 'Incorrect or misleading information' },
  { value: FlagReason.OTHER, label: 'Other', description: 'Other reason not listed above' },
];

export const FlagButton: React.FC<FlagButtonProps> = ({
  questionId,
  flagCount = 0,
  isFlagged = false,
  isHidden = false,
  onFlagged,
  className = '',
  size = 'sm',
  variant = 'outline'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFlag = async () => {
    if (!reason) {
      toast({
        title: 'Reason Required',
        description: 'Please select a reason for flagging this question.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/questions/${questionId}/flag`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          reason,
          details: details.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to flag question');
      }

      const data = await response.json();

      toast({
        title: 'Question Flagged! 🚩',
        description: data.message,
        variant: data.isFlagged ? 'destructive' : 'default',
      });

      // Call the callback with updated flag information
      onFlagged?.(data.flagCount, data.isFlagged, data.isHidden);

      // Close the dialog
      setIsOpen(false);
      setReason('');
      setDetails('');

    } catch (error) {
      console.error('Error flagging question:', error);
      
      toast({
        title: 'Flag Failed ❌',
        description: error instanceof Error ? error.message : 'Failed to flag question',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setReason('');
    setDetails('');
  };

  // If question is hidden, show a different state
  if (isHidden) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" className="flex items-center gap-1">
          <X className="h-3 w-3" />
          Hidden
        </Badge>
        <span className="text-xs text-gray-500">
          {flagCount} flag{flagCount !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  // If question is flagged but not hidden, show flagged state
  if (isFlagged) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Flagged
        </Badge>
        <span className="text-xs text-gray-500">
          {flagCount} flag{flagCount !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`flex items-center gap-2 ${className}`}
        >
          <Flag className="h-4 w-4" />
          Flag
          {flagCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
              {flagCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Flag Question
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe and appropriate environment by reporting questions that violate our community guidelines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for flagging</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as FlagReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {flagReasons.map((flagReason) => (
                  <SelectItem key={flagReason.value} value={flagReason.value}>
                    <div>
                      <div className="font-medium">{flagReason.label}</div>
                      <div className="text-xs text-gray-500">{flagReason.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              placeholder="Please provide any additional context about why this question should be flagged..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 text-right">
              {details.length}/500
            </div>
          </div>

          {flagCount > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  This question has been flagged {flagCount} time{flagCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-yellow-700 mt-1">
                {3 - flagCount} more flag{3 - flagCount !== 1 ? 's' : ''} needed for automatic moderation.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleFlag} 
            disabled={isSubmitting || !reason}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Flagging...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Flag Question
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 