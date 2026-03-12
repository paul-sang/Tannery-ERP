import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { PaginatedResponse } from './inventory.service';

export interface Customer {
  id: number;
  name: string;
  code: string;
}

export interface SalesOrder {
  id: number;
  so_number: string;
  customer: Customer;
  order_date: string;
  expected_dispatch: string | null;
  status: string;
  total_amount: string;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/sales`;

  // --- Customers ---
  getCustomers(page: number = 1, pageSize: number = 10, search?: string): Observable<PaginatedResponse<Customer>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<Customer>>(`${this.apiUrl}/customers/`, { params });
  }

  // --- Sales Orders ---
  getOrders(page: number = 1, pageSize: number = 10, status?: string, search?: string, ordering?: string): Observable<PaginatedResponse<SalesOrder>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    if (ordering) params = params.set('ordering', ordering);
    return this.http.get<PaginatedResponse<SalesOrder>>(`${this.apiUrl}/orders/`, { params });
  }

  createOrder(data: Partial<SalesOrder>): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(`${this.apiUrl}/orders/`, data);
  }
}
