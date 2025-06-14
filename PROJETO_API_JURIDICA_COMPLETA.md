# 🏛️ Instruções Completas: API de Análise de Textos Jurídicos

## 📋 Contexto do Projeto

**Objetivo:** Criar uma API robusta para análise de textos jurídicos com integração de IA, otimizada para documentos grandes (contratos, petições, sentenças) comuns em escritórios de advocacia.

**Diferencial:** Processamento assíncrono para textos grandes, chunking inteligente preservando estrutura jurídica, e análise especializada em terminologia legal.

**Stack Tecnológica:**

- **Backend:** Node.js + Express + TypeScript
- **Banco:** SQLite + Prisma ORM
- **IA:** OpenAI API (GPT-3.5-turbo)
- **Queue:** Bull (Redis opcional, memory fallback)
- **Documentação:** Swagger/OpenAPI
- **Testes:** Jest + Supertest

---

## 🚨 Casos de Erro Específicos para Arquivos

## 🏗️ PASSO 1: Setup Inicial do Projeto

### 1.1 Estrutura de Pastas

Crie a seguinte estrutura:

```
legal-text-analyzer/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   ├── utils/
│   ├── routes/
│   ├── config/
│   ├── types/
│   └── workers/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
├── prisma/
├── **tmp/** (arquivos temporários de upload)
│   ├── uploads/
│   └── extracted/
├── .env.example
├── docker-compose.yml (opcional)
└── README.md
```

### 1.2 Dependências Necessárias

**Produção:**

- express, cors, helmet, morgan, compression
- prisma, @prisma/client, sqlite3
- openai, axios
- joi (validação)
- dotenv
- bull, ioredis (para queue)
- uuid
- swagger-ui-express, swagger-jsdoc

**Desenvolvimento:**

- typescript, @types/node, @types/express
- nodemon, ts-node
- jest, @types/jest, supertest, @types/supertest
- eslint, prettier

### 1.3 Configurações Base

**tsconfig.json:** Configuração TypeScript strict mode, target ES2020

**.env.example:** Incluir todas as variáveis necessárias:

- PORT=3000, NODE_ENV=development
- DATABASE_URL="file:./dev.db"
- OPENAI_API_KEY=your_openai_key_here
- **REDIS_URL=redis://localhost:6379 (OPCIONAL - deixar vazio para usar memory)**
- RATE_LIMIT_MAX=100, RATE_LIMIT_WINDOW=900000
- **MAX_FILE_SIZE=10485760** (10MB em bytes)
- **CLEANUP_INTERVAL=1800000** (30min em ms)
- **METRICS_ENABLED=true** (habilitar/desabilitar métricas)
- **METRICS_PORT=9090** (porta para métricas Prometheus)

**package.json:** Scripts para dev, build, test, migrate

---

## 🗄️ PASSO 2: Modelagem do Banco de Dados

### 2.1 Schema Prisma

Criar modelo **Analysis** com:

- id (String, UUID)
- text (String) - texto completo ou trecho inicial se muito grande
- textLength (Int) - tamanho real do texto
- type (String) - 'legal', 'general'
- **sourceType (String)** - 'text', 'txt', 'pdf', 'docx'
- **originalFilename (String, opcional)** - nome do arquivo original
- **fileSize (Int, opcional)** - tamanho do arquivo em bytes
- status (String) - 'processing', 'completed', 'failed'
- progress (Int) - 0-100%
- result (Json) - resultado da análise quando completo
- error (String, opcional) - mensagem de erro se falhou
- processingTime (Int, opcional) - tempo em ms
- chunksProcessed (Int, opcional)
- createdAt, updatedAt, completedAt, failedAt (DateTime)

Criar modelo **SearchHistory** com:

- id, term, found, analysisId, searchedAt

### 2.2 Relacionamentos

- Analysis 1:N SearchHistory (um análise pode ter várias buscas)

---

## 🛠️ PASSO 3: Serviços Core

### 3.1 LegalTextAnalysisService

**Responsabilidades:**

- Validar entrada (tamanho máximo 2MB, detecção de conteúdo jurídico)
- Chunking inteligente preservando estrutura jurídica:
  - Dividir por artigos (art. 1°, art. 2°)
  - Dividir por parágrafos (§ 1°, § 2°)
  - Dividir por seções numeradas
  - Fallback por parágrafos normais
- Análise básica: contagem de palavras, caracteres, estrutura
- Processamento com EventEmitter para progresso
- Cache inteligente com chave baseada em hash do texto

