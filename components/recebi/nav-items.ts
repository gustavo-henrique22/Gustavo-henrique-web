import {
  ArrowLeftRight,
  Calculator,
  ChartColumn,
  FileSignature,
  FolderKanban,
  Globe,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  WandSparkles,
} from "lucide-react";
import { APP_PATH } from "@/lib/recebi/config";

export const MAIN_NAV = [
  { href: APP_PATH, label: "Visão geral", icon: LayoutDashboard },
  { href: `${APP_PATH}/assistente`, label: "Assistente", icon: WandSparkles },
  { href: `${APP_PATH}/lancamentos`, label: "Lançamentos", icon: ArrowLeftRight },
  { href: `${APP_PATH}/orcamentos`, label: "Orçamentos", icon: FileSignature },
  { href: `${APP_PATH}/cobrancas`, label: "Cobranças", icon: ReceiptText },
  { href: `${APP_PATH}/clientes`, label: "Clientes", icon: Users },
  { href: `${APP_PATH}/projetos`, label: "Projetos", icon: FolderKanban },
  { href: `${APP_PATH}/horas`, label: "Horas", icon: Timer },
  { href: `${APP_PATH}/relatorios`, label: "Relatórios", icon: ChartColumn },
  { href: `${APP_PATH}/calculadora`, label: "Calculadora", icon: Calculator },
  { href: `${APP_PATH}/pagina`, label: "Minha página", icon: Globe },
];

export const ACCOUNT_NAV = [
  { href: `${APP_PATH}/configuracoes`, label: "Configurações", icon: Settings },
  { href: `${APP_PATH}/plano`, label: "Plano", icon: Sparkles },
];

export const ADMIN_NAV = { href: `${APP_PATH}/admin`, label: "Admin", icon: ShieldCheck };
