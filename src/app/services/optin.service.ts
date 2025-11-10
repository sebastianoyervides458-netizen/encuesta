// optin.service.ts
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OptInService {
  constructor(private http: HttpClient) {}

  send(payload: {
    respondentId: number;
    screeningId: number;
    nombre?: string;
    telefono?: string;
    email: string;
    consentimiento: boolean;
    contexto?: any;
  }) {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(environment.optinUrl, payload, { headers });
  }
}
