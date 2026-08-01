import * as React from "react"

import { cn } from "@/lib/utils"

export interface TableColumn<T> {
  key: string
  header: string
  align?: "left" | "right" | "center"
  numeric?: boolean
  render?: (row: T) => React.ReactNode
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  keyField?: keyof T
  className?: string
}

function Table<T extends Record<string, unknown>>({ columns, rows, keyField = "id" as keyof T, className }: TableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse [font:var(--text-body-sm)]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-b border-border-strong px-2.5 py-2 text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase"
                style={{ textAlign: column.align ?? "left" }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[keyField])}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("border-b border-border px-2.5 py-2.5 text-foreground", column.numeric && "font-mono tabular-nums")}
                  style={{ textAlign: column.align ?? "left" }}
                >
                  {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface TableRowMobileProps {
  primary: React.ReactNode
  secondary?: React.ReactNode
  meta?: React.ReactNode
}

function TableRowMobile({ primary, secondary, meta }: TableRowMobileProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border px-1 py-3">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-foreground">{primary}</span>
        {secondary ? <span className="font-mono tabular-nums">{secondary}</span> : null}
      </div>
      {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
    </div>
  )
}

export { Table, TableRowMobile }
