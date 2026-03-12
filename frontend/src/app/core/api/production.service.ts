import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Item, PaginatedResponse } from './inventory.service';

export interface ProductionStage {
  id: number;
  name: string;
  order: number;
  description: string;
}

export interface ProductionProcess {
  id: number;
  code: string;
  name: string;
  stage: ProductionStage;
  target_item: Item | null;
  approximate_duration_hours: number;
  is_active: boolean;
}

export interface ProductionBatch {
  id: number;
  batch_number: string;
  process: ProductionProcess;
  status: string;
  started_at: string | null;
  expected_completion: string | null;
  completed_at: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/production`;

  // --- Support Data ---
  getStages(): Observable<ProductionStage[]> {
    return this.http.get<ProductionStage[]>(`${this.apiUrl}/stages/`);
  }

  // --- Processes (Recipes) ---
  getProcesses(page: number = 1, pageSize: number = 10, search?: string, ordering?: string): Observable<PaginatedResponse<ProductionProcess>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
      
    if (search) {
      params = params.set('search', search);
    }
    if (ordering) {
      params = params.set('ordering', ordering);
    }
    return this.http.get<PaginatedResponse<ProductionProcess>>(`${this.apiUrl}/processes/`, { params });
  }

  createProcess(data: Partial<ProductionProcess>): Observable<ProductionProcess> {
    return this.http.post<ProductionProcess>(`${this.apiUrl}/processes/`, data);
  }

  // --- Batches ---
  getBatches(page: number = 1, pageSize: number = 10, status?: string, search?: string, ordering?: string): Observable<PaginatedResponse<ProductionBatch>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
      
    if (status) {
      params = params.set('status', status);
    }
    if (search) {
      params = params.set('search', search);
    }
    if (ordering) {
      params = params.set('ordering', ordering);
    }
    return this.http.get<PaginatedResponse<ProductionBatch>>(`${this.apiUrl}/batches/`, { params });
  }

  createBatch(data: Partial<ProductionBatch>): Observable<ProductionBatch> {
    return this.http.post<ProductionBatch>(`${this.apiUrl}/batches/`, data);
  }
}