**Funcionalidades específicas:**

- Stopwords jurídicas (considerando, outrossim, art., etc.)
- Detecção de termos jurídicos importantes
- Análise estrutural (contagem de artigos, parágrafos, incisos)
- Consolidação de resultados de múltiplos chunks

### 3.2 OpenAIService

**Responsabilidades:**

- Integração com OpenAI API
- Rate limiting inteligente
- Retry com exponential backoff
- Controle de tokens (max 4k para GPT-3.5)
- Fallback para análise local se API falhar

**Métodos:**

- analyzeSentiment(text): análise de sentimento
- Optional: summarizeText(text): resumo executivo

### 3.3 QueueService

**Responsabilidades:**

- Gerenciar fila de processamento para textos grandes
- Priorização (textos maiores = prioridade alta)
- Retry automático em caso de falha
- Progress tracking
- Memory-based queue com Bull (Redis opcional)

### 3.4 CacheService

**Responsabilidades:**

- Cache em memória com TTL
- Estratégia LRU para otimizar memória
- Chaves baseadas em hash SHA-256 do texto
- TTL diferenciado (2h para análises completas)

### 3.6 FileProcessingService

**Responsabilidades:**

- Upload e validação de arquivos (TXT, PDF, DOCX)
- Extração de texto de diferentes formatos
- Validação de tipos MIME e extensões
- Limpeza de arquivos temporários
- Detecção de encoding para arquivos TXT
- Tratamento de erros específicos por tipo de arquivo

**Formatos suportados:**

- **TXT:** Leitura direta com detecção de encoding (UTF-8, Latin1)
- **PDF:** Extração com pdf-parse, handling de PDFs protegidos/corrompidos
- **DOCX:** Conversão com mammoth, preservação de estrutura

**Validações:**

- Tamanho máximo: 10MB por arquivo
- Tipos MIME permitidos
- Estrutura válida do arquivo
- Texto extraído não vazio

**Responsabilidades:**

- CRUD para Analysis e SearchHistory
- Queries otimizadas para busca de termos
- Cleanup automático de registros antigos
- Prisma integration

---

## 🎮 PASSO 4: Controllers

### 4.1 AnalysisController

**POST /analyze-text:**

- Validar entrada com Joi
- Detectar se é texto pequeno (<50k) ou grande (>50k)
- Pequeno: processar sincronamente, retornar resultado
- Grande: criar registro no DB, adicionar à queue, retornar 202 com analysisId

**POST /analyze-file:**

- Aceitar upload de arquivos (TXT, PDF, DOCX)
- Validar tipo, tamanho e estrutura do arquivo
- Extrair texto usando FileProcessingService
- Salvar metadados do arquivo original
- Processar como texto (mesmo fluxo do /analyze-text)
- Cleanup de arquivos temporários

**GET /analysis/:id/status:**

- Buscar status no banco
- Retornar progresso, resultado (se completo), ou erro
- Include estimated remaining time
- Incluir informações do arquivo original se aplicável

### 4.2 SearchController

**GET /search-term?term=...:**

- Validar parâmetro term
- Buscar nas análises recentes no banco
- Retornar se encontrado + estatísticas
- Salvar histórico de busca

---

## 🛡️ PASSO 5: Middleware

### 5.1 ValidationMiddleware

**Implementação com Joi:**

**Schema para analyze-text:**

```typescript
const textAnalysisSchema = Joi.object({
  text: Joi.string()
    .required()
    .min(1)
    .max(2000000) // 2MB
    .messages({
      'string.empty': 'Texto não pode estar vazio',
      'string.max': 'Texto não pode exceder 2MB',
      'any.required': 'Campo texto é obrigatório',
    }),
});
```

**Schema para search-term:**

```typescript
const searchTermSchema = Joi.object({
  term: Joi.string()
    .required()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/)
    .messages({
      'string.pattern.base': 'Termo deve conter apenas letras, números, espaços e hífens',
    }),
});
```

**Middleware de validação:**

- Aplicar validação em todos os endpoints
- Retornar erros padronizados em português
- Logging de tentativas de validação inválidas

### 5.2 RateLimitMiddleware

- Rate limiting por IP
- Diferentes limits para endpoints (análise vs status)
- Headers informativos sobre limite

### 5.3 ErrorHandler

- Global error handler
- Logging estruturado
- Response padronizado
- Não vazar stack traces em produção

### 5.4 LoggingMiddleware

- Morgan para HTTP logs
- Structured logging com Winston/Pino
- Request ID tracking
- Performance metrics

