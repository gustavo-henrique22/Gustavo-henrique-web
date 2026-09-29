"use client";

import { startTransition, useActionState } from "react";
import { initialActionState, type ActionState } from "@/lib/recebi/action-state";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Como useActionState, mas envia pelo onSubmit. Assim o React não limpa os
 * campos quando a ação devolve um erro e a pessoa não perde o que digitou.
 */
export function useActionForm(action: Action) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return { state: state ?? initialActionState, pending, onSubmit };
}
