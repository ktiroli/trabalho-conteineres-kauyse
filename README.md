# ClassiFiscal – Documentação do TCC em contêineres

Página que apresenta a documentação do TCC (sistema de apoio à emissão de notas fiscais para o Simples Nacional). Cada seção é guardada no banco e pode ser criada, editada e excluída pela página.

Aplicação com 3 contêineres: **frontend** (Nginx + HTML/CSS/JS), **backend** (Node.js/Express, CRUD de seções) e **database** (PostgreSQL 16).

```
Navegador ──> frontend (nginx:80) ──/api──> backend (:3000) ──> database (postgres:5432)
                                  rede app-net      volume pgdata
```

## Conceitos demonstrados
- **Dockerfile**: `frontend/Dockerfile` e `backend/Dockerfile`
- **Compose**: `docker-compose.yml` (3 serviços, healthchecks, depends_on)
- **Rede**: a API acessa o banco por `database`; o Nginx acessa a API por `backend`
- **Volume**: `pgdata` persiste os dados do Postgres
- **Variáveis de ambiente**: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `FRONTEND_PORT` (veja `.env.example`)

## Rodar localmente
```bash
cp .env.example .env
docker compose up -d --build
```
Acesse http://localhost:8080

## API
| Método | Rota | Descrição |
|---|---|---|
| GET | /api/posts | lista |
| GET | /api/posts/:id | detalhe |
| POST | /api/posts | cria `{title, content}` |
| PUT | /api/posts/:id | atualiza |
| DELETE | /api/posts/:id | remove |
| GET | /api/health | status |

## Deploy no Coolify
1. Suba este repositório no GitHub.
2. Coolify → **New Resource** → repositório Git → Build Pack **Docker Compose** (arquivo `docker-compose.yml`).
3. Em **Environment Variables**, defina `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
4. No serviço `frontend`, configure o domínio com porta `80` (ex.: `https://docs.seudominio.com:80`) e faça **Deploy**.
