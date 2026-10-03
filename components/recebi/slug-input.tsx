"use client";

import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/recebi/slug";

/** Campo do endereço da página: ajusta para letras minúsculas, números e hífens ao sair do campo. */
export function SlugInput(props: Omit<React.ComponentProps<typeof Input>, "onBlur">) {
  return (
    <Input
      {...props}
      onBlur={(event) => {
        event.currentTarget.value = slugify(event.currentTarget.value);
      }}
    />
  );
}
