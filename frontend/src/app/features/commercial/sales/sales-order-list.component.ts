import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesService, SalesOrder } from '../../../core/api/sales.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { SalesFormComponent } from './sales-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OffcanvasComponent } from '../../../shared/components/offcanvas/offcanvas.component';

@Component({
  selector: 'app-sales-order-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, SalesFormComponent, OffcanvasComponent],
  templateUrl: './sales-order-list.component.html'
})
export class SalesOrderListComponent implements OnInit {
  private salesService = inject(SalesService);
  private toastService = inject(ToastService);

  orders = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);
  isFilterOpen = signal<boolean>(false);

  // Pagination State
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Search State
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  // Filter State
  filterStatusControl = new FormControl('');
  activeStatusFilter = signal<string>('');
  statusOptions = ['DRAFT', 'CONFIRMED', 'SHIPPED', 'INVOICED'];

  // Sorting State
  activeOrdering = signal<string>('');

  tableColumns: TableColumn[] = [
    { key: 'so_number', label: 'SO Number', sortable: true },
    { key: 'customer_name', label: 'Customer' },
    { key: 'order_date', label: 'Order Date', sortable: true },
    { key: 'expected_dispatch', label: 'Expected Dispatch', sortable: true },
    { key: 'total_amount_formatted', label: 'Total Amount', sortable: true, sortKey: 'total_amount' },
    { key: 'status_badge', label: 'Status', type: 'badge' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchOrders();
    });

    this.fetchOrders();
  }

  fetchOrders() {
    this.isLoading.set(true);
    // getOrders signature: (page, pageSize, status, search, ordering)
    this.salesService.getOrders(this.currentPage(), this.pageSize(), this.activeStatusFilter(), this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((order: SalesOrder) => ({
          ...order,
          customer_name: order.customer.name,
          total_amount_formatted: `$${order.total_amount}`,
          status_badge: order.status
        }));
        this.orders.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load Sales Orders.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.toastService.success('Order Selected', `Viewing details for ${row.so_number}`);
  }

  openForm() {
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  openFilters() {
    this.isFilterOpen.set(true);
  }

  closeFilters() {
    this.isFilterOpen.set(false);
  }

  applyFilters() {
    this.activeStatusFilter.set(this.filterStatusControl.value || '');
    this.currentPage.set(1);
    this.fetchOrders();
    this.closeFilters();
  }

  clearFilters() {
    this.filterStatusControl.setValue('');
    this.activeStatusFilter.set('');
    this.currentPage.set(1);
    this.fetchOrders();
    this.closeFilters();
  }

  onOrderSaved() {
    this.fetchOrders(); // Refresh table
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchOrders();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchOrders();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchOrders();
  }
}
