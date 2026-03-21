import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Item, PaginatedResponse } from './inventory.service';

export interface ProductionStage {
  id: number;
  name: string;
  sequence_order: number;
}

export interface ProcessInput {
  id?: number;
  process?: number;
  item: number;
  item_details?: Item;
  expected_percentage: number | null;
}

export interface ProcessOutput {
  id?: number;
  process?: number;
  item: number;
  item_details?: Item;
  expected_yield_percentage: number | null;
}

export interface ProcessChemical {
  id?: number;
  process?: number;
  item?: number | null;
  item_details?: Item;
  instruction?: string | null;
  quantity_percentage?: number | null;
  sequence_order: number;
  ph_target: number | null;
  temperature_celsius: number | null;
  duration_minutes: number;
}

export interface ProductionProcess {
  id: number;
  name: string;
  stage: number;
  stage_name?: string;
  description: string;
  is_active: boolean;
  expected_inputs: ProcessInput[];
  expected_outputs: ProcessOutput[];
  chemicals: ProcessChemical[];
}

export interface ProductionBatch {
  id: number;
  batch_number: string;
  process: number;
  process_name?: string;
  stage_name?: string;
  base_weight?: string;
  quantity_hides?: number;
  start_date: string;
  end_date: string | null;
  status: string;
  manager: number | null;
  manager_name?: string;
  notes: string;
}

export interface BatchSummary {
  batch: ProductionBatch;
  recipe: ProductionProcess;
  consumption_documents: any[];
  output_documents: any[];
  total_consumption_docs: number;
  total_output_docs: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/production`;

  // --- Stages ---
  getStages(page: number = 1, pageSize: number = 50): Observable<PaginatedResponse<ProductionStage>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    return this.http.get<PaginatedResponse<ProductionStage>>(`${this.apiUrl}/stages/`, { params });
  }

  // --- Processes (Recipes) ---
  getProcesses(page: number = 1, pageSize: number = 10, search?: string, ordering?: string, stage?: string, isActive?: string): Observable<PaginatedResponse<ProductionProcess>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);
    if (stage) params = params.set('stage', stage);
    if (isActive) params = params.set('is_active', isActive);
    return this.http.get<PaginatedResponse<ProductionProcess>>(`${this.apiUrl}/processes/`, { params });
  }

  getProcess(id: number): Observable<ProductionProcess> {
    return this.http.get<ProductionProcess>(`${this.apiUrl}/processes/${id}/`);
  }

  createProcess(data: any): Observable<ProductionProcess> {
    return this.http.post<ProductionProcess>(`${this.apiUrl}/processes/`, data);
  }

  updateProcess(id: number, data: any): Observable<ProductionProcess> {
    return this.http.put<ProductionProcess>(`${this.apiUrl}/processes/${id}/`, data);
  }

  // --- Batches ---
  getBatches(page: number = 1, pageSize: number = 10, status?: string, search?: string, ordering?: string, stage?: string, process?: string, manager?: string): Observable<PaginatedResponse<ProductionBatch>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);
    if (stage) params = params.set('process__stage', stage);
    if (process) params = params.set('process', process);
    if (manager) params = params.set('manager', manager);
    return this.http.get<PaginatedResponse<ProductionBatch>>(`${this.apiUrl}/batches/`, { params });
  }

  getBatch(id: number): Observable<ProductionBatch> {
    return this.http.get<ProductionBatch>(`${this.apiUrl}/batches/${id}/`);
  }

  createBatch(data: any): Observable<ProductionBatch> {
    return this.http.post<ProductionBatch>(`${this.apiUrl}/batches/`, data);
  }

  updateBatch(id: number, data: any): Observable<ProductionBatch> {
    return this.http.patch<ProductionBatch>(`${this.apiUrl}/batches/${id}/`, data);
  }

  // --- Batch Actions ---
  consumeBatch(batchId: number, lines: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/batches/${batchId}/consume/`, { lines });
  }

  produceBatch(batchId: number, lines: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/batches/${batchId}/produce/`, { lines });
  }

  batchSummary(batchId: number): Observable<BatchSummary> {
    return this.http.get<BatchSummary>(`${this.apiUrl}/batches/${batchId}/summary/`);
  }

  updateBatchStatus(batchId: number, status: string, revert_inventory: boolean = false): Observable<ProductionBatch> {
    return this.http.patch<ProductionBatch>(`${this.apiUrl}/batches/${batchId}/update_status/`, { status, revert_inventory });
  }
}