### 5.6 FileUploadMiddleware

- Multer configuration para uploads
- Validação de tipos MIME
- Limite de tamanho de arquivo (10MB)
- Storage temporário seguro
- Error handling para uploads inválidos
- Helmet para headers de segurança
- CORS configurado
- Request size limiting
- Input sanitization

---

## ⚙️ PASSO 6: Workers e Jobs

### 6.1 AnalysisWorker

**Responsabilidades:**

- Processar jobs da queue
- Setup de event listeners para progress
- Atualizar banco com progresso e resultado
- Error handling e retry

**Fluxo:**

1. Receber job com analysisId e text
2. Setup listeners para events de progresso
3. Chamar LegalTextAnalysisService.analyzeLegalText()
4. Atualizar banco com resultado ou erro
5. Cleanup listeners

---

## 🛣️ PASSO 7: Routes

### 7.1 Estrutura de Routes

- `/api/v1/analyze-text` (POST) - análise de texto direto
- **`/api/v1/analyze-file` (POST) - upload e análise de arquivos**
- `/api/v1/analysis/:id/status` (GET) - status da análise
- `/api/v1/search-term` (GET) - busca de termos
- `/api/v1/health` (GET) - health check detalhado
- `/api/v1/stats` (GET) - estatísticas da API (opcional)
- **`/api/v1/supported-formats` (GET) - formatos suportados**
- **`/metrics` (GET) - endpoint Prometheus (porta separada 9090)**

### 7.2 Response Patterns

**Sucesso:**

```json
{
  "success": true,
  "data": {
    /* resultado */
  },
  "timestamp": "2025-06-13T...",
  "requestId": "uuid"
}
```

**Erro:**

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-06-13T...",
  "requestId": "uuid"
}
```

**Processamento de arquivo:**

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid",
    "status": "processing",
    "sourceType": "pdf",
    "originalFilename": "contrato.pdf",
    "fileSize": 1048576,
    "extractedTextLength": 25430,
    "estimatedTime": 35,
    "checkStatusUrl": "/api/v1/analysis/uuid/status"
  }
}
```

