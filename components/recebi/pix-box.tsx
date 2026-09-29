import { buildPixPayload, pixQrSvg } from "@/lib/recebi/pix";
import { formatMoney } from "@/lib/recebi/money";
import { CopyButton } from "./copy-button";

/** QR Code + Pix copia e cola para pagar uma cobrança. */
export function PixBox({
  pixKey,
  name,
  city,
  amountCents,
  reference,
}: {
  pixKey: string;
  name: string;
  city: string;
  amountCents: number;
  reference: string;
}) {
  const payload = buildPixPayload({ key: pixKey, name, city, amountCents, txid: reference });
  const svg = pixQrSvg(payload);
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs" aria-labelledby="pix-title">
      <h2 id="pix-title" className="text-lg font-extrabold">
        Pague com Pix
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Abra o app do seu banco, escolha <strong>Pix → Ler QR Code</strong> ou use o código copia e cola.
      </p>
      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[200px_1fr]">
        <div
          className="mx-auto w-48 overflow-hidden rounded-xl border bg-white p-2 sm:w-full [&_svg]:h-auto [&_svg]:w-full"
          role="img"
          aria-label={`QR Code Pix de ${formatMoney(amountCents)}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="grid gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="text-2xl font-extrabold tabular">{formatMoney(amountCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pix copia e cola</p>
            <p className="mt-1 max-h-20 overflow-auto rounded-lg bg-muted p-2 font-mono text-[0.7rem] break-all">{payload}</p>
          </div>
          <CopyButton value={payload} label="Copiar código Pix" copiedLabel="Código copiado!" size="lg" />
          <p className="text-xs text-muted-foreground">
            Recebedor: <strong className="text-foreground">{name}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
