// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

/**
 * Orígenes permitidos:
 * - Front local de Angular
 * - Dominio de producción (ajústalo)
 */
const ALLOWED_ORIGINS = [
  "http://localhost:4200",
  "https://cuestionariotamizajeprod.com",
  "https://encuesta-omega.vercel.app",

];

/** Utilidades CORS */
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

/** Helpers numéricos/fechas/booleans */
function toNum(x: any) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function toBoolMaybe(x: any): boolean | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  if (typeof x === "string") {
    const s = x.trim().toLowerCase();
    if (["true","t","1","si","sí","yes","y"].includes(s)) return true;
    if (["false","f","0","no","n"].includes(s)) return false;
  }
  return null;
}
function parseDobMaybe(ddmmaaaa?: string | null): string | null {
  if (!ddmmaaaa) return null;
  // acepta DD/MM/YYYY o ya YYYY-MM-DD
  const m = ddmmaaaa.match(/^(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})$/);
  if (!m) return ddmmaaaa; // quizá ya viene YYYY-MM-DD
  const dd = m[1].padStart(2,"0"), mm = m[2].padStart(2,"0"), yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

/** Métricas del cuestionario */
function calcIT(cigs?: any, years?: any) { // pack-years
  const c = toNum(cigs), y = toNum(years);
  if (!c || !y) return 0;
  return (c * y) / 20;
}
function calcIB(years?: any, hrsDia?: any) { // índice biomasa
  const y = toNum(years), h = toNum(hrsDia);
  if (!y || !h) return 0;
  return y * h;
}

/** Banco de preguntas (IDs, texto, puntos) */
const QUESTION_BANK = [
  {
    id: "family-history",
    question: "¿Tiene algún familiar directo con cáncer de pulmón?",
    explanation: "El antecedente familiar aumenta el riesgo por predisposición genética y exposición compartida.",
    points: 1,
    type: "yes-no",
  },
  {
    id: "chronic-cough",
    question: "¿Tiene tos por más de 3 meses?",
    explanation: "Tos crónica es un síntoma cardinal de enfermedad pulmonar (EPOC, cáncer, fibrosis).",
    points: 1,
    type: "yes-no",
  },
  {
    id: "hemoptysis",
    question: "¿Tiene tos con sangre (hemoptisis)?",
    explanation: "Es un signo de alarma serio; requiere evaluación inmediata.",
    points: 6,
    type: "yes-no",
  },
  {
    id: "weight-loss",
    question: "¿Tiene pérdida de peso inexplicable?",
    explanation: "La pérdida de peso sin causa aparente es un signo sistémico de cáncer avanzado.",
    points: 2,
    type: "yes-no",
  },
  {
    id: "contaminacion",
    question: "¿La zona donde vive o trabaja se considera de alta contaminacion?",
    explanation: "La exposicion a altas concentraciones de contaminantes por tiempo prolongado incrementa el riesgo de cáncer pulmonar y EPOC.",
    points: 2,
    type: "yes-no",
  },
  {
    id: "radon-exposure",
    question: "¿Tiene exposición a gas radón?",
    explanation: "El radón es la segunda causa más común de cáncer de pulmón después del tabaco.",
    points: 2,
    type: "yes-no",
  },
  {
    id: "tabaquismo",
    question: "¿Usted ha fumado o fuma?",
    explanation: "El tabaquismo es el principal factor de riesgo para cáncer de pulmón.",
    points: 2,
    type: "yes-no",
  },
  {
    id: "biomasa",
    question: "¿Usted tiene o ha tenido exposición a humo de leña?",
    explanation: "La exposición a humo de biomasa incrementa el riesgo de cáncer pulmonar y EPOC.",
    points: 2,
    type: "yes-no",
  },
] as const;

/** Mapeo de claves antiguas -> IDs nuevos (aceptamos ambos) */
const LEGACY_KEYS: Record<string, string[]> = {
  "family-history": ["familiarCaPulmon", "antecedenteFam", "antecedenteFamiliar"],
  "chronic-cough": ["tosTresMeses", "tosCronica"],
  "hemoptysis": ["tosConSangre", "hemoptisis"],
  "weight-loss": ["perdidaPesoInexplicable", "perdidaPeso"],
  "contaminacion": ["contaminacion", "altaContaminacion", "contaminacionAlta"],
  "radon-exposure": ["expoRadon", "radon"],
  "tabaquismo": ["tabaquismo", "fumador", "fuma"],
  "biomasa": ["biomasa", "humoLenia", "exposicionBiomasa"],
};

function pickAnswer(respuestas: any, id: string): boolean | null {
  // 1) clave nueva
  if (respuestas && Object.prototype.hasOwnProperty.call(respuestas, id)) {
    return toBoolMaybe(respuestas[id]);
  }
  // 2) claves legacy
  const fallbacks = LEGACY_KEYS[id] ?? [];
  for (const k of fallbacks) {
    if (respuestas && Object.prototype.hasOwnProperty.call(respuestas, k)) {
      return toBoolMaybe(respuestas[k]);
    }
  }
  return null;
}

