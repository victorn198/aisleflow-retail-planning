# Guia do dashboard AisleFlow

## Por que este case existe

O AisleFlow foi criado para equipes de planejamento de varejo decidirem onde agir antes que ruptura ou excesso apareçam no resultado financeiro. A base Mendeley foi escolhida por combinar transações e estoques licenciados entre lojas, produtos, categorias, divisões e canais, criando um problema real de reconciliação de granularidade.

A arquitetura separa vendas de estoque, usa DuckDB e dbt para transformações reproduzíveis, Parquet para entrega compacta e React com DuckDB-WASM no navegador. A demo pode ser hospedada sem custo fixo e ainda representa um caminho real para integração com ERP.

## Fluxo de uso

1. Abra **Comando Operacional** no início do ciclo.
2. Filtre por **Divisão**, **Loja** ou **Canal**.
3. Consulte **Previsão de Demanda** para entender volume esperado.
4. Use **Risco de Estoque** para separar ruptura de excesso.
5. Compare pares em **Explorador de Lojas e Categorias**.
6. Monte um cenário no **Simulador de Reposição**.
7. Verifique premissas em **Confiança dos Dados**.
8. Use **Restaurar visão operacional** para voltar ao baseline.

## Dicionário de indicadores

| Indicador | Por que foi escolhido | Cálculo e granularidade | Interpretação correta |
|---|---|---|---|
| Vendas líquidas | Mede resultado comercial | Soma do valor de vendas nas linhas transacionais | Receita conforme lógica de devolução da fonte, não caixa recebido |
| Unidades vendidas | Liga valor à demanda física | Soma das quantidades | Volume; quantidades negativas podem representar devolução |
| Transações | Mede atividade de compra | Soma da contagem de transações | Frequência, não clientes únicos |
| Margem bruta | Adiciona qualidade econômica | (vendas - COGS) / vendas | Contribuição antes de despesas operacionais |
| Estoque atual | Estabelece oferta disponível | Último estoque por loja-produto | Fotografia local, não disponibilidade de toda a rede |
| Demanda média diária | Normaliza velocidade recente | Unidades dos últimos 28 dias / 28 | Sinal de planejamento |
| Estoque-alvo | Explicita a premissa | Demanda diária × 14 dias | Meta de cenário, não política oficial |
| Quantidade de reposição | Traduz a diferença em ação candidata | máximo entre alvo - atual e zero | Unidades sugeridas antes de restrições |
| Posições em risco | Prioriza exceções | Loja-produto em ruptura, crítico ou baixo | Quantidade de posições, não de produtos |
| Status de risco | Converte cobertura em estado | Ruptura; menos de 7 dias crítico; menos de 14 baixo; mais de 45 excesso; demais saudável | Triagem por regra |
| Lojas / Produtos / Linhas | Expõem escopo | Distintos e contagem da fonte | Cobertura dos dados |
| Dias cobertos | Expõe profundidade histórica | Data máxima - mínima + 1 | Horizonte disponível |

As comparações usam a metade anterior não sobreposta. Para risco, queda é favorável; para vendas, unidades, transações e margem, alta é favorável.

## Página por página

### 1. Comando Operacional

- **Objetivo:** responder o que exige atenção antes da próxima reposição.
- **Cards:** vendas, unidades, transações, margem e posições em risco equilibram demanda, valor, economia e carga de exceções.
- **Pulso de vendas:** detecta picos, sazonalidade, devoluções e quebras.
- **Contribuição por divisão:** mostra onde está a maior exposição.
- **Fila de prioridades:** exibe produto, loja, divisão, estoque atual, alvo, reposição e status.
- **Ação:** começar por ruptura e crítico e validar prazo e fornecedor.

### 2. Previsão de Demanda

- **Objetivo:** estimar o volume para os próximos 28 dias.
- **Previsão-base:** média móvel transparente que venceu a tendência linear na validação de origem móvel.
- **Demanda por divisão:** localiza concentração.
- **Contexto da previsão:** expõe evidências por categoria.
- **Governança:** o candidato só substitui o baseline com melhora mínima de 5% no RMSE temporal; o resultado está em public/data/forecast_evaluation.json.
- **Ação:** usar como faixa de planejamento, não como ordem baseada em ponto único.

### 3. Risco de Estoque

- **Objetivo:** localizar cobertura insuficiente ou excessiva.
- **Cards:** demanda, oferta e tamanho da fila.
- **Sinal de demanda e estoque:** separa movimento persistente de pico.
- **Exposição por divisão:** mostra concentração do risco.
- **Detalhe:** fornece loja-produto e estado calculado.
- **Ação:** separar falta de item rápido de item lento ou excessivo.

### 4. Explorador de Lojas e Categorias

- **Objetivo:** explicar diferenças da rede.
- **Cards:** evitam ranking unidimensional.
- **Vendas da rede:** mostra comportamento temporal do grupo.
- **Contribuição por loja:** ordena lojas no contexto selecionado.
- **Detalhe por categoria:** sustenta a comparação.
- **Ação:** comparar pares equivalentes de loja e categoria.

### 5. Simulador de Reposição

- **Objetivo:** transformar evidência em cenário transparente.
- **Cards:** estoque atual, posições em risco, unidades sugeridas e vendas expostas.
- **Demanda esperada:** trajetória usada na sugestão.
- **Demanda por canal:** mostra origem do volume.
- **Candidatos à reposição:** lista entradas e resultado da regra.
- **Ação:** confirmar prazo, lote mínimo, nível de serviço, capacidade e orçamento.

### 6. Confiança dos Dados

- **Objetivo:** tornar a recomendação auditável.
- **Cards:** escopo de linhas, lojas, produtos e dias.
- **Volume da fonte:** evidencia lacunas.
- **Cobertura hierárquica:** verifica divisões e categorias.
- **Evidências de qualidade:** mostra as linhas usadas nas regras.
- **Verificação DuckDB-WASM:** lê o mart publicado diretamente.
- **Ação:** rejeitar ou qualificar cenário com chaves, datas ou premissas incompletas.

## Por que o design é mais denso

Planejamento de varejo é gestão de exceções. Cards compactos, filtros persistentes, tabelas informativas, verde contido e estados explícitos favorecem varredura e ação repetida.

## Limites

Prazo de fornecedor, nível de serviço, lote mínimo, restrições de pedido, venda perdida e custo de carregamento não existem. As reposições são cenários e exigem confirmação operacional.

