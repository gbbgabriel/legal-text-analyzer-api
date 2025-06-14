# 🏛️ Legal Text Analyzer API

Uma API robusta para análise de textos jurídicos com integração de IA, otimizada para documentos grandes comuns em escritórios de advocacia.

## ✨ Características Principais

- 📝 **Análise de texto direto** via JSON
- 📄 **Upload de arquivos** (TXT, PDF, DOCX)
- ⚡ **Processamento assíncrono** para textos grandes
- 🤖 **Análise de sentimento** com OpenAI
- ⚖️ **Detecção de termos jurídicos** especializados
- 🔍 **Busca em análises históricas**
- 🚀 **Cache otimizado** para performance
- 📊 **Métricas e monitoramento** com Prometheus
- 🛡️ **Segurança enterprise-grade**
- 📚 **Documentação Swagger** completa

## 🛠️ Stack Tecnológica

- **Backend:** Node.js + Express + TypeScript
- **Banco de Dados:** SQLite + Prisma ORM
- **IA:** OpenAI API (GPT-3.5-turbo)
- **Queue:** Bull (Redis opcional, memory fallback)
- **Cache:** Memory-based com LRU
- **Documentação:** Swagger/OpenAPI
- **Testes:** Jest + Supertest
- **Monitoramento:** Prometheus + Grafana (opcional)

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Redis (opcional, usa memory fallback se não disponível)

### 1. Clone e instale dependências

```bash
git clone <repository-url>
cd legal-text-analyzer
npm install
```

### 2. Configure variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de dados
DATABASE_URL="file:./dev.db"

# OpenAI (opcional, mas recomendado)
OPENAI_API_KEY=your_openai_key_here

# Redis (opcional - deixe vazio para usar memory)
REDIS_URL=redis://localhost:6379

# Configurações de arquivo
MAX_FILE_SIZE=10485760
```

### 3. Configure o banco de dados

```bash
npm run generate
npm run migrate
```

### 4. Execute a aplicação

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 📖 Uso da API

### Endereços importantes

- **API:** http://localhost:3000
- **Documentação:** http://localhost:3000/api-docs
- **Health Check:** http://localhost:3000/api/v1/health
- **Métricas:** http://localhost:9090/metrics (se habilitado)

### Exemplos de uso

#### 1. Análise de texto direto

```bash
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Este é um contrato de locação conforme artigo 1º da Lei do Inquilinato..."
  }'
```

**Resposta (texto pequeno - síncrono):**

```json
{
  "success": true,
  "data": {
    "wordCount": 156,
    "characterCount": 987,
    "topWords": [
      { "word": "contrato", "count": 8 },
      { "word": "locação", "count": 6 }
    ],
    "legalTerms": [
      { "term": "contrato", "count": 8 },
      { "term": "locatário", "count": 4 }
    ],
    "sentiment": {
      "overall": "neutro",
      "score": 0.1
    },
    "structure": {
      "paragraphs": 5,
      "articles": 12,
      "sections": 3
    },
    "processingTime": 245
  }
}
```

#### 2. Upload de arquivo

```bash
curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@contrato.pdf"
```

**Resposta (arquivo grande - assíncrono):**

```json
{
  "success": true,
  "data": {
    "analysisId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "sourceType": "pdf",
    "originalFilename": "contrato.pdf",
    "fileSize": 1048576,
    "extractedTextLength": 25430,
    "estimatedTime": 35,
    "checkStatusUrl": "/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/status"
  }
}
```

#### 3. Verificar status de análise

```bash
curl http://localhost:3000/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/status
```

#### 4. Buscar termo

```bash
curl "http://localhost:3000/api/v1/search-term?term=contrato"
```

### Formatos de arquivo suportados

| Formato | Extensão | Tamanho Máximo | Limitações                       |
| ------- | -------- | -------------- | -------------------------------- |
| Texto   | .txt     | 10MB           | Detecta encoding automaticamente |
| PDF     | .pdf     | 10MB           | Não suporta senha/OCR            |
| Word    | .docx    | 10MB           | Apenas formato moderno           |

## 🧪 Testes

```bash
# Todos os testes
npm test

# Testes unitários apenas
npm run test

# Cobertura de testes
npm run test:coverage
```

## 🐳 Docker (Opcional)

### Desenvolvimento

```bash
# Apenas Redis
docker-compose up -d redis
npm run dev