**Processamento assíncrono (texto direto):**

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid",
    "status": "processing",
    "estimatedTime": 45,
    "checkStatusUrl": "/api/v1/analysis/uuid/status"
  }
}
```

---

## 📊 PASSO 8: Types e Interfaces

### 8.1 Core Types

**LegalAnalysisResult:**

- wordCount, characterCount
- topWords: Array<{word, count}>
- legalTerms: Array<{term, count}>
- sentiment: {overall, sections}
- structure: {paragraphs, articles, sections}
- processingTime, chunksProcessed

**AnalysisJob:**

- analysisId, text, priority, attempts
- **sourceType, originalFilename, fileSize** (para arquivos)

**FileProcessingResult:**

- extractedText, sourceType, originalFilename, fileSize, processingTime
- **encoding** (para TXT), **pageCount** (para PDF), **wordCount** (para DOCX)
- **extractionMethod**, **warnings** (array de avisos)

**ChunkResult:**

- chunkIndex, sentiment, topWords, legalTerms, wordCount, error?

### 8.2 API Types

- ApiResponse<T>
- ErrorResponse
- ValidationError

---

## 🧪 PASSO 9: Testes

### 9.1 Testes Unitários

**LegalTextAnalysisService:**

- Validação de entrada (textos vazios, muito grandes)
- Chunking inteligente preserva estrutura
- Consolidação de resultados
- Cache functionality
- Fallback sentiment analysis

**FileProcessingService (IMPORTANTE - testes específicos):**

- **TXT Processing:**
  - Extração com diferentes encodings (UTF-8, Latin1, UTF-16)
  - Preservação de quebras de linha
  - Handling de arquivos vazios
  - Detecção de arquivos corrompidos
- **PDF Processing:**
  - Extração de texto simples
  - Handling de PDFs protegidos por senha
  - PDFs corrompidos
  - Preservação de estrutura de parágrafos
  - PDFs apenas com imagens
- **DOCX Processing:**
  - Extração de documentos Word padrão
  - Preservação de formatação básica
  - Documentos com elementos complexos (tabelas)
  - Headers e footers
  - Arquivos DOCX corrompidos

**OpenAIService:**

- Rate limiting
- Retry logic
- Error handling
- Token counting

### 9.2 Testes de Integração

**FileProcessingService:**

- Extração de texto de TXT, PDF, DOCX
- Validação de tipos e tamanhos
- Error handling por formato
- Detecção de encoding
- Cleanup de arquivos temporários

**MetricsService:**

- Coleta de métricas customizadas
- Instrumentação de operações críticas
- Health checks detalhados
- Integration com Prometheus

**Controllers:**

- POST /analyze-text com diferentes tamanhos
- **POST /analyze-file com diferentes formatos (TXT, PDF, DOCX)**
- GET /analysis/:id/status
- GET /search-term
- **GET /supported-formats**
- **GET /metrics (Prometheus endpoint)**

**Monitoring Integration:**

- **Métricas HTTP automáticas**
- **Métricas de negócio customizadas**
- **Dashboard Grafana pré-configurado**

**Upload Integration:**

- **Multer middleware funcionando corretamente**
- **Validação de tipos MIME**
- **Cleanup de arquivos temporários**

**Database operations:**

- CRUD completo
- Search functionality
- **Queries específicas para arquivos (por sourceType, filename, etc.)**

### 9.3 Testes E2E

**Fluxo completo:**

- Texto pequeno (síncrono)
- Texto grande (assíncrono) + polling status
- **Upload de PDF e extração de texto**
- **Upload de DOCX e análise**
- **Upload de TXT com encoding especial**
- Search term após análise
- Error scenarios (arquivo corrompido, formato inválido)

### 9.4 Testes de Performance

- Concorrência (100+ requests simultâneas)
- Textos muito grandes (1MB+)
- **Upload de arquivos grandes (8-10MB)**
- **Processamento simultâneo de múltiplos arquivos**
- Memory leaks
- Rate limiting behavior
- **Cleanup eficiente de arquivos temporários**

### 9.6 Testes de Monitoramento

**Testes de Métricas:**

- Verificar coleta de métricas HTTP
- Validar métricas customizadas de negócio
- Testar endpoint /metrics
- Performance de coleta de métricas

**Testes de Health Check:**

- Verificar status de todos os componentes
- Testar cenários de falha
- Validar resposta do health endpoint

**Load Testing com Métricas:**

- Monitorar métricas durante carga
- Verificar alertas automáticos
- Testar dashboards em tempo real

### 9.7 Testes Específicos para Casos de Erro de Arquivos

**Cenários críticos para testar:**

- Upload de arquivo com extensão falsificada (.exe renomeado para .pdf)
- Arquivo corrompido que passa na validação inicial
- PDF protegido por senha
- DOCX criado em versão muito antiga do Word
- TXT com encoding problemático (caracteres especiais)
- Multiple uploads simultâneos do mesmo usuário
- Interrupção de upload no meio do processo
- Disco cheio durante upload
- Arquivo muito grande que passa do limite durante upload

---

## 📝 PASSO 10: Documentação

### 10.1 README.md

**Estrutura:**

- Descrição do projeto
- Características específicas para advocacia
- Requisitos e instalação
- Configuração (.env)
- Execução (dev e prod)
- Exemplos de uso
- API endpoints
- Performance guidelines
- Troubleshooting

### 10.2 Swagger/OpenAPI

**Documentar:**

- Todos os endpoints com exemplos (incluindo /analyze-file)
- Schemas de request/response para texto E arquivos
- **Especificações de upload (Content-Type: multipart/form-data)**
- **Formatos suportados com limitações**
- Códigos de erro específicos para upload
- Rate limiting info
- Authentication (se aplicável)
- **Exemplos de curl para cada tipo de arquivo**

### 10.3 Arquitetura

**Incluir:**

- Diagrama de arquitetura
- Fluxo de processamento
- Decisões técnicas
- Trade-offs considerados
- Escalabilidade considerations

---

## 🚀 PASSO 11: Deployment e DevOps

### 11.1 Docker (RECOMENDADO para produção)

**Dockerfile multi-stage:**

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1
CMD ["npm", "start"]
```

**docker-compose.yml (COMPLETO - com monitoramento):**

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '3000:3000'
      - '9090:9090' # Métricas Prometheus
    environment:
      - NODE_ENV=development
      - DATABASE_URL=file:./dev.db
      - REDIS_URL=redis://redis:6379
      - METRICS_ENABLED=true
    volumes:
      - ./tmp:/app/tmp
    depends_on:
      - redis
      - prometheus

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3001:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus

volumes:
  redis_data:
  prometheus_data:
  grafana_data:
