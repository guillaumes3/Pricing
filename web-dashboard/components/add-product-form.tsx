"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const addProductSchema = z.object({
  productName: z.string().min(1, "Le nom du produit est requis."),
  productUrl: z
    .string()
    .url("Veuillez saisir une URL produit valide.")
    .refine((url) => url.startsWith("http"), "L'URL doit commencer par http."),
  price: z.coerce.number().positive("Le prix doit etre un nombre positif."),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1, "Le nom du concurrent est requis."),
        url: z
          .string()
          .url("Veuillez saisir une URL concurrent valide.")
          .refine((url) => url.startsWith("http"), "L'URL doit commencer par http.")
      })
    )
    .min(1, "Ajoutez au moins un concurrent.")
});

type AddProductFormInput = z.input<typeof addProductSchema>;
export type AddProductFormValues = z.output<typeof addProductSchema>;

type AddProductFormProps = {
  onSubmitData?: (values: AddProductFormValues) => Promise<void>;
  competitorOptions?: string[];
};

type ToastState = {
  type: "success" | "error";
  message: string;
};

const defaultCompetitors = ["Amazon", "Cdiscount", "Fnac"];

export function AddProductForm({ onSubmitData, competitorOptions }: AddProductFormProps) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [competitorNameInputs, setCompetitorNameInputs] = useState<Record<string, string>>({});
  const options = useMemo(() => competitorOptions ?? defaultCompetitors, [competitorOptions]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AddProductFormInput, undefined, AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      productName: "",
      productUrl: "",
      price: "",
      competitors: [{ name: "", url: "" }]
    },
    mode: "onBlur"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "competitors"
  });

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const onSubmit = async (values: AddProductFormValues) => {
    try {
      if (onSubmitData) {
        await onSubmitData(values);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      reset({
        productName: "",
        productUrl: "",
        price: "",
        competitors: [{ name: "", url: "" }]
      });
      setCompetitorNameInputs({});

      setToast({
        type: "success",
        message: "Veille ajoutee avec succes."
      });
    } catch {
      setToast({
        type: "error",
        message: "Echec de l'envoi. Reessayez dans un instant."
      });
    }
  };

  return (
    <section className="relative mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {toast ? (
        <div
          role="status"
          className={`pointer-events-none absolute right-4 top-4 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ajouter une veille</h2>
        <p className="mt-2 text-sm text-slate-600">Renseignez votre produit puis ajoutez les URLs de vos concurrents.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="productName" className="text-sm font-medium text-slate-700">
              Nom du produit
            </label>
            <input
              id="productName"
              type="text"
              placeholder="Ex: Casque Bluetooth X200"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              {...register("productName")}
            />
            {errors.productName ? <p className="text-xs text-rose-600">{errors.productName.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="productUrl" className="text-sm font-medium text-slate-700">
              URL du produit
            </label>
            <input
              id="productUrl"
              type="url"
              placeholder="https://votresite.com/produit"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              {...register("productUrl")}
            />
            {errors.productUrl ? <p className="text-xs text-rose-600">{errors.productUrl.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="price" className="text-sm font-medium text-slate-700">
              Prix actuel (€)
            </label>
            <input
              id="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="99.99"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              {...register("price")}
            />
            {errors.price ? <p className="text-xs text-rose-600">{errors.price.message}</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Concurrents</h3>
              <p className="mt-1 text-xs text-slate-600">Ajoutez les pages produits concurrentes a surveiller.</p>
            </div>
            <button
              type="button"
              onClick={() => append({ name: "", url: "" })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              + Ajouter un concurrent
            </button>
          </div>

          <datalist id="competitor-options">
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const competitorNameRegistration = register(`competitors.${index}.name`);

              return (
                <div key={field.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_1.7fr_auto]">
                  <div className="space-y-1">
                    <label htmlFor={`competitor-name-${index}`} className="text-xs font-medium text-slate-700">
                      Concurrent
                    </label>
                    <input
                      id={`competitor-name-${index}`}
                      type="text"
                      list="competitor-options"
                      placeholder="Amazon ou MaBoutiqueLocale"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      name={competitorNameRegistration.name}
                      ref={competitorNameRegistration.ref}
                      onBlur={competitorNameRegistration.onBlur}
                      onChange={(event) => {
                        setCompetitorNameInputs((previous) => ({
                          ...previous,
                          [field.id]: event.target.value
                        }));
                        competitorNameRegistration.onChange(event);
                      }}
                      value={competitorNameInputs[field.id] ?? ""}
                    />
                    {errors.competitors?.[index]?.name ? (
                      <p className="text-xs text-rose-600">{errors.competitors[index]?.name?.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={`competitor-url-${index}`} className="text-xs font-medium text-slate-700">
                      URL
                    </label>
                    <input
                      id={`competitor-url-${index}`}
                      type="url"
                      placeholder="https://concurrent.com/produit"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      {...register(`competitors.${index}.url`)}
                    />
                    {errors.competitors?.[index]?.url ? (
                      <p className="text-xs text-rose-600">{errors.competitors[index]?.url?.message}</p>
                    ) : null}
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCompetitorNameInputs((previous) => {
                          const next = { ...previous };
                          delete next[field.id];
                          return next;
                        });
                        remove(index);
                      }}
                      disabled={fields.length === 1}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {errors.competitors && !Array.isArray(errors.competitors) ? (
            <p className="mt-3 text-xs text-rose-600">{errors.competitors.message}</p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Envoi...
              </>
            ) : (
              "Valider la veille"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
