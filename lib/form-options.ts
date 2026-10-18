export type FormOption = string | { value: string; label: string; projectId?: string };

/** A dependent select must offer only choices for its selected project. */
export function formOptions(options: FormOption[], projectId?: string): FormOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (projectId !== undefined && typeof option !== 'string' && option.projectId !== projectId) return false;
    const value = typeof option === 'string' ? option : option.value;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
export const optionValue = (option: FormOption | undefined) =>
  typeof option === 'string' ? option : option?.value ?? '';
