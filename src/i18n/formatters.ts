// Intl constructors are expensive; reuse each format across entries and renders.
export function createDateFormatter(options: Intl.DateTimeFormatOptions) {
  const formatters = new Map<string, Intl.DateTimeFormat>();
  return (value: Date | number, locale: string): string => {
    let formatter = formatters.get(locale);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, options);
      formatters.set(locale, formatter);
    }
    return formatter.format(value);
  };
}

export function createNumberFormatter(options: Intl.NumberFormatOptions) {
  const formatters = new Map<string, Intl.NumberFormat>();
  return (value: number, locale: string): string => {
    let formatter = formatters.get(locale);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      formatters.set(locale, formatter);
    }
    return formatter.format(value);
  };
}
