import { protectedRedirect } from "@src/lib/auth";
import * as db from "@src/lib/initGun";
import * as friends from "@src/lib/friends";
import type { LayoutLoad } from "./$types";

export const ssr = false;
export const csr = true;

export const load = ( async () => {
  await db.init()
  await protectedRedirect();
  await friends.init()
}) satisfies LayoutLoad;  