# 📚 Exemplos de Uso - Legal Text Analyzer API

## 🚀 Como Executar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco de dados
npm run generate
npm run migrate

# 3. Configurar variáveis (.env)
cp .env.example .env
# Editar OPENAI_API_KEY se desejado

# 4. Executar em desenvolvimento
npm run dev

# Ou em produção
npm run build
npm start
```

## 🔗 Endpoints Disponíveis

- **API**: http://localhost:3000
- **Documentação**: http://localhost:3000/api-docs
- **Health**: http://localhost:3000/api/v1/health
- **Métricas**: http://localhost:9090/metrics

## 📝 Exemplos Práticos

### 1. Análise de Texto Simples

```bash
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Pelo presente instrumento particular de contrato de locação, o LOCADOR compromete-se a locar ao LOCATÁRIO o imóvel descrito neste contrato, mediante as cláusulas e condições a seguir estabelecidas."
  }'
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "wordCount": 28,
    "characterCount": 175,
    "topWords": [
      { "word": "contrato", "count": 2 },
      { "word": "locação", "count": 1 },
      { "word": "locador", "count": 1 },
      { "word": "locatário", "count": 1 },
      { "word": "imóvel", "count": 1 }
    ],
    "legalTerms": [
      { "term": "contrato", "count": 2 },
      { "term": "locador", "count": 1 },
      { "term": "locatário", "count": 1 }
    ],
    "sentiment": {
      "overall": "neutro",
      "score": 0,
      "analysis": "Análise realizada com método local (OpenAI não disponível)"
    },
    "structure": {
      "paragraphs": 1,
      "articles": 0,
      "sections": 0
    },
    "processingTime": 45
  }
}
```

### 2. Upload de Arquivo TXT

```bash
echo "CONTRATO DE PRESTAÇÃO DE SERVIÇOS

Art. 1º O CONTRATADO se obriga a prestar os serviços conforme especificado.

Art. 2º O CONTRATANTE se compromete ao pagamento conforme cláusulas.

§ 1º O pagamento será efetuado mensalmente.
§ 2º O atraso será sujeito a multa." > contrato.txt

curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@contrato.txt"
```

### 3. Busca de Termos

```bash
# Buscar por "contrato"
curl "http://localhost:3000/api/v1/search-term?term=contrato"

# Buscar por "locação"
curl "http://localhost:3000/api/v1/search-term?term=locação"
```

### 4. Verificar Formatos Suportados

```bash
curl http://localhost:3000/api/v1/supported-formats
```

### 5. Health Check Detalhado

```bash
curl http://localhost:3000/api/v1/health | jq
```

### 6. Estatísticas da API

```bash
curl http://localhost:3000/api/v1/stats | jq
```

## 🧪 Testando com Diferentes Cenários

### Texto Pequeno (Processamento Síncrono)

```bash
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Contrato simples de teste."}'
```

### Texto Grande (Processamento Assíncrono)

```bash
# Criar texto grande
TEXT=$(printf 'Este é um contrato de locação muito detalhado. %.0s' {1..2000})

curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEXT\"}"

# Resposta será 202 com analysisId para acompanhar
```

### Verificar Status de Análise Assíncrona

```bash
# Substituir UUID pelo ID retornado na requisição anterior
curl http://localhost:3000/api/v1/analysis/550e8400-e29b-41d4-a716-446655440000/status
```

## 🐳 Docker

### Executar com Docker

```bash
# Build e execução
docker-compose up --build

# Apenas Redis (desenvolvimento)
docker-compose up -d redis
npm run dev

# Com monitoramento completo
npm run docker:monitoring
```

**Acessos:**

- API: http://localhost:3000
- Grafana: http://localhost:3001 (admin/admin123)
- Prometheus: http://localhost:9090

## 🎯 Casos de Uso Reais

### 1. Análise de Contrato de Locação

```bash
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "CONTRATO DE LOCAÇÃO RESIDENCIAL\n\nArt. 1º - DO OBJETO\nO presente contrato tem por objeto a locação do imóvel residencial situado na Rua das Flores, nº 123.\n\nArt. 2º - DO PRAZO\nO prazo de locação é de 30 (trinta) meses.\n\nArt. 3º - DO VALOR\nO valor mensal do aluguel é de R$ 1.500,00.\n\n§ 1º O reajuste será anual pelo IGPM.\n§ 2º O pagamento deverá ser efetuado até o dia 10."
  }'
```

### 2. Análise de Petição

```bash
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO\n\nFULANO DE TAL, brasileiro, casado, advogado, inscrito na OAB/SP sob nº 123.456, com escritório na Rua do Direito, nº 789, vem, respeitosamente, perante Vossa Excelência, propor a presente AÇÃO DE COBRANÇA em face de SICRANO DE TAL, pelos motivos de fato e de direito a seguir expostos."
  }'
```

## 🔍 Validações e Erros

### Texto Inválido

```bash
# Texto vazio
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": ""}'
# Retorna 400 - Validation Error

# Campo ausente
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{}'
# Retorna 400 - Campo obrigatório
```

### Arquivo Inválido

```bash
# Arquivo muito grande (>10MB)
dd if=/dev/zero of=large.txt bs=1M count=15
curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@large.txt"
# Retorna 400 - Arquivo muito grande

# Tipo não suportado
echo "test" > test.exe
curl -X POST http://localhost:3000/api/v1/analyze-file \
  -F "file=@test.exe"
# Retorna 400 - Tipo não suportado
```

### Busca Inválida

```bash
# Termo muito curto
curl "http://localhost:3000/api/v1/search-term?term=a"
# Retorna 400 - Termo deve ter pelo menos 2 caracteres

# Caracteres inválidos
curl "http://localhost:3000/api/v1/search-term?term=test<script>"
# Retorna 400 - Caracteres inválidos
```

## 📊 Monitoramento

### Métricas Prometheus

```bash
# Ver todas as métricas
curl http://localhost:9090/metrics

# Métricas específicas do negócio
curl http://localhost:9090/metrics | grep text_analysis

# Status da aplicação
curl http://localhost:9090/metrics | grep nodejs
```

### Logs Estruturados

```bash
# Monitorar logs em tempo real
tail -f logs/combined.log | jq

# Filtrar apenas erros
tail -f logs/error.log
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes específicos
npm run test:unit
npm run test:integration

# Com cobertura
npm run test:coverage

# Watch mode durante desenvolvimento
npm run test:watch
```

## 🔧 Personalização

### Configurar OpenAI

```bash
# Adicionar chave da OpenAI no .env
echo "OPENAI_API_KEY=sk-..." >> .env

# Testar análise de sentimento mais avançada
curl -X POST http://localhost:3000/api/v1/analyze-text \
  -H "Content-Type: application/json" \
  -d '{"text": "Este contrato é extremamente favorável ao locatário."}'
```

### Configurar Redis

```bash
# Instalar Redis
# brew install redis (macOS)
# sudo apt install redis (Ubuntu)

# Configurar no .env
echo "REDIS_URL=redis://localhost:6379" >> .env

# A aplicação detectará automaticamente e usará Redis para queue
```

---

## 📞 Suporte

- **Email**: vagas+dev@arbitralis.com.br
- **Documentação**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/v1/health
