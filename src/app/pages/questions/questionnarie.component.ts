import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ScreeningService } from '../../services/screening.service';
import { ScreeningQuestion, ScreeningAnswer, RiskAssessment, PersonalInfo } from '../../models/screening.model';
import { ApiService } from '../../services/api.service';
import { buildApiPayload } from '../../utils/map-answers';
import { Router } from '@angular/router';

@Component({
  selector: 'app-questionnaire',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.questions = this.screeningService.getQuestions();
    this.initializeAnswers();

    this.personalForm = this.fb.group({
      nombre: ['', [Validators.minLength(3)]],
      sexo: [''],
      edad: [null, [Validators.min(0), Validators.max(120)]],
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


  submitQuestionnaire(): void {
    if (this.personalForm && this.personalForm.invalid) {
      this.personalForm.markAllAsTouched();
      return;
    }

    // 1) Calcula riesgo
    this.riskAssessment = this.screeningService.calculateRisk(this.answers);
    // this.submitted = true; // ya no se usa, navega directamente a /results

    // 2) Prepara datos personales
    const p = (this.personalForm?.value ?? {}) as PersonalInfo;

    // 3) Arma payload
    const results = this.riskAssessment as RiskAssessment;
    const payload = buildApiPayload(p, this.answers, results);

    // 4) Envía al backend y navega con datos
    this.api.submitScreening(payload).subscribe({
      next: (res: any) => {
        const risk: RiskAssessment = this.riskAssessment!;
        this.router.navigate(['/results'], {
          state: {
            respondentId: res?.respondentId,
            screeningId: res?.screeningId,
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
        edad: null,
        cp: '',
        telefono: '',
        email: '',
      });
    }
  }
}
