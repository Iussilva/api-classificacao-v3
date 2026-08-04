# Catalogo da API

Todas as rotas abaixo ficam em `server.js`. Com excecao de `/api/ping` e `/api/auth/login`, as rotas `/api/...` exigem:

```http
Authorization: Bearer <token>
```

## Autenticacao e Saude

| Metodo | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET | `/` | Publico | Entrega `public/index.html` |
| GET | `/api/ping` | Publico | Verifica conexao com banco da origem informada |
| POST | `/api/auth/login` | Publico | Autentica usuario admin e retorna JWT |

## Cache

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| POST | `/api/cache/limpar` | - | Limpa cache em memoria |
| GET | `/api/cache/status` | - | Mostra quantidade e idade das entradas de cache |

## Cadastros Base

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/estabelecimentos` | `origem` opcional | Lista lojas/estabelecimentos |
| GET | `/api/fabricantes` | `origem` opcional | Lista fabricantes |
| GET | `/api/coordenadores` | - | Retorna mapa fixo de coordenadores e lojas |

## Estoque

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/estoque` | `interno_est`, `fabricante`, `teor`, `pagina`, `limite` | Lista produtos em estoque |
| GET | `/api/estoque/por-fabricante` | `interno_est`, `fabricante`, `teor` | Agrega estoque por fabricante |
| GET | `/api/estoque/por-loja` | `interno_est`, `fabricante`, `teor` | Agrega estoque por loja |
| GET | `/api/estoque/fabricante-por-loja` | `interno_est` | Mostra fabricantes dentro de uma loja |
| GET | `/api/estoque/ranking` | `interno_est`, `fabricante`, `teor` | Ranking de fabricantes |

## Vendas

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/vendas` | `data_inicio`, `data_fim`, `interno_est`, `fabricante`, `coordenador` | Consulta vendas por periodo e retorna agregacoes |

## Marketing

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/marketing/grupos` | `origem` opcional | Lista grupos de clientes |
| GET | `/api/marketing/clientes-novos` | `origem`, `data_inicio`, `data_fim`, `interno_est`, `grupo`, `tipo_documento` | Lista clientes cadastrados no periodo |

## IA

| Metodo | Rota | Corpo | Finalidade |
| --- | --- | --- | --- |
| POST | `/api/ia/chat` | `{ mensagens, filtros }` | Responde perguntas com contexto real de estoque |
| POST | `/api/ia/resumo-estoque` | Dados agregados do front | Gera resumo executivo de estoque |
| POST | `/api/ia/analisar-estoque` | `{ pergunta }` | Consulta estoque atual e responde pergunta |
| POST | `/api/ia/analisar-contratos` | `{ contratos, pergunta }` | Gera analise de contratos recebidos |

## Consultas ERP

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/consultas/movimentacoes-v3` | `tipo`, `origem`, `interno_est`, `data_inicio`, `data_fim` | Consulta movimentacoes por modalidade/status |

Tipos observados:

| Tipo | Descricao |
| --- | --- |
| `contrato_120` | Contratos 120 dias |
| `contrato_003` | Contratos 003 dias |
| `contrato_relogio_120` | Contrato Relogio 120 dias |
| `contrato_relogio_003` | Contrato Relogio 003 dias |
| `contrato_upgrade` | Contrato Upgrade |
| `vendas_vitrine` | Vendas Vitrine |

## Auditoria

| Metodo | Rota | Parametros | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/auditoria/estoque-grade` | `origem`, `interno_est`, `data`, `incluir_valores`, `incluir_grade` | Consulta estoque por grade com valores opcionais |

## Contratos

| Metodo | Rota | Parametros/Corpo | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/contratos/parametros` | `origem`, `interno_est` | Busca parametros do estabelecimento |
| GET | `/api/contratos/tipos` | `origem` | Lista tipos/status de contrato |
| GET | `/api/contratos/compradores` | `origem`, `interno_est` | Lista compradores/comissionados ativos |
| GET | `/api/contratos/clientes` | `origem`, `interno_est`, `busca` | Busca clientes ativos |
| GET | `/api/contratos/produtos` | `origem`, `interno_est`, `busca` | Busca produtos ativos |
| POST | `/api/contratos/validar` | Dados do contrato | Valida cliente, comprador, tipo e itens |

## Contrato Padrao de Resposta

Padrao recomendado para novas rotas:

```json
{
  "dados": [],
  "meta": {
    "origem": "matriz",
    "data_ref": "2026-08-04",
    "total": 0
  }
}
```

Para erro:

```json
{
  "erro": "Mensagem segura para o usuario."
}
```

Evite retornar `err.message` em producao.