# Stack completa (com migrações automáticas)
docker-compose up --build
```

### Com monitoramento

```bash
# Inclui Prometheus + Grafana (com migrações automáticas)
docker-compose up --build
```

**Acessos:**

- API: http://localhost:3000
- Grafana: http://localhost:3001 (admin/admin123)
- Prometheus: http://localhost:9090

## 📊 Monitoramento

### Métricas disponíveis

- **HTTP:** Requests, latência, status codes
- **Negócio:** Análises/hora, palavras processadas, tipos de arquivo
- **OpenAI:** Chamadas de API, custos estimados
- **Sistema:** CPU, memória, disco

### Dashboards Grafana

O projeto inclui dashboards pré-configurados para:

- Overview da API
- Métricas de negócio
- Performance do sistema
- Integração OpenAI

## 🔧 Configuração Avançada

### Cache

```env
CACHE_TTL=7200000          # 2 horas
CACHE_CHECK_PERIOD=600000  # 10 minutos
```

### Rate Limiting

```env
RATE_LIMIT_MAX=100         # Requests por janela
RATE_LIMIT_WINDOW=900000   # 15 minutos
```

### Processamento

```env
QUEUE_CONCURRENCY=2        # Jobs simultâneos
QUEUE_MAX_RETRIES=3        # Tentativas em caso de erro
```

## 🛡️ Segurança

- **Validação rigorosa** com Joi schemas
- **Rate limiting** por IP
- **Headers de segurança** com Helmet
- **Sanitização de input**
- **Validação de MIME types**
- **Cleanup de arquivos temporários**
- **Logs estruturados**

## 🎯 Performance

### Otimizações implementadas

- **Cache inteligente** com chaves baseadas em hash
- **Chunking preservando estrutura jurídica**
- **Processamento assíncrono** para textos grandes
- **Cleanup automático** de arquivos temporários
- **Compressão** de responses
- **Connection pooling** do banco

### Benchmarks aproximados

- Texto simples (<50k): ~200ms
- Análise completa: 1-5s dependendo do tamanho
- Upload de arquivo: 2-10s dependendo do formato
- Cache hit: ~50ms

## 🔍 Troubleshooting

### Problemas comuns

**1. Erro de upload de arquivo**

```bash
# Verificar formatos suportados
curl http://localhost:3000/api/v1/supported-formats
```

**2. OpenAI não funcionando**

- Verificar se `OPENAI_API_KEY` está configurada
- API funciona com análise local como fallback

**3. Redis não conecta**

- Deixar `REDIS_URL` vazio para usar memory queue
- Não impacta funcionalidade, apenas performance

**4. Testes falhando**

```bash
# Limpar banco de teste
rm -f test.db
npm test
```

## 📚 Documentação da API

A documentação completa está disponível em:

- **Swagger UI:** http://localhost:3000/api-docs
- **OpenAPI Spec:** http://localhost:3000/api-docs.json

### Endpoints principais

| Método | Endpoint                      | Descrição                   |
| ------ | ----------------------------- | --------------------------- |
| POST   | `/api/v1/analyze-text`        | Analisa texto direto        |
| POST   | `/api/v1/analyze-file`        | Upload e análise de arquivo |
| GET    | `/api/v1/analysis/:id/status` | Status da análise           |
| GET    | `/api/v1/search-term`         | Busca termo                 |
| GET    | `/api/v1/health`              | Health check                |
| GET    | `/api/v1/supported-formats`   | Formatos suportados         |

## 🏗️ Arquitetura

```
legal-text-analyzer/
├── src/
│   ├── controllers/     # Endpoints da API
│   ├── services/        # Lógica de negócio
│   ├── middleware/      # Validação, segurança, etc.
│   ├── workers/         # Processamento assíncrono
│   ├── routes/          # Definição de rotas
│   ├── types/           # Tipos TypeScript
│   └── config/          # Configurações
├── tests/               # Testes automatizados
├── prisma/              # Schema do banco
├── docs/                # Documentação
└── monitoring/          # Configs Prometheus/Grafana
```

### Fluxo de processamento

1. **Request** → Middleware de validação e segurança
2. **Controller** → Determina processamento síncrono/assíncrono
3. **Service** → Análise do texto (chunking se necessário)
4. **OpenAI** → Análise de sentimento (opcional)
5. **Database** → Armazenamento dos resultados
6. **Response** → Resultado ou status de processamento

## 📈 Roadmap

- [ ] **OCR** para PDFs com imagens
- [ ] **Múltiplos idiomas** além do português
- [ ] **API de webhooks** para notificações
- [ ] **Dashboard web** para visualização
- [ ] **Autenticação** JWT
- [ ] **Multi-tenancy**
- [ ] **Análise de contratos** especializada

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## ⚠️ Limitações

- Processamento de PDFs sem suporte a OCR (apenas texto extraível)
- Análise de sentimento depende da disponibilidade da OpenAI API
- Rate limiting pode impactar uso intensivo
- Tamanho máximo de arquivo limitado a 10MB

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.
