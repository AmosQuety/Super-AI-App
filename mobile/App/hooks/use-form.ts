import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type DefaultValues, type FieldValues } from 'react-hook-form';
import { z } from 'zod';

// Form values are the schema's input; handleSubmit receives the parsed output.
export function useZodForm<T extends z.ZodType<FieldValues, FieldValues>>(
  schema: T,
  defaultValues?: DefaultValues<z.input<T>>
) {
  return useForm<z.input<T>, unknown, z.output<T>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });
}