```

**IMPORTANTE:**

- Docker é OPCIONAL para o desafio
- A aplicação deve funcionar perfeitamente SEM Docker
- Redis é OPCIONAL - usar memory fallback se não disponível

### 11.2 Scripts de Deployment

**npm scripts essenciais:**

- `npm run build`: Compilar TypeScript para produção
- `npm run start`: Executar versão compilada (produção)
- `npm run dev`: Desenvolvimento com nodemon + ts-node
- `npm run test`: Executar todos os testes (Jest)
- `npm run test:watch`: Testes em modo watch
- `npm run migrate`: Executar Prisma migrations
- `npm run generate`: Gerar Prisma client
- `npm run lint`: ESLint check
- `npm run format`: Prettier format

**Scripts Docker (completos):**

- `npm run docker:build`: Build da imagem
- `npm run docker:up`: docker-compose up
- `npm run docker:down`: docker-compose down
- **`npm run docker:monitoring`: docker-compose up com Grafana/Prometheus**
- **`npm run docker:logs`: Ver logs de todos os serviços**

---

## ✅ PASSO 12: Checklist de Qualidade

### 12.1 Funcionalidade

- [ ] Todos endpoints funcionando
- [ ] Processamento síncrono para textos pequenos
- [ ] Processamento assíncrono para textos grandes
- [ ] **Upload de arquivos TXT, PDF, DOCX funcionando**
- [ ] **Extração de texto preservando estrutura jurídica**
- [ ] **Validação rigorosa de tipos de arquivo**
- [ ] **Cleanup automático de arquivos temporários**
- [ ] Progress tracking funcionando
- [ ] Search functionality
- [ ] Error handling robusto para todos os cenários

### 12.2 Performance

- [ ] Response time <200ms para análise simples
- [ ] Chunking otimizado preserva estrutura
- [ ] Cache funcionando corretamente
- [ ] Rate limiting efetivo
- [ ] Memory usage controlado

### 12.3 Qualidade do Código

- [ ] TypeScript strict mode
- [ ] ESLint/Prettier configurados
- [ ] Cobertura de testes >85%
- [ ] Logging estruturado
- [ ] Error handling padronizado

### 12.4 Segurança

- [ ] Input validation rigorosa (texto E arquivos)
- [ ] **Validação de MIME types com verificação de header**
- [ ] **Sanitização de nomes de arquivo**
- [ ] **Prevenção de path traversal em uploads**
- [ ] Rate limiting implementado
- [ ] Headers de segurança (Helmet)
- [ ] **Limite de uploads simultâneos por IP**
- [ ] Secrets em environment variables
- [ ] SQL injection prevention (Prisma ORM)
- [ ] **Cleanup seguro de arquivos temporários**

### 12.6 Monitoramento e Observabilidade

- [ ] **Métricas Prometheus coletadas corretamente**
- [ ] **Endpoint /metrics funcionando (porta 9090)**
- [ ] **Grafana dashboard configurado**
- [ ] **Métricas de negócio implementadas**
- [ ] **Health check detalhado com componentes**
- [ ] **Alertas básicos configurados**
- [ ] **Logs estruturados com correlação**
- [ ] **Performance tracking de operações críticas**

### 12.7 Documentação

- [ ] README completo com exemplos
- [ ] Swagger documentation
- [ ] **Documentação de métricas e dashboards**
- [ ] Code comments em pontos críticos
- [ ] Architecture decisions documented
- [ ] **Guia de monitoramento e alertas**

---

## 🎯 Requisitos Específicos do Desafio

### ✅ Obrigatórios Implementados

- [x] **POST /analyze-text** com JSON `{"text": "..."}`
- [x] **Contagem de palavras** otimizada para textos grandes
- [x] **5 palavras mais frequentes** ignorando stopwords jurídicas
- [x] **Integração OpenAI** para análise de sentimento
- [x] **GET /search-term** com histórico em SQLite

### 🎁 Diferenciais Implementados

- [x] **POST /analyze-file** - Upload de TXT, PDF, DOCX
- [x] **Processamento assíncrono** para textos grandes
- [x] **Progress tracking** em tempo real
- [x] **Chunking inteligente** preservando estrutura jurídica
- [x] **Análise especializada** em terminologia legal
- [x] **Cache otimizado** para reduzir custos de API
- [x] **Testes abrangentes** (unit, integration, e2e)
- [x] **Documentação Swagger** completa
- [x] **TypeScript** para maior robustez
- [x] **Error handling** enterprise-grade
- [x] **Suporte multi-formato** com extração inteligente

---

## 🏁 Resultado Esperado

Uma API profissional que demonstra **senioridade técnica** através de:

1. **Arquitetura escalável** - suporta textos de qualquer tamanho
2. **Especialização de domínio** - otimizada para textos jurídicos
3. **Performance otimizada** - cache, chunking, processamento assíncrono
4. **Observabilidade completa** - métricas, logs, dashboards, alertas
5. **Qualidade enterprise** - testes, documentação, error handling
6. **Experiência do usuário** - feedback de progresso, status claro
7. **Monitoramento profissional** - Grafana + Prometheus + alertas

**Tempo de desenvolvimento estimado:** 18-22 horas (incluindo monitoramento)

**Deploy final:** Enviar para **vagas+dev@arbitralis.com.br** com:

- Código fonte completo
- README com instruções de setup
- Documentação da API
- **Dashboard Grafana configurado**
- **Métricas de monitoramento**
- Exemplos de uso
- Decisões arquiteturais justificadas

---

## 💡 Dicas de Implementação

1. **Comece simples:** Implemente primeiro o fluxo síncrono de texto, depois adicione assíncrono
2. **Upload incremental:** Implemente TXT primeiro, depois PDF, depois DOCX
3. **Redis é opcional:** Configure para funcionar com e sem Redis
4. **Joi validation:** Use schemas detalhados para validação robusta
5. **Monitoramento gradual:** Core primeiro, métricas depois
6. **Teste cada formato:** Use arquivos reais durante desenvolvimento
7. **Monitore arquivos temporários:** Implemente logging de criação/limpeza
8. **Use exemplos reais:** Teste com textos jurídicos reais durante desenvolvimento
9. **Monitore custos:** Implemente logging de uso da OpenAI API
10. **Pense em produção:** Configure logging, error handling, e health checks desde o início
11. **Grafana é bonus:** Foque primeiro na funcionalidade, dashboard depois

---

## 🔧 Configurações Específicas

### Implementação de Métricas

**Setup básico do prom-client:**

```typescript
import promClient from 'prom-client';
import promBundle from 'express-prom-bundle';

