// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ALLOWED_ORIGINS = [
  "http://localhost:4200",
  "http://127.0.0.1:4200",        // añade esto si navegas con 127.0.0.1
  "https://cuestionariotamizajeprod.com",
  "encuesta-omega.vercel.app",
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST")    return json({ error: "Método no permitido" }, 405, origin);

  try {
    const body = await req.json();
    const {
      respondentId,
      screeningId,
      nombre,
      telefono,
      email,
      consentimiento,
      contexto,
    } = body ?? {};

    if (!email || typeof email !== "string") {
      return json({ error: "Email requerido" }, 400, origin);
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
    const serviceKey  =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Faltan variables de entorno del servidor" }, 500, origin);
    }

    const { createClient } = await import("npm:@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { "X-Client-Info": "contact-optin-edge" } },
    });

    const { data, error } = await supabase
      .from("contact_requests")
      .insert([{
        respondent_id: Number.isFinite(Number(respondentId)) ? Number(respondentId) : null,
        screening_id:  Number.isFinite(Number(screeningId))  ? Number(screeningId)  : null,
        nombre: nombre ?? null,
        telefono: telefono ?? null,
        email,
        consentimiento: Boolean(consentimiento),
        contexto: contexto ?? null,
      }])
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 400, origin);

    return json({ ok: true, id: data.id }, 201, origin);
  } catch (e) {
    return json({ error: e?.message ?? "Error inesperado" }, 500, origin);
  }
});
