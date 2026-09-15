# Leitura analítica do AisleFlow

Snapshot: 01/06/2025 a 24/04/2026. Os marts completos contêm 123.928 linhas de vendas e 50.447 linhas de risco por loja-produto.

## Resposta executiva

Nos últimos 30 dias, as vendas líquidas foram de US$ 659.113, queda de 37,4% contra US$ 1.053.127 nos 30 dias anteriores. Unidades caíram 34,6% e transações 34,8%, enquanto a margem bruta permaneceu praticamente estável: 41,96% contra 41,84%. Nesta amostra, a queda é principalmente de volume, não um colapso da taxa de margem.

Todas as divisões caíram: Scholar Footwear -39,0%, Femme Footwear -32,9% e Junior Apparel -40,7%. Scholar Footwear respondeu por US$ 275.829 da queda total de US$ 394.014 por ser a maior divisão. A quantidade de produtos com vendas também caiu de 1.841 para 1.538 (-16,5%), indicando menor amplitude do sortimento ativo junto da redução de demanda.

No histórico completo, Scholar Footwear gera US$ 7,34 milhões, 70,0% das vendas modeladas. Essa concentração explica por que seu movimento absoluto domina o resultado da rede, mas a queda generalizada mostra que o problema não está restrito a ela.

O risco operacional imediato está no estoque: 35.724 linhas são classificadas como Excess (70,8%), enquanto 797 estão Out of stock e 541 Critical. A fila de risco contém valores negativos de estoque disponível, que precisam ser reconciliados antes de emitir um pedido.

Nota de qualidade: o mart de vendas contém linhas com vendas, unidades e COGS negativos, possivelmente devoluções ou ajustes, mas a fonte não documenta essa semântica explicitamente. As variáveis de demanda também contêm valores negativos em 114 a 133 linhas. Esses registros precisam ser classificados na origem antes do uso operacional; eles não são removidos silenciosamente do histórico.

## Decisão de previsão

O baseline de média móvel de 28 dias continua selecionado. Em 270 observações de holdout temporal, alcançou RMSE 280,01 e WAPE 47,3%, enquanto o candidato de tendência linear alcançou RMSE 280,84 e WAPE 49,3%. O candidato não melhorou o baseline e não deve ser promovido.

## Sequência recomendada de ação

1. Diagnosticar a queda generalizada de volume por loja, canal e sortimento ativo antes de alterar margem ou política de preço.
2. Reconciliar estoque negativo e rupturas, começando pelos maiores volumes de reposição.
3. Analisar estoque excessivo separadamente do risco de nível de serviço; não usar um único total para as duas decisões.
4. Priorizar Scholar Footwear pelo impacto absoluto, preservando as taxas específicas de cada divisão.
5. Usar a previsão de média móvel de 28 dias como sinal de planejamento, não como pedido automático.
6. Resolver a semântica de devoluções/ajustes e os registros de demanda negativa antes de definir limites de reposição em produção.

## Limitações

Prazo de fornecedor, nível de serviço, pedido mínimo, custo de estoque, vendas perdidas e histórico de pedidos não existem na fonte. As quantidades de reposição e os cenários exigem confirmação operacional. As vendas representam o dataset fornecido, não uma varejista ao vivo.
