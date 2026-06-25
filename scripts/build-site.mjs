import { build } from "vite";

if (!Object.prototype.hasOwnProperty.call(process.env, "VITE_ADMIN_PASSCODE")) {
  process.env.VITE_ADMIN_PASSCODE = "";
}

await build();
