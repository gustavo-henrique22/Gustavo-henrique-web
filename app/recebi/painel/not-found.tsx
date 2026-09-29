import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_PATH } from "@/lib/recebi/config";

export default function NotFound() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </span>
      <h1 className="text-lg font-bold">Não encontramos o que você procura</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">O item pode ter sido excluído ou o link está incorreto.</p>
      <Button asChild className="mt-5">
        <Link href={APP_PATH}>Voltar para o painel</Link>
      </Button>
    </div>
  );
}
