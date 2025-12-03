// src/app/utils/map-answers.ts
import { ScreeningAnswer, RiskAssessment, PersonalInfo } from '../models/screening.model';
import { ApiPayload } from '../types/api.payload';

export function buildApiPayload(
  personal: PersonalInfo,
  answers: ScreeningAnswer[],
  results: RiskAssessment
): ApiPayload {
  const by = (id: string) => answers.find(a => a.questionId === id);
  const nz = (n: number) => Math.max(0, Number.isFinite(n) ? n : 0);

  const payloadRespuestas = {
    familiarCaPulmon: !!by('family-history')?.answer,
    tosTresMeses: !!by('chronic-cough')?.answer,
    tosConSangre: !!by('hemoptysis')?.answer,
    perdidaPesoInexplicable: !!by('weight-loss')?.answer,
    expoRadon: !!by('radon-exposure')?.answer,
    contaminacionAlta: !!by('contaminacion')?.answer,

    fumaOFumo: !!by('tabaquismo')?.answer,
    aniosFumando: 0,
    cigsPorDia: 0,

    expBiomasa: !!by('biomasa')?.answer,
    aniosBiomasa: 0,
    horasPorDiaBiomasa: 0,
  };

  const tabaq = by('tabaquismo');
  if (payloadRespuestas.fumaOFumo) {
    payloadRespuestas.aniosFumando = nz(tabaq?.details?.smokingYears ?? 0);
    payloadRespuestas.cigsPorDia   = nz(tabaq?.details?.cigsPerDay ?? 0);
  }

  const bio = by('biomasa');
  if (payloadRespuestas.expBiomasa) {
    payloadRespuestas.aniosBiomasa       = nz(bio?.details?.biomassYears ?? 0);
    payloadRespuestas.horasPorDiaBiomasa = nz(bio?.details?.biomassHoursPerDay ?? 0);
  }

  return {
    identificacion: {
      nombre: personal?.nombre ?? null,
      sexo: personal?.sexo ?? null,
      edad: personal?.edad ?? null,      // 👈 antes fechaNacimiento
      cp: personal?.cp ?? null,
      telefono: personal?.telefono ?? null,
      email: personal?.email ?? null,
    },
    respuestas: payloadRespuestas,
    resultados: results,
  };
}
