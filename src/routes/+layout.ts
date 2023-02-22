import { protectedRedirect } from "@src/lib/auth";
import type { LayoutLoad } from "./$types";

export const ssr = false;
export const csr = true;

export const load = (() => {
  protectedRedirect();
}) satisfies LayoutLoad;  