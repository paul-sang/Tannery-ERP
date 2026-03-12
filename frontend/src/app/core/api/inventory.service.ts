import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  current_page: number;
  total_pages: number;
  page_size: number;
  results: T[];
}

export interface UOM {
  id: number;
  name: string;
  abbreviation: string;
}

export interface Item {
  id: number;
  sku: string;
  name: string;
  category: number;
  category_details: any;
  uom: number;
  uom_details: UOM;
  secondary_uom: number | null;
  secondary_uom_details: UOM | null;
  min_stock_level: string;
  status: string;
  attributes: any;
  total_stock?: string | number;
}

export interface StockLot {
  id: number;
  lot_tracking_number: string;
  item_details: Item;
  current_primary_quantity: number;
  current_secondary_quantity: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/inventory`;

  // --- Support Data ---
  getCategories(page: number = 1, pageSize: number = 10): Observable<PaginatedResponse<any>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    return this.http.get<PaginatedResponse<any>>(`${this.apiUrl}/categories/`, { params });
  }

  getNextSku(categoryId: number): Observable<{next_sku: string}> {
    return this.http.get<{next_sku: string}>(`${this.apiUrl}/categories/${categoryId}/next_sku/`);
  }

  getUoms(page: number = 1, pageSize: number = 10): Observable<PaginatedResponse<UOM>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
    return this.http.get<PaginatedResponse<UOM>>(`${this.apiUrl}/uom/`, { params });
  }

  // --- Items ---
  getItems(page: number = 1, pageSize: number = 10, search?: string, category?: string, ordering?: string): Observable<PaginatedResponse<Item>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
      
    if (search) {
      params = params.set('search', search);
    }
    if (category) {
      params = params.set('category', category);
    }
    if (ordering) {
      params = params.set('ordering', ordering);
    }
    return this.http.get<PaginatedResponse<Item>>(`${this.apiUrl}/items/`, { params });
  }

  createItem(data: Partial<Item>): Observable<Item> {
    return this.http.post<Item>(`${this.apiUrl}/items/`, data);
  }

  updateItem(id: number, data: Partial<Item>): Observable<Item> {
    return this.http.patch<Item>(`${this.apiUrl}/items/${id}/`, data);
  }

  getItemStockReport(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/items/${id}/stock_report/`);
  }

  // --- Stock Lots ---
  getStockLots(page: number = 1, pageSize: number = 10, itemId?: number, search?: string, ordering?: string): Observable<PaginatedResponse<StockLot>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('page_size', pageSize.toString());
      
    if (itemId) {
      params = params.set('item', itemId);
    }
    if (search) {
      params = params.set('search', search);
    }
    if (ordering) {
      params = params.set('ordering', ordering);
    }
    return this.http.get<PaginatedResponse<StockLot>>(`${this.apiUrl}/lots/`, { params });
  }

  createStockLot(data: any): Observable<StockLot> {
    return this.http.post<StockLot>(`${this.apiUrl}/lots/`, data);
  }
}
