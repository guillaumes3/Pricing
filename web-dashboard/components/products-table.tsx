"use client";

import { useMemo, useState } from "react";
import {
  ColumnDef,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { DashboardProduct } from "@/lib/dashboard-types";

type ProductsTableProps = {
  products: DashboardProduct[];
  currency: string;
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

const skuNameFilter: FilterFn<DashboardProduct> = (row, _columnId, filterValue) => {
  const query = String(filterValue).trim().toLowerCase();
  if (!query) {
    return true;
  }

  return row.original.sku.toLowerCase().includes(query) || row.original.name.toLowerCase().includes(query);
};

export function ProductsTable({ products, currency }: ProductsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<DashboardProduct>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => <span className="font-medium text-slate-700 dark:text-slate-300">{row.original.sku}</span>
      },
      {
        accessorKey: "name",
        header: "Produit",
        cell: ({ row }) => <span className="text-slate-900 dark:text-slate-100">{row.original.name}</span>
      },
      {
        accessorKey: "ourPrice",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-left font-medium text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Notre prix
            <span className="text-xs text-slate-400">
              {column.getIsSorted() === "asc" ? "ASC" : column.getIsSorted() === "desc" ? "DESC" : "--"}
            </span>
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatCurrency(row.original.ourPrice, currency)}
          </span>
        )
      },
      {
        accessorKey: "competitorLow",
        header: "Concurrent le + bas",
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-300">
            {formatCurrency(row.original.competitorLow, currency)}
          </span>
        )
      },
      {
        id: "status",
        header: "Position",
        cell: ({ row }) => {
          const spread = row.original.ourPrice - row.original.competitorLow;
          const isWinning = spread <= 0;

          return (
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                isWinning
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {isWinning ? "Leader prix" : `+${formatCurrency(spread, currency)}`}
            </span>
          );
        }
      }
    ],
    [currency]
  );

  const table = useReactTable({
    data: products,
    columns,
    filterFns: { skuNameFilter },
    globalFilterFn: skuNameFilter,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5
      }
    }
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filtrer par SKU ou nom produit"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:max-w-xs"
          aria-label="Filtrer les produits"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {table.getFilteredRowModel().rows.length} produit(s) affiche(s)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200 dark:border-slate-800">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-2 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/80">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-sm text-slate-500">
                  Aucun produit pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Precedent
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