// Métricas HTTP automáticas
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'legal-text-api' },
  promClient: {
    collectDefaultMetrics: {
      timeout: 1000,
    },
  },
});

app.use(metricsMiddleware);
```

**Servidor de métricas separado:**

```typescript
// Servidor separado para métricas (porta 9090)
const metricsServer = express();
metricsServer.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});

metricsServer.listen(9090, () => {
  console.log('Metrics server running on port 9090');
});
```

### Joi Validation Examples

**Validação de arquivo upload:**

```typescript
const fileValidationSchema = Joi.object({
  fieldname: Joi.string().valid('file').required(),
  originalname: Joi.string().required(),
  mimetype: Joi.string()
    .valid(
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    .required(),
  size: Joi.number().max(10485760).required(), // 10MB
});
```

### Bull Queue Configuration

**Com Redis:**

```typescript
const queue = new Bull('legal-analysis', {
  redis: {
    port: 6379,
    host: 'localhost',
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: 'exponential',
  },
});
```

**Sem Redis (Fallback):**

```typescript
// Processamento direto sem queue
// Usar EventEmitter para progress tracking
// Implementar retry manual
```

### Docker Commands

**Desenvolvimento:**

```bash
# Sem Redis (mais simples)
npm run dev

# Com Redis via Docker
docker-compose up -d redis
npm run dev

# Full Docker stack
docker-compose up --build
```

**Produção:**

```bash
# Build da aplicação
npm run build

# Executar
npm start

# Ou com Docker
docker build -t legal-api .
docker run -p 3000:3000 legal-api
```

---

## 📁 Estrutura de Arquivos Temporários

```
tmp/
├── uploads/                    # Arquivos enviados pelos usuários
│   ├── 1623456789123_contrato.pdf
│   ├── 1623456789456_peticao.docx
│   └── 1623456789789_lei.txt
└── extracted/                  # Cache de textos extraídos (opcional)
    ├── hash_contrato.txt
    ├── hash_peticao.txt
    └── hash_lei.txt
```

**Política de Limpeza:**

- Arquivos removidos imediatamente após processamento bem-sucedido
- Cleanup de arquivos órfãos após 1 hora
- Log de todas as operações de limpeza
- Rotina de limpeza executada a cada 30 minutos

## 📊 PASSO 13: Monitoramento e Observabilidade (OPCIONAL - Diferencial Sênior)

### 13.1 Configuração do Prometheus

**Arquivo `monitoring/prometheus.yml`:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'legal-text-api'
    static_configs:
      - targets: ['app:9090']
    scrape_interval: 5s
    metrics_path: '/metrics'
```

### 13.2 Métricas Customizadas

**Implementar no MetricsService:**

**Business Metrics:**

```typescript
// Análises de texto
const textAnalysisCounter = new promClient.Counter({
  name: 'text_analysis_total',
  help: 'Total number of text analyses performed',
  labelNames: ['source_type', 'status'],
});

const textAnalysisDuration = new promClient.Histogram({
  name: 'text_analysis_duration_seconds',
  help: 'Duration of text analysis in seconds',
  labelNames: ['source_type', 'text_size_category'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
});

const wordsProcessed = new promClient.Counter({
  name: 'words_processed_total',
  help: 'Total number of words processed',
  labelNames: ['source_type'],
});

// OpenAI API
const openaiCalls = new promClient.Counter({
  name: 'openai_api_calls_total',
  help: 'Total calls to OpenAI API',
  labelNames: ['operation', 'status'],
});

const openaiDuration = new promClient.Histogram({
  name: 'openai_api_duration_seconds',
  help: 'OpenAI API call duration',
  labelNames: ['operation'],
  buckets: [0.5, 1, 2, 5, 10, 15, 30],
});

// File Processing
const fileUploads = new promClient.Counter({
  name: 'file_uploads_total',
  help: 'Total file uploads',
  labelNames: ['file_type', 'status'],
});

const fileProcessingDuration = new promClient.Histogram({
  name: 'file_processing_duration_seconds',
  help: 'File processing duration',
  labelNames: ['file_type', 'file_size_category'],
});
```

### 13.3 Dashboards Grafana

**Arquivo `monitoring/grafana/dashboards/legal-api-dashboard.json`:**

**Painéis principais:**

1. **Overview**

   - Total requests/min
   - Response time percentiles
   - Error rate
   - Active analyses

2. **Business Metrics**

   - Analyses per hour
   - Words processed
   - File uploads by type
   - Legal terms detected

3. **OpenAI Integration**

   - API calls/min
   - API latency
   - API errors
   - Token usage

4. **System Health**

   - Memory usage
   - CPU usage
   - Disk usage
   - Queue length

5. **File Processing**
   - Upload success rate
   - Processing time by file type
   - Temporary files count

### 13.4 Alertas Básicos

**Arquivo `monitoring/alerts.yml`:**

```yaml
groups:
  - name: legal-api-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'

      - alert: OpenAIAPIDown
        expr: rate(openai_api_calls_total{status="error"}[5m]) > 0.5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'OpenAI API experiencing issues'

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: 'High response time detected'
```

### 13.5 Health Check Detalhado

**Endpoint `/api/v1/health` expandido:**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-13T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": "12ms",
      "lastChecked": "2025-06-13T10:29:58Z"
    },
    "openai": {
      "status": "healthy",
      "responseTime": "234ms",
      "lastChecked": "2025-06-13T10:29:59Z"
    },
    "redis": {
      "status": "healthy",
      "responseTime": "3ms",
      "lastChecked": "2025-06-13T10:29:59Z"
    },
    "queue": {
      "status": "healthy",
      "pendingJobs": 2,
      "completedJobs": 157,
      "failedJobs": 3
    },
    "fileSystem": {
      "status": "healthy",
      "tempFiles": 0,
      "diskUsage": "23%"
    }
  },
  "metrics": {
    "totalAnalyses": 1543,
    "analysesToday": 89,
    "averageResponseTime": "1.2s",
    "cacheHitRate": "78%"
  }
}
```

### 13.6 Implementação de Instrumentação

**Decorador para instrumentar métodos:**

```typescript
function instrument(metricName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const timer = metricsService.startTimer(metricName);
      try {
        const result = await method.apply(this, args);
        timer.end({ status: 'success' });
        return result;
      } catch (error) {
        timer.end({ status: 'error' });
        throw error;
      }
    };
  };
}

