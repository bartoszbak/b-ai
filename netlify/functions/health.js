import { json, getMethodNotAllowedResponse } from "./lib/openrouter.js"

export default async function handler(request) {
  if (request.method !== "GET") {
    return getMethodNotAllowedResponse(["GET"])
  }

  return json({ ok: true })
}
