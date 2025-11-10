import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RiskAssessment, ContactInfo } from '../../models/screening.model';
import { Router } from '@angular/router';
import { OptInService } from '../../services/optin.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent {
  // 👇 ahora opcionales; si no llegan por @Input, los tomamos del Router state
  @Input() riskAssessment?: RiskAssessment;
  @Input() respondentId?: number;
  @Input() screeningId?: number;

  @Output() reset = new EventEmitter<void>();
  @ViewChild('contactForm') contactForm?: NgForm;

  constructor(private router: Router, private optin: OptInService) {}

  showContactForm = false;
  contactInfo: ContactInfo = { email: '', phone: '' };
  consentimiento = true;
  loading = false;
  contactSubmitted = false;
  errorMsg = '';

  ngOnInit(): void {
    // 🔹 Completar desde Router state si faltan
    const st = (history.state ?? {}) as any;
    if (!this.respondentId && st?.respondentId) this.respondentId = st.respondentId;
    if (!this.screeningId  && st?.screeningId)  this.screeningId  = st.screeningId;
    if (!this.riskAssessment && st?.risk)       this.riskAssessment = st.risk as RiskAssessment;

    if (this.riskAssessment?.requiresContact) this.showContactForm = true;
  }

  getRiskColor(): string {
    switch (this.riskAssessment?.riskLevel) {
      case 'low': return '#4CAF50';
      case 'moderate': return '#FF9800';
      case 'high': return '#F44336';
      default: return '#999';
    }
  }

  getRiskLabel(): string {
    switch (this.riskAssessment?.riskLevel) {
      case 'low': return 'Riesgo Bajo';
      case 'moderate': return 'Riesgo Moderado';
      case 'high': return 'Riesgo Alto';
      default: return 'Desconocido';
    }
  }
  get recommendationText(): string {
    return this.riskAssessment?.recommendation ?? '—';
    }

  submitContactInfo(): void {
    this.errorMsg = '';
    if (!this.contactInfo.email || !this.contactInfo.phone || !this.consentimiento) {
      this.errorMsg = 'Completa email, teléfono y consentimiento.';
      return;
    }
    if (!this.respondentId || !this.screeningId) {
      this.errorMsg = 'Faltan IDs de screening; realiza el cuestionario primero.';
      return;
    }

    this.loading = true;
    this.optin.send({
      respondentId: this.respondentId!,   // ya validado arriba
      screeningId: this.screeningId!,
      telefono: this.contactInfo.phone,
      email: this.contactInfo.email,
      consentimiento: this.consentimiento,
      contexto: { canal: 'web' },
    }).subscribe({
      next: () => {
        this.contactForm?.resetForm({ consentimiento: true });
        this.contactInfo = { email: '', phone: '' };
        this.consentimiento = true;

        this.contactSubmitted = true;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.error ?? 'Error al enviar el contacto.';
        console.error('opt-in error', err);
      }
    });
  }

  resetForm(): void { this.reset.emit(); }
  startOver(): void { this.router.navigate(['/welcome']); this.resetForm(); }
}
