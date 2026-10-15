export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    if (dateStr.includes('T')) {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const cleanDate = dateStr.slice(0, 10);
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      if (year && month && day) {
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr || '—';
  }
}

export function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMinutes(minutes?: number | null): string {
  if (!minutes || isNaN(minutes)) return '0 min (0.0 h)';
  return `${minutes.toLocaleString('pt-BR')} min (${(minutes / 60).toFixed(1)} h)`;
}
