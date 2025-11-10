import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ScreeningService } from '../../services/screening.service';
import { ScreeningQuestion, ScreeningAnswer, RiskAssessment } from '../../models/screening.model';
import { ResultsComponent } from '../results/results.component';
import { ApiService } from '../../services/api.service'; // <-- NUEVO

@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ResultsComponent],
  templateUrl: './questionnarie.component.html',
  styleUrls: ['./questionnarie.component.css']
})
export class QuestionnaireComponent implements OnInit {
  questions: ScreeningQuestion[] = [];
  answers: ScreeningAnswer[] = [];
  submitted = false;
  riskAssessment: RiskAssessment | null = null;

  personalForm!: FormGroup;

  constructor(
    private screeningService: ScreeningService,
    private fb: FormBuilder,
    private api: ApiService, // <-- NUEVO
  ) {}

  ngOnInit(): void {
    this.questions = this.screeningService.getQuestions();
    this.initializeAnswers();

    this.personalForm = this.fb.group({
      // Si decidiste NO pedir nombre/teléfono/email aquí, puedes borrar "nombre"
      nombre: ['', [Validators.minLength(3)]], // <- quita Validators.required si ya no lo quieres obligatorio
      sexo: [''],
      fechaNacimiento: [null], // si es dd/mm/aaaa luego lo convertimos a ISO
      cp: [''],
      medico: [''],
    });
  }

  private initializeAnswers(): void {
    this.answers = this.questions.map(q => ({
      questionId: q.id,
      answer: false,
      details: q.id === 'tabaquismo'
        ? { smokingYears: undefined, cigsPerDay: undefined }
        : q.id === 'biomasa'
        ? { biomassYears: undefined, biomassHoursPerDay: undefined }
        : {}
    }));
  }

  getAnswer(id: string) {
    return this.answers.find(a => a.questionId === id);
  }
  isAnswerTrue(questionId: string): boolean {
    return this.answers.find(a => a.questionId === questionId)?.answer === true;
  }
  isAnswerFalse(questionId: string): boolean {
    return this.answers.find(a => a.questionId === questionId)?.answer === false;
  }
  onAnswerChange(questionId: string, answer: boolean): void {
    const answerObj = this.answers.find(a => a.questionId === questionId);
    if (answerObj) answerObj.answer = answer;
  }

  // --- Helpers de mapeo ---
  private toNumber(v: any): number | undefined {
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }
  setSmokingYears(id: string, val: any) {
    const a = this.getAnswer(id); if (!a) return;
    a.details = a.details || {};
    a.details.smokingYears = this.toNumber(val);
  }
  setCigsPerDay(id: string, val: any) {
    const a = this.getAnswer(id); if (!a) return;
    a.details = a.details || {};
    a.details.cigsPerDay = this.toNumber(val);
  }
  setBiomassYears(id: string, val: any) {
    const a = this.getAnswer(id); if (!a) return;
    a.details = a.details || {};
    a.details.biomassYears = this.toNumber(val);
  }
  setBiomassHoursPerDay(id: string, val: any) {
    const a = this.getAnswer(id); if (!a) return;
    a.details = a.details || {};
    a.details.biomassHoursPerDay = this.toNumber(val);
  }

  // Convierte "dd/mm/aaaa" → "aaaa-mm-dd". Si ya viene ISO, se respeta.
  private toISO(d?: string | null): string | null {
    if (!d) return null;
    const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return d; // posiblemente ya YYYY-MM-DD
    const dd = m[1].padStart(2,'0');
    const mm = m[2].padStart(2,'0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // IDs esperados por tu ScreeningService/DB (ajustados al proyecto que leí)
  private mapAnswersToData(answers: ScreeningAnswer[]) {
    const byId = (id: string) => answers.find(a => a.questionId === id);

    const tabaq = byId('tabaquismo');
    const bio   = byId('biomasa');

    // Nuevas preguntas
    const fam   = byId('family-history');
    const tos3m = byId('chronic-cough');
    const hemo  = byId('hemoptysis');
    const peso  = byId('weight-loss');
    const radon = byId('radon-exposure');

    return {
      // tabaquismo
      fumaOFumo: !!tabaq?.answer,
      aniosFumando: this.toNumber(tabaq?.details?.smokingYears) ?? 0,
      cigsPorDia:  this.toNumber(tabaq?.details?.cigsPerDay) ?? 0,

      // biomasa
      expBiomasa: !!bio?.answer,
      aniosBiomasa: this.toNumber(bio?.details?.biomassYears) ?? 0,
      horasPorDiaBiomasa: this.toNumber(bio?.details?.biomassHoursPerDay) ?? 0,

      // P3,4,5,6,9
      familiarCaPulmon: !!fam?.answer,
      tosTresMeses: !!tos3m?.answer,
      tosConSangre: !!hemo?.answer,
      perdidaPesoInexplicable: !!peso?.answer,
      expoRadon: !!radon?.answer,
    };
  }

  submitQuestionnaire(): void {
    // valida datos personales si los dejas visibles
    if (this.personalForm && this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      return;
    }

    // 1) Calcula riesgo (como ya hacías)
    this.riskAssessment = this.screeningService.calculateRisk(this.answers);
    this.submitted = true;

    // 2) Arma payload y envía a Supabase
    const p = this.personalForm?.value || {};
    const respuestas = this.mapAnswersToData(this.answers);

    const payload = {
      identificacion: {
        // Si quitaste PII aquí, no los envíes:
        sexo: p.sexo ?? '',
        fechaNacimiento: this.toISO(p.fechaNacimiento) ?? null,
        cp: p.cp ?? null,
        medico: p.medico ?? null,
        // nombre: p.nombre ?? null, // <- si ya no lo usas, déjalo comentado
      },
      respuestas,
      resultados: {}, // opcional; el backend recalcula IT/IB y flags
    };

    // Llama a la función submit-screening
    this.api.submitScreening(payload).subscribe({
      next: (res) => {
        // aquí podrías guardar respondent_id/screening_id en un servicio si los usarás en contact-optin
        console.log('submit-screening OK', res);
      },
      error: (err) => {
        console.error('submit-screening ERROR', err);
      }
    });
  }

  resetForm(): void {
    this.submitted = false;
    this.riskAssessment = null;
    this.initializeAnswers();
    if (this.personalForm) {
      this.personalForm.reset({
        nombre: '',
        sexo: '',
        fechaNacimiento: null,
        cp: '',
        medico: ''
      });
    }
  }
}
