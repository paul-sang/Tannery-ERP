import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { PaginatedResponse } from './inventory.service';

export interface Supplier {
  id?: number;
  name: string;
  contact_info: string;
  tax_id: string;
}

export interface PurchaseOrderDetail {
  id?: number;
  purchase_order?: number;
  item: number;
  item_details?: any; // Nested representation
  quantity: string | number;
  secondary_quantity?: string | number | null;
  unit_price: string | number;
}

export interface PurchaseOrder {
  id?: number;
  order_number: string;
  supplier: number;
  supplier_name?: string;
  order_date?: string;
  status: 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  total_amount?: string | number;
  details?: PurchaseOrderDetail[];
}

@Injectable({
  providedIn: 'root'
})
export class PurchasesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/purchases`;

  // --- Suppliers ---
  getSuppliers(page: number = 1, pageSize: number = 10, search?: string, ordering?: string): Observable<PaginatedResponse<Supplier>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);
    
    return this.http.get<PaginatedResponse<Supplier>>(`${this.apiUrl}/suppliers/`, { params });
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiUrl}/suppliers/${id}/`);
  }

  createSupplier(data: Supplier): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.apiUrl}/suppliers/`, data);
  }

  updateSupplier(id: number, data: Partial<Supplier>): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.apiUrl}/suppliers/${id}/`, data);
  }

  deleteSupplier(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/suppliers/${id}/`);
  }

  // --- Purchase Orders ---
  getOrders(page: number = 1, pageSize: number = 10, status?: string, search?: string, ordering?: string): Observable<PaginatedResponse<PurchaseOrder>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());

    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);
    
    return this.http.get<PaginatedResponse<PurchaseOrder>>(`${this.apiUrl}/orders/`, { params });
  }

  getOrder(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.apiUrl}/orders/${id}/`);
  }

  createOrder(data: PurchaseOrder): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.apiUrl}/orders/`, data);
  }

  updateOrder(id: number, data: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.apiUrl}/orders/${id}/`, data);
  }

  deleteOrder(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/orders/${id}/`);
  }
}
