import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ScreeningService } from '../../services/screening.service';
import { ScreeningQuestion, ScreeningAnswer, RiskAssessment, PersonalInfo } from '../../models/screening.model';
import { ResultsComponent } from '../results/results.component';
import { ApiService } from '../../services/api.service';
import { buildApiPayload } from '../../utils/map-answers';
import { Router } from '@angular/router';

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
    private api: ApiService,
    private router: Router,              // 👈 Router inyectado
  ) {}

  ngOnInit(): void {
    this.questions = this.screeningService.getQuestions();
    this.initializeAnswers();

    this.personalForm = this.fb.group({
      nombre: ['', [Validators.minLength(3)]],
      sexo: [''],
      fechaNacimiento: [null],  // 'YYYY-MM-DD' o 'dd/mm/aaaa' si luego lo conviertes
      cp: [''],
      telefono: [''],
      email: [''],
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
  isAnswerTrue(id: string): boolean {
    return this.answers.find(a => a.questionId === id)?.answer === true;
  }
  isAnswerFalse(id: string): boolean {
    return this.answers.find(a => a.questionId === id)?.answer === false;
  }
  onAnswerChange(id: string, answer: boolean): void {
    const a = this.getAnswer(id);
    if (a) a.answer = answer;
  }

  // --- Helpers para llenar details ---
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

  // (Opcional) Convierte "dd/mm/aaaa" → "aaaa-mm-dd" si tu UI usa ese formato
  private toISO(d?: string | null): string | null {
    if (!d) return null;
    const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return d; // ya venía ISO
    const dd = m[1].padStart(2,'0');
    const mm = m[2].padStart(2,'0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  submitQuestionnaire(): void {
    // Valida datos personales si los usas
    if (this.personalForm && this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      return;
    }

    // 1) Calcula riesgo
    this.riskAssessment = this.screeningService.calculateRisk(this.answers);
    this.submitted = true;

    // 2) Prepara "personal" con el tipo adecuado
    const p = (this.personalForm?.value ?? {}) as PersonalInfo;
    p.fechaNacimiento = this.toISO(p.fechaNacimiento ?? null);

    // 3) Arma payload con el mapper centralizado
    const results = this.riskAssessment as RiskAssessment; // ya no es null en este punto
    const payload = buildApiPayload(p, this.answers, results);

    // 4) Envía al backend y navega con IDs y riesgo
    this.api.submitScreening(payload).subscribe({
      next: (res: any) => {
        // Objeto de riesgo para Results: puedes usar el mismo que calculaste
        const risk: RiskAssessment = this.riskAssessment!;

        // (Opcional) persistir IDs si quieres que sobrevivan a refresh
        // localStorage.setItem('screeningIds', JSON.stringify({ respondentId: res.respondentId, screeningId: res.screeningId }));

        // 🔹 Navega a /results pasando IDs y riesgo en Router state
        this.router.navigate(['/results'], {
          state: {
            respondentId: res?.respondentId,
            screeningId:  res?.screeningId,
            risk
          }
        });
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
        telefono: '',
        email: '',
      });
    }
  }
}