// Uso:
class LegalTextAnalysisService {
  @instrument('text_analysis_duration')
  async analyzeText(text: string): Promise<AnalysisResult> {
    // implementação
  }
}
```

### 13.7 Configuração de Acesso

**URLs de Acesso:**

- **API:** http://localhost:3000
- **Métricas:** http://localhost:9090/metrics
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3001 (admin/admin123)

### 13.8 Scripts de Setup

**Comandos para monitoramento:**

```bash
# Setup completo com monitoramento
npm run docker:monitoring

# Verificar métricas
curl http://localhost:9090/metrics

# Acessar Grafana
open http://localhost:3001

# Ver logs de todos os serviços
npm run docker:logs
```

---

## 📊 Métricas de Negócio Sugeridas

### KPIs Principais

1. **Throughput:** Análises por hora
2. **Latência:** Tempo médio de processamento
3. **Qualidade:** Taxa de sucesso na extração
4. **Utilização:** Tipos de arquivo mais processados
5. **Eficiência:** Cache hit rate
6. **Custo:** Tokens OpenAI utilizados

### Alertas Críticos

1. **API fora do ar** (>5% error rate)
2. **OpenAI indisponível** (>50% failures)
3. **Processamento lento** (>2s p95)
4. **Fila congestionada** (>100 jobs pending)
5. **Disco cheio** (>90% usage)

---

### Códigos de Erro Padronizados

```typescript
// Erros de Upload
FILE_TOO_LARGE: 'Arquivo muito grande (máximo 10MB)';
INVALID_FILE_TYPE: 'Tipo de arquivo não suportado (.txt, .pdf, .docx apenas)';
UPLOAD_FAILED: 'Erro durante upload do arquivo';
INVALID_MIME_TYPE: 'Tipo MIME não corresponde à extensão';

