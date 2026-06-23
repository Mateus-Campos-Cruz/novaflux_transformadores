-- Habilitar extensão de UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  senha_hash VARCHAR NOT NULL,
  perfil VARCHAR NOT NULL CHECK (perfil IN ('administrador', 'almoxarife', 'engenharia', 'compras')),
  ativo BOOLEAN DEFAULT TRUE,
  tentativas_login INT DEFAULT 0,
  bloqueado_ate TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE MATERIAIS
CREATE TABLE IF NOT EXISTS materiais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR UNIQUE NOT NULL,
  grupo VARCHAR NOT NULL,
  descricao TEXT NOT NULL,
  unidade VARCHAR(10) NOT NULL,
  quantidade_fisica DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  peso_unitario DECIMAL(15,3),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE PROJETOS
CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_projeto VARCHAR UNIQUE NOT NULL,
  nome VARCHAR NOT NULL,
  descricao TEXT,
  status VARCHAR NOT NULL CHECK (status IN ('planejamento', 'reserva_ativa', 'em_producao', 'encerrado')),
  criado_por UUID REFERENCES usuarios(id),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE LISTA TÉCNICA DE MATERIAIS DOS PROJETOS
CREATE TABLE IF NOT EXISTS lista_materiais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID REFERENCES projetos(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materiais(id),
  quantidade_necessaria DECIMAL(15,3) NOT NULL CHECK (quantidade_necessaria > 0),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE RESERVAS
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID REFERENCES projetos(id),
  material_id UUID REFERENCES materiais(id),
  quantidade_reservada DECIMAL(15,3) NOT NULL CHECK (quantidade_reservada > 0),
  status VARCHAR NOT NULL CHECK (status IN ('ativa', 'liberada', 'cancelada')),
  reservado_por UUID REFERENCES usuarios(id),
  reservado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  liberado_em TIMESTAMP,
  motivo_cancelamento TEXT
);

-- 6. TABELA DE MOVIMENTAÇÕES
CREATE TABLE IF NOT EXISTS movimentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES materiais(id),
  tipo VARCHAR NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade DECIMAL(15,3) NOT NULL,
  motivo TEXT NOT NULL,
  projeto_id UUID REFERENCES projetos(id),
  realizado_por UUID REFERENCES usuarios(id),
  realizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR NOT NULL,
  tabela_afetada VARCHAR NOT NULL,
  registro_id UUID,
  detalhe TEXT,
  realizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_origem VARCHAR
);

-- Criar índices para consultas frequentes e rápidas
CREATE INDEX IF NOT EXISTS idx_materiais_codigo ON materiais(codigo);
CREATE INDEX IF NOT EXISTS idx_projetos_codigo ON projetos(codigo_projeto);
CREATE INDEX IF NOT EXISTS idx_reservas_projeto ON reservas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_material ON reservas(material_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_material ON movimentacoes(material_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id);
