import { Injectable } from '@angular/core';
import { ScreeningQuestion, ScreeningAnswer, RiskAssessment } from '../models/screening.model';

@Injectable({
  providedIn: 'root'
})
export class ScreeningService {
  private questions: ScreeningQuestion[] = [
    {
      id: 'family-history',
      question: '¿Tiene algún familiar directo con cáncer de pulmón?',
      explanation: 'El antecedente familiar aumenta el riesgo por predisposición genética y exposición compartida.',
      points: 1,
      type: 'yes-no'
    },
    {
      id: 'chronic-cough',
      question: '¿Tiene tos por más de 3 meses?',
      explanation: 'Tos crónica es un síntoma cardinal de enfermedad pulmonar (EPOC, cáncer, fibrosis).',
      points: 1,
      type: 'yes-no'
    },
    {
      id: 'hemoptysis',
      question: '¿Tiene tos con sangre (hemoptisis)?',
      explanation: 'Es un signo de alarma serio; requiere evaluación inmediata.',
      points: 5,
      type: 'yes-no'
    },
    {
      id: 'weight-loss',
      question: '¿Tiene pérdida de peso inexplicable?',
      explanation: 'La pérdida de peso sin causa aparente es un signo sistémico de cáncer avanzado.',
      points: 2,
      type: 'yes-no'
    },
    {
      id : 'contaminacion',
      question: '¿La zona donde vive o trabaja se considera de alta contaminacion?',
      explanation: 'La exposicion a altas concentraciones de contaminantes por tiempo prolongado incrementa el riesgo de cáncer pulmonar y EPOC.',
      points: 2,
      type: 'yes-no'
    },
    {
      id: 'radon-exposure',
      question: '¿Tiene exposición a gas radón?',
      explanation: 'El radón es la segunda causa más común de cáncer de pulmón después del tabaco.',
      points: 2,
      type: 'yes-no'
    },
    {
      id: 'tabaquismo',
      question: '¿Usted ha fumado o fuma?',
      explanation: 'El tabaquismo es el principal factor de riesgo para cáncer de pulmón.',
      points: 2,
      type: 'yes-no'
    },
    {
      id: 'biomasa',
      question: '¿Usted tiene o ha tenido exposición a humo de leña?',
      explanation: 'La exposición a humo de biomasa incrementa el riesgo de cáncer pulmonar y EPOC.',
      points: 2,
      type: 'yes-no'
    }
  ];

  getQuestions(): ScreeningQuestion[] {
    return this.questions;
  }

  calculateRisk(answers: ScreeningAnswer[]): RiskAssessment {
    let totalPoints = 0;
    // --- Puntaje adicional por TABAQUISMO (si respondió sí y hay detalles) ---
    const tabaquismo = answers.find(a => a.questionId === 'tabaquismo' && a.answer);
    if (tabaquismo?.details?.smokingYears != null && tabaquismo?.details?.cigsPerDay != null) {
      const years = Math.max(0, Number(tabaquismo.details.smokingYears) || 0);
      const cigs  = Math.max(0, Number(tabaquismo.details.cigsPerDay) || 0);
      const packYears = (cigs / 20) * years; // 20 cigarrillos = 1 cajetilla

      // Umbrales médicos simples por pack-years
      // <10 -> +1, 10-20 -> +2, >20 -> +3
      if (packYears > 20) {
        totalPoints += 5;
      } else if (packYears >= 10) {
        totalPoints += 2;
      } else if (packYears > 0) {
        totalPoints += 1;
      }
    }

    // --- Puntaje adicional por EXPOSICIÓN A BIOMASA ---
    const biomasa = answers.find(a => a.questionId === 'biomasa' && a.answer);
    if (biomasa?.details?.biomassYears != null && biomasa?.details?.biomassHoursPerDay != null) {
      const years = Math.max(0, Number(biomasa.details.biomassYears) || 0);
      const hours = Math.max(0, Number(biomasa.details.biomassHoursPerDay) || 0);
      const exposureIndex = years * hours; // índice simple: años × horas/día

      // Umbrales propuestos:
      // <20 -> +1, 20-60 -> +2, >60 -> +3
      if (exposureIndex > 60) {
        totalPoints += 5;
      } else if (exposureIndex >= 20) {
        totalPoints += 2;
      } else if (exposureIndex > 0) {
        totalPoints += 1;
      }
    }
    // --- Puntaje por respuestas a preguntas ---

    answers.forEach(answer => {
      const question = this.questions.find(q => q.id === answer.questionId);
      if (question && answer.answer === true) {
        totalPoints += question.points;
      }
    });

    let riskLevel: 'low' | 'moderate' | 'high';
    let recommendation: string;

    if (totalPoints <= 2) {
      riskLevel = 'low';
      recommendation = 'No parece haber signos de alarma inmediatos, pero mantener vigilancia si hay exposición crónica a tabaco o contaminantes.';
    } else if (totalPoints <= 5) {
      riskLevel = 'moderate';
      recommendation = 'Considerar consulta médica para evaluación clínica y radiografía de tórax.';
    } else {
      riskLevel = 'high';
      recommendation = 'Es prioritario contactar a un médico para estudios diagnósticos (TAC, espirometría, marcadores).';
    }

    return {
      totalPoints,
      riskLevel,
      recommendation,
      requiresContact: totalPoints >= 3
    };
  }
}