// Erros de Processamento
TEXT_EXTRACTION_FAILED: 'Falha na extração de texto';
CORRUPTED_FILE: 'Arquivo corrompido ou inválido';
PASSWORD_PROTECTED_PDF: 'PDF protegido por senha não é suportado';
EMPTY_FILE: 'Arquivo não contém texto válido';
ENCODING_ERROR: 'Erro de codificação de caracteres';
UNSUPPORTED_PDF_VERSION: 'Versão do PDF não suportada';
DOCX_STRUCTURE_ERROR: 'Estrutura do documento Word inválida';

// Erros de Sistema
DISK_FULL: 'Espaço em disco insuficiente';
TEMP_FILE_ERROR: 'Erro ao criar arquivo temporário';
CLEANUP_FAILED: 'Falha na limpeza de arquivos temporários';
```

### Tratamento de Erros com Context

```json
{
  "success": false,
  "error": "Falha na extração de texto do PDF",
  "code": "TEXT_EXTRACTION_FAILED",
  "details": {
    "filename": "contrato.pdf",
    "fileSize": 1048576,
    "possibleCauses": [
      "PDF protegido por senha",
      "PDF corrompido",
      "PDF apenas com imagens (OCR necessário)"
    ]
  },
  "suggestions": [
    "Verifique se o PDF não está protegido",
    "Tente converter para TXT primeiro",
    "Consulte /api/v1/supported-formats para limitações"
  ],
  "supportUrl": "/api/v1/supported-formats"
}
```

---

## 🎯 Exemplos de Uso Completos

### Exemplo 1: Upload de PDF

```bash
curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@contrato_locacao.pdf" \
  -H "Content-Type: multipart/form-data"
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid-123",
    "sourceType": "pdf",
    "originalFilename": "contrato_locacao.pdf",
    "fileSize": 524288,
    "extractedTextLength": 15420,
    "wordCount": 2156,
    "topWords": [
      { "word": "locatário", "count": 23 },
      { "word": "imóvel", "count": 18 }
    ],
    "legalTerms": [
      { "term": "rescisão", "count": 8 },
      { "term": "fiador", "count": 5 }
    ],
    "structure": {
      "paragraphs": 45,
      "articles": 12,
      "sections": 3
    },
    "processingTime": 3200
  }
}
```

### Exemplo 2: Upload de DOCX Grande (Assíncrono)

```bash
curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@peticao_inicial.docx"
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid-456",
    "status": "processing",
    "sourceType": "docx",
    "originalFilename": "peticao_inicial.docx",
    "fileSize": 2097152,
    "extractedTextLength": 87340,
    "estimatedTime": 65,
    "progress": 0,
    "checkStatusUrl": "/api/v1/analysis/uuid-456/status"
  }
}
```

### Exemplo 3: Verificar Status

```bash
curl http://localhost:3000/api/v1/analysis/uuid-456/status
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid-456",
    "status": "completed",
    "progress": 100,
    "sourceType": "docx",
    "originalFilename": "peticao_inicial.docx",
    "result": {
      "wordCount": 12430,
      "topWords": [...],
      "legalTerms": [...],
      "sentiment": {...}
    },
    "processingTime": 42000,
    "completedAt": "2025-06-13T10:35:00Z"
  }
}
```

**Sucesso no projeto! 🚀**
