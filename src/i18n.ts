import type { Lang } from './types'

export const ui = {
  en: { overview: 'Operations Command', filters: 'Planning scope', channel: 'Division', device: 'Store', country: 'Channel', all: 'All', reset: 'Restore operating view', source: 'Licensed source', finding: 'Operational signal', action: 'Next decision', prior: 'vs. prior window', details: 'Exception detail', contact: 'Discuss a similar project', trust: 'Data Trust' },
  pt: { overview: 'Comando Operacional', filters: 'Escopo de planejamento', channel: 'Divisão', device: 'Loja', country: 'Canal', all: 'Todos', reset: 'Restaurar visão operacional', source: 'Fonte licenciada', finding: 'Sinal operacional', action: 'Próxima decisão', prior: 'vs. janela anterior', details: 'Detalhe das exceções', contact: 'Conversar sobre um projeto similar', trust: 'Confiança dos dados' },
} satisfies Record<Lang, Record<string, string>>