/** Derivación de resultados (con gating por tabaquismo/biomasa) */
function computeResultadosFrom(respuestas: any, yesNo: Record<string, boolean | null>) {
  const tabaquismoFlag = yesNo["tabaquismo"] === true;
  const biomasaFlag    = yesNo["biomasa"] === true;

  const it = tabaquismoFlag
    ? calcIT(respuestas?.cigsPorDia, respuestas?.aniosFumando)
    : 0;

  const ib = biomasaFlag
    ? calcIB(respuestas?.aniosBiomasa, respuestas?.horasPorDiaBiomasa)
    : 0;

  const byIT    = it >= 20;
  const byYears = tabaquismoFlag && (toNum(respuestas?.aniosFumando) >= 20);
  const biomasaCumple    = biomasaFlag && (ib > 100);
  const tabaquismoCumple = tabaquismoFlag && (byIT || byYears);

  const redFlags = (yesNo["hemoptysis"] === true)
                || (yesNo["chronic-cough"] === true)
                || (yesNo["weight-loss"] === true);

  const riesgoAmbiental = (yesNo["radon-exposure"] === true)
                       || (yesNo["contaminacion"] === true);

  const antecedenteFam  = (yesNo["family-history"] === true);

  const requiresScreening =
    tabaquismoCumple || biomasaCumple || redFlags || riesgoAmbiental || antecedenteFam;

  return {
    it, ib,
    byIT, byYears,
    biomasaCumple,
    tabaquismoCumple,
    requiresScreening,
    redFlags,
    riesgoAmbiental,
    antecedenteFam,
  };
}

/** Handler principal */
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST")    return json({ error: "Método no permitido" }, 405, origin);

  try {
    const body = await req.json();
    const { identificacion, respuestas, resultados: resultadosFront } = body ?? {};

    if (identificacion && typeof identificacion !== "object") {
      return json({ error: "Identificación inválida" }, 400, origin);
    }

    // Variables de entorno con fallback:
    // - en local: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
    // - en cloud (secrets): PROJECT_URL / SERVICE_ROLE_KEY
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
      global: { headers: { "X-Client-Info": "submit-screening-edge" } },
    });

    // ===== 1) Armar mapa de sí/no (aceptando claves nuevas y legacy) =====
    const yesNoAnswers: Record<string, boolean | null> = {};
    for (const q of QUESTION_BANK) {
      yesNoAnswers[q.id] = pickAnswer(respuestas, q.id);
    }

    // ===== 2) Snapshot de preguntas =====
    const questionsSnapshot = QUESTION_BANK.map(q => ({
      id: q.id,
      question: q.question,
      explanation: q.explanation,
      points: q.points,
      type: q.type,
      answer: yesNoAnswers[q.id],
    }));

    // ===== 3) Puntaje total =====
    const scoreYesNo = questionsSnapshot.reduce((acc, q) => acc + (q.answer === true ? q.points : 0), 0);

    // ===== 4) Cálculos derivados =====
    const srv = computeResultadosFrom(respuestas ?? {}, yesNoAnswers);

    const resultadosToStore = {
      ...resultadosFront, // si el front trajo algo, lo preservamos
      scoreYesNo,
      packYears: srv.it,
      indiceExposicion: srv.ib,
      tabaquismoByIT: srv.byIT,
      tabaquismoByYears: srv.byYears,
      biomasaCumple: srv.biomasaCumple,
      tabaquismoCumple: srv.tabaquismoCumple,
      requiresScreening: srv.requiresScreening,
      redFlags: srv.redFlags,
      riesgoAmbiental: srv.riesgoAmbiental,
      antecedenteFam: srv.antecedenteFam,
    };

    const respuestasToStore = {
      ...(respuestas ?? {}),
      yesNo: yesNoAnswers,
      questions: questionsSnapshot,
    };

    // ===== 5) Insertar respondent SIN email =====
    const { data: respondent, error: err1 } = await supabase
      .from("respondents")
      .insert({
        sexo: identificacion?.sexo ?? null,
        fecha_nacimiento: parseDobMaybe(identificacion?.fechaNacimiento) ?? null,
        cp: identificacion?.cp ?? null,
        medico: identificacion?.medico ?? null,
        nombre: identificacion?.nombre ?? null,
        telefono: identificacion?.telefono ?? null,
      })
      .select("id")
      .single();
    if (err1) return json({ error: err1.message }, 400, origin);

    // ===== 6) Insertar screening con snapshot, métricas y columnas por pregunta =====
    const insertScreening: any = {
      respondent_id: respondent.id,
      respuestas: respuestasToStore,
      resultados: resultadosToStore,
      pack_years: srv.it,
      exposicion_ib: srv.ib,
      tabaquismo_cumple: srv.tabaquismoCumple,
      biomasa_cumple: srv.biomasaCumple,
      score_yesno: scoreYesNo,

      // columnas por pregunta
      q_family_history:  yesNoAnswers["family-history"],
      q_chronic_cough:   yesNoAnswers["chronic-cough"],
      q_hemoptysis:      yesNoAnswers["hemoptysis"],
      q_weight_loss:     yesNoAnswers["weight-loss"],
      q_contaminacion:   yesNoAnswers["contaminacion"],
      q_radon_exposure:  yesNoAnswers["radon-exposure"],
      q_tabaquismo:      yesNoAnswers["tabaquismo"],
      q_biomasa:         yesNoAnswers["biomasa"],
    };

    const { data: screening, error: err2 } = await supabase
      .from("screenings")
      .insert(insertScreening)
      .select("id, respondent_id")
      .single();
    if (err2) return json({ error: err2.message }, 400, origin);

    return json({
      ok: true,
      respondentId: respondent.id,
      screeningId: screening.id,
      requiresScreening: srv.requiresScreening,
      scoreYesNo,
    }, 201, origin);
  } catch (e) {
    return json({ error: e?.message ?? "Error inesperado" }, 500, origin);
  }
});
