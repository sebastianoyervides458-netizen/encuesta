import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RiskAssessment, ContactInfo } from '../../models/screening.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent {
  @Input() riskAssessment!: RiskAssessment;
  @Output() reset = new EventEmitter<void>();

  constructor(private router: Router) {}

  showContactForm = false;
  contactInfo: ContactInfo = { email: '', phone: '' };
  contactSubmitted = false;

  getRiskColor(): string {
    switch (this.riskAssessment.riskLevel) {
      case 'low':
        return '#4CAF50';
      case 'moderate':
        return '#FF9800';
      case 'high':
        return '#F44336';
      default:
        return '#999';
    }
  }

  getRiskLabel(): string {
    switch (this.riskAssessment.riskLevel) {
      case 'low':
        return 'Riesgo Bajo';
      case 'moderate':
        return 'Riesgo Moderado';
      case 'high':
        return 'Riesgo Alto';
      default:
        return 'Desconocido';
    }
  }

  ngOnInit(): void {
    if (this.riskAssessment.requiresContact) {
      this.showContactForm = true;
    }
  }

  submitContactInfo(): void {
    if (this.contactInfo.email && this.contactInfo.phone) {
      this.contactSubmitted = true;
      // Here you would typically send this data to your backend
      console.log('Contact Info Submitted:', this.contactInfo);
    }
  }

  resetForm(): void {
    this.reset.emit();
  }

  startOver(): void {
    this.router.navigate(["/welcome"]);
    this.resetForm();
  }
}