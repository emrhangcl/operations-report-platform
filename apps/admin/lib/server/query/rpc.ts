import "server-only";

import type { QueryResult } from "@operations/data-client";
import { withDbContext, type DbContext } from "../db";
import { toQueryError } from "./execute";

interface FunctionSignature {
  returnsSet: boolean;
  returnsComposite: boolean;
  returnsVoid: boolean;
  argumentTypes: Map<string, { type: string; isJson: boolean }>;
}

const identifierPattern = /^[a-z_][a-z0-9_]{0,62}$/;
const signatureCache = new Map<string, Promise<FunctionSignature>>();

async function loadSignature(name: string): Promise<FunctionSignature> {
  return withDbContext({ role: "service_role" }, async (client) => {
    const result = await client.query<{
      proretset: boolean;
      typtype: string;
      typname: string;
      arg_names: string[] | null;
      arg_types: string[] | null;
      arg_modes: string[] | null;
    }>(
      `select p.proretset,
              t.typtype,
              t.typname,
              p.proargnames as arg_names,
              array(select format_type(oid, null) from unnest(p.proargtypes) with ordinality as a(oid, ord) order by ord) as arg_types,
              p.proargmodes::text[] as arg_modes
         from pg_proc p
         join pg_type t on t.oid = p.prorettype
        where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
      [name]
    );
    if (result.rows.length !== 1) {
      throw Object.assign(new Error(`public.${name} fonksiyonu bulunamadi veya birden fazla imzasi var.`), { code: "42883" });
    }
    const row = result.rows[0]!;
    const inputNames = (row.arg_names ?? []).filter((_, index) => {
      const mode = row.arg_modes?.[index];
      return mode === undefined || mode === "i" || mode === "b" || mode === "v";
    });
    const argumentTypes = new Map<string, { type: string; isJson: boolean }>();
    inputNames.forEach((argName, index) => {
      const type = row.arg_types?.[index];
      if (argName && type) argumentTypes.set(argName, { type, isJson: type === "json" || type === "jsonb" });
    });
    return {
      returnsSet: row.proretset,
      returnsComposite: row.typtype === "c",
      returnsVoid: row.typname === "void",
      argumentTypes
    };
  });
}

function getSignature(name: string) {
  let signature = signatureCache.get(name);
  if (!signature) {
    signature = loadSignature(name);
    signatureCache.set(name, signature);
    signature.catch(() => signatureCache.delete(name));
  }
  return signature;
}

/** public semasindaki bir fonksiyonu adlandirilmis argumanlarla cagirir (yalnizca server icinden). */
export async function callFunction(
  name: string,
  args: Record<string, unknown> = {},
  context: DbContext = { role: "service_role" }
): Promise<QueryResult<unknown>> {
  try {
    if (!identifierPattern.test(name)) throw Object.assign(new Error("Gecersiz fonksiyon adi."), { code: "42602" });
    const signature = await getSignature(name);
    const values: unknown[] = [];
    const namedArguments = Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([argName, value]) => {
        const argument = signature.argumentTypes.get(argName);
        if (!argument || !identifierPattern.test(argName)) {
          throw Object.assign(new Error(`${name} fonksiyonunda bilinmeyen arguman: ${argName}`), { code: "42883" });
        }
        values.push(argument.isJson && value !== null ? JSON.stringify(value) : value);
        return `"${argName}" => $${values.length}::${argument.type}`;
      });

    const call = `"public"."${name}"(${namedArguments.join(", ")})`;
    const text = signature.returnsVoid
      ? `select ${call}`
      : signature.returnsSet
        ? `select to_jsonb(r) as value from ${call} as r`
        : `select to_jsonb(${call}) as value`;

    return await withDbContext(context, async (client) => {
      const result = await client.query<{ value: unknown }>(text, values);
      if (signature.returnsVoid) return { data: null, error: null, count: null, status: 204 };
      const data = signature.returnsSet ? result.rows.map((row) => row.value) : result.rows[0]?.value ?? null;
      return { data, error: null, count: null, status: 200 };
    });
  } catch (error) {
    const mapped = toQueryError(error, true);
    return { data: null, error: mapped.error, count: null, status: mapped.status };
  }
}
