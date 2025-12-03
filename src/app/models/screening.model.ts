export interface ScreeningQuestion {
  id: string;
  question: string;
  explanation: string;
  points: number;
  type: 'yes-no' | 'radio';
}

export interface ScreeningAnswer {
  questionId: string;
  answer: boolean;
  details?: {
    smokingYears?: number;
    cigsPerDay?: number;
    biomassYears?: number;
    biomassHoursPerDay?: number;
  };
}

export interface RiskAssessment {
  totalPoints: number;
  riskLevel: 'low' | 'moderate' | 'high';
  recommendation: string;
  requiresContact: boolean;
}

export interface ContactInfo {
  email: string;
  phone: string;
}

// Datos personales que SÍ envías (sin “medico”)
export interface PersonalInfo {
  nombre?: string | null;
  sexo?: 'M' | 'F' | 'O' | null;
  edad?: number | null;   // 'YYYY-MM-DD'
  cp?: string | null;
  telefono?: string | null;
  email?: string | null;
}

