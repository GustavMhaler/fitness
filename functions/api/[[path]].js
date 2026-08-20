import { createApi } from "../lib/api.mjs";

export const onRequest = (context) => createApi(context.env).fetch(context.request);
