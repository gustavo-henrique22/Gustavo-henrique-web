"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCategoryRule } from "@/lib/recebi/actions/statement";
import { categoriesFor, type TransactionType } from "@/lib/recebi/categories";
import { FormField, Select } from "./fields";
import { FormDialog } from "./form-dialog";

function RuleFields() {
  const [type, setType] = useState<TransactionType>("despesa");
  return (
    <>
      <FormField id="rule-pattern" label="Quando a descrição tiver" hint="Não diferencia maiúsculas nem acentos. Ex.: uber, adobe, ifood">
        <Input id="rule-pattern" name="pattern" required minLength={3} maxLength={60} placeholder="Ex.: uber" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="rule-type" label="Tipo">
          <Select id="rule-type" name="type" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </Select>
        </FormField>
        <FormField id="rule-category" label="Usar a categoria">
          <Select id="rule-category" name="category" key={type} defaultValue={categoriesFor(type)[0]}>
            {categoriesFor(type).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </>
  );
}

export function NewRuleButton() {
  return (
    <FormDialog
      title="Nova regra automática"
      description="Nas próximas importações, transações com esse texto já chegam com a categoria certa."
      action={saveCategoryRule}
      submitLabel="Criar regra"
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> Nova regra
        </Button>
      }
    >
      <RuleFields />
    </FormDialog>
  );
}
