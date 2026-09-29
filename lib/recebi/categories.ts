export const INCOME_CATEGORIES = [
  "Projeto",
  "Serviço mensal",
  "Consultoria",
  "Aula ou mentoria",
  "Venda de produto",
  "Reembolso",
  "Outras receitas",
] as const;

export const EXPENSE_CATEGORIES = [
  "Software e assinaturas",
  "Equipamentos",
  "Impostos (DAS, INSS)",
  "Contador",
  "Internet e telefone",
  "Marketing e anúncios",
  "Cursos e livros",
  "Transporte",
  "Alimentação",
  "Coworking e escritório",
  "Taxas bancárias",
  "Terceirizados",
  "Pró-labore / retirada",
  "Outras despesas",
] as const;

export type TransactionType = "receita" | "despesa";

export function categoriesFor(type: TransactionType): readonly string[] {
  return type === "receita" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
