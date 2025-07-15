import { useToast as useToastBase } from '../components/ui/use-toast';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
}

export const useToast = () => {
  const { toast: baseToast } = useToastBase();

  const toast = ({ title, description, variant = 'default', duration = 5000 }: ToastProps) => {
    baseToast({
      title,
      description,
      variant,
      duration,
    });
  };

  return { toast };
};
