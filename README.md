# LLM Integration Charts API

NestJS API that uses a local LLM to extract data from text and generate ECharts configurations.

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

## Local Setup

### Option 1: Docker Compose (Recommended)

1**Start all services**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - API server on `http://localhost:3000`
   - PostgreSQL database on `localhost:5432`
   - pgAdmin on `http://localhost:5050`

2**Access pgAdmin** (optional)
   - URL: `http://localhost:5050`
   - Email: `admin@admin.com`
   - Password: `admin`

### Option 2: Manual Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Default `.env` configuration:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_db?schema=public
   ```

3. **Start PostgreSQL database**
   ```bash
   docker-compose up -d db
   ```

4. **Generate Prisma client and sync database**
   ```bash
   npm run prisma:generate
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run start:dev
   ```

   The API will be available at `http://localhost:3000`

## API Usage

### Analyze Text

**POST** `/api/analyze`

Extracts numerical data from text and returns an ECharts chart configuration.

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to analyze (max 1024 chars) |

**Automatic Chart Type Detection:**

The LLM automatically determines the most appropriate chart type based on the text content:

| Type | Description |
|------|-------------|
| `line` | Лінійна діаграма |
| `bar` | Стовпчаста діаграма |
| `bar-grouped` | Згрупована стовпчаста діаграма |
| `pie` | Кругова діаграма |
| `funnel` | Воронкоподібна діаграма |

**Request:**
```json
{
  "text": "Яблука 150, Груші 200, Банани 75"
}
```

**Response:**
```json
{
  "success": true,
  "echartsConfig": {
    "xAxis": {
      "type": "category",
      "data": ["Яблука", "Груші", "Банани"]
    },
    "yAxis": {
      "type": "value"
    },
    "series": [
      {
        "type": "bar",
        "data": [150, 200, 75]
      }
    ]
  }
}
```

**Limitations:**
- Text must be 1024 characters or less
- Processing timeout: 120 seconds

### curl Examples

**Basic request:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Яблука 150, Груші 200, Банани 75"}'
```

**Time-series data (LLM may choose line chart):**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Продажі: 2021 рік 1200, 2022 рік 800, 2023 рік 650"}'
```

**Budget data (LLM may choose pie chart):**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Бюджет: зарплата 50000, оренда 15000, їжа 8000"}'
```

**Funnel data (LLM may choose funnel chart):**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Воронка продажів: відвідувачі 1000, реєстрації 400, покупки 100"}'
```

**Request with formatted output:**
```bash
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Дані: A 10, B 20, C 30"}' | jq
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error message"
}
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server with hot reload |
| `npm run start` | Start production server |
| `npm run build` | Build the application |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations (dev) |
| `npm run prisma:migrate:prod` | Run database migrations (prod) |

## Database Schema

The application uses PostgreSQL with the following tables:

- **Request** - Stores original text requests
- **LLMResult** - Stores raw LLM output
- **FinalResponse** - Stores final chart configuration (JSON)

## Tech Stack

- **Framework:** NestJS
- **Database:** PostgreSQL
- **ORM:** Prisma
- **LLM:** Hugging Face Transformers (Qwen1.5-0.5B-Chat)
