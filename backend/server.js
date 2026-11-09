const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Toda configuração vem de variáveis de ambiente (nada de credenciais no código)
const pool = new Pool({
  host: process.env.DB_HOST || 'database',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const CATEGORIES = ['Sistema', 'Contêineres'];

// [categoria, título, conteúdo]
const SEED = [
  ['Sistema', 'Apresentação do ClassiFiscal',
    'O ClassiFiscal é um sistema de apoio à emissão de notas fiscais para empresas do Simples Nacional, desenvolvido como Trabalho de Conclusão de Curso de Ciência da Computação.\n\nA ideia é ajudar o usuário nas etapas de classificação fiscal, que costumam gerar dúvidas e erros na hora de emitir uma nota.'],
  ['Sistema', 'Problema e objetivo',
    'Problema: classificar corretamente um produto ou serviço exige consultar tabelas extensas (NCM, CFOP, CSOSN, CNAE, LC 116/2003, NBS). Um erro de classificação pode gerar rejeição da nota ou problemas com o fisco.\n\nObjetivo: oferecer um sistema que sugira a classificação a partir da descrição do produto ou serviço e explique o resultado, reduzindo o tempo de consulta e a chance de erro.'],
  ['Sistema', 'Fluxo de NF-e (produtos)',
    '1. O usuário descreve o produto.\n2. O sistema sugere o código NCM por dois buscadores: BM25/TF-IDF (busca textual com sinônimos) e Sentence-Transformers (busca semântica multilíngue).\n3. Com o NCM escolhido, um motor de regras indica o CFOP e o CSOSN adequados à operação.\n4. O resultado completo (NCM + CFOP + CSOSN) pode ser exportado em um único PDF.'],
  ['Sistema', 'Fluxo de NFS-e (serviços)',
    'Para serviços, o caminho é: CNAE → item da LC 116/2003 → código NBS.\n\nO usuário pode partir do CNAE, do item da lista de serviços ou da descrição do serviço. As bases de referência foram importadas de fontes públicas (Receita Federal, tabelas de correspondência e planilha do Anexo VIII).'],
  ['Sistema', 'Outras funcionalidades',
    '• Consulta direta de NCM por código.\n• Classificação em lote: uma lista de produtos classificada de uma só vez, com PDF consolidado.\n• Calculadora de alíquota efetiva e do DAS do Simples Nacional (Anexos I a V, LC 123/2006 e LC 155/2016).\n• Login, cadastro de usuários e troca de senha.'],
  ['Sistema', 'Tecnologias e dados',
    'Backend: Python com Flask (API REST) e autenticação por token.\nFrontend: React com Vite e Tailwind CSS.\nBanco de dados: PostgreSQL (tabelas de NCM, CNAE, LC 116, NBS e usuários).\nBusca: scikit-learn (TF-IDF) e Sentence-Transformers (embeddings).\nRelatórios: ReportLab.'],
  ['Sistema', 'Limitações conhecidas',
    'O sistema é um protótipo acadêmico, não um produto de produção. Não possui testes automatizados, não modela o fator r do Simples Nacional (o usuário escolhe o anexo) e as sessões ficam em memória. Essas limitações estão documentadas e fazem parte dos trabalhos futuros.'],

  ['Contêineres', 'Arquitetura em 3 serviços',
    'Esta página roda em três contêineres, orquestrados com Docker Compose:\n\n• frontend: Nginx servindo HTML/CSS/JS e encaminhando /api para a API.\n• backend: API Node.js/Express com CRUD das seções.\n• database: PostgreSQL 16 (imagem oficial).\n\nFluxo: navegador → frontend (porta 80) → backend (porta 3000) → database (porta 5432).'],
  ['Contêineres', 'Dockerfile',
    'Cada serviço próprio tem o seu Dockerfile.\n\nbackend: parte de node:20-alpine, copia o package.json, instala as dependências de produção, copia o código e roda como usuário não-root.\n\nfrontend: parte de nginx:alpine e copia os arquivos estáticos e a configuração do proxy reverso.'],
  ['Contêineres', 'Docker Compose',
    'O docker-compose.yml define os três serviços, a rede, o volume e as variáveis de ambiente.\n\nO backend só inicia depois que o banco está saudável (depends_on com healthcheck usando pg_isready), e o frontend só inicia depois que a API responde em /api/health.'],
  ['Contêineres', 'Rede entre contêineres',
    'O Compose cria uma rede virtual (app-net). Dentro dela, os serviços se encontram pelo nome: a API conecta no banco usando o host "database" e o Nginx encaminha /api para "backend:3000".\n\nSó o frontend publica porta para fora; o banco e a API não ficam expostos.'],
  ['Contêineres', 'Volume e persistência',
    'O volume nomeado pgdata é montado em /var/lib/postgresql/data. Assim, os dados continuam existindo mesmo que o contêiner do banco seja removido e recriado (docker compose down). Só são apagados com docker compose down -v.'],
  ['Contêineres', 'Variáveis de ambiente',
    'Usuário, senha e nome do banco (DB_USER, DB_PASSWORD, DB_NAME) e a porta do frontend (FRONTEND_PORT) vêm de variáveis de ambiente: arquivo .env localmente e painel de variáveis no Coolify em produção. O repositório traz apenas o .env.example, sem segredos.'],
  ['Contêineres', 'Deploy no servidor (Coolify)',
    'O repositório é conectado ao Coolify como recurso Docker Compose. O Coolify faz o build das imagens, cria a rede e o volume e publica o frontend por domínio, com as variáveis configuradas no painel.'],
];

async function initDb() {
  for (let i = 1; i <= 30; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          category VARCHAR(50) NOT NULL DEFAULT 'Sistema',
          title VARCHAR(200) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      // compatível com bancos criados antes da coluna category
      await pool.query(
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'Sistema'");
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM posts');
      if (rows[0].n === 0) {
        for (const [cat, t, c] of SEED) {
          await pool.query(
            'INSERT INTO posts (category, title, content) VALUES ($1, $2, $3)', [cat, t, c]);
        }
      }
      console.log('Banco pronto.');
      return;
    } catch (err) {
      console.log(`Aguardando banco (${i}/30): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Não foi possível conectar ao banco.');
}

const app = express();
app.use(cors());
app.use(express.json());

const validate = (b) => {
  const title = (b.title || '').toString().trim();
  const content = (b.content || '').toString().trim();
  const category = CATEGORIES.includes(b.category) ? b.category : CATEGORIES[0];
  if (!title || !content || title.length > 200) return null;
  return { title, content, category };
};

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.get('/api/categories', (_req, res) => res.json(CATEGORIES));

app.get('/api/posts', async (req, res, next) => {
  try {
    const { category } = req.query;
    const { rows } = category
      ? await pool.query('SELECT * FROM posts WHERE category = $1 ORDER BY id', [category])
      : await pool.query('SELECT * FROM posts ORDER BY id');
    res.json(rows);
  } catch (e) { next(e); }
});

app.get('/api/posts/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.post('/api/posts', async (req, res, next) => {
  const d = validate(req.body);
  if (!d) return res.status(400).json({ error: 'title e content são obrigatórios' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO posts (category, title, content) VALUES ($1, $2, $3) RETURNING *',
      [d.category, d.title, d.content]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.put('/api/posts/:id', async (req, res, next) => {
  const d = validate(req.body);
  if (!d) return res.status(400).json({ error: 'title e content são obrigatórios' });
  try {
    const { rows } = await pool.query(
      'UPDATE posts SET category = $1, title = $2, content = $3 WHERE id = $4 RETURNING *',
      [d.category, d.title, d.content, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.delete('/api/posts/:id', async (req, res, next) => {
  try {
    const r = await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Não encontrado' });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const port = Number(process.env.PORT || 3000);
initDb()
  .then(() => app.listen(port, () => console.log(`API na porta ${port}`)))
  .catch((e) => { console.error(e); process.exit(1); });
