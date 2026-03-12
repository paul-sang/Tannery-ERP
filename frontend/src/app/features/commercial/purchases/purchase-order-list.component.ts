import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchasesService, PurchaseOrder } from '../../../core/api/purchases.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { PurchaseFormComponent } from './purchase-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OffcanvasComponent } from '../../../shared/components/offcanvas/offcanvas.component';

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, PurchaseFormComponent, OffcanvasComponent],
  templateUrl: './purchase-order-list.component.html'
})
export class PurchaseOrderListComponent implements OnInit {
  private purchasesService = inject(PurchasesService);
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

  // Sorting State
  activeOrdering = signal<string>('');

  // Filter State
  filterStatusControl = new FormControl('');
  activeStatusFilter = signal<string>('');
  statusOptions = ['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'];

  tableColumns: TableColumn[] = [
    { key: 'po_number', label: 'PO Number', sortable: true },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'order_date', label: 'Order Date', sortable: true },
    { key: 'expected_delivery', label: 'Expected Delivery', sortable: true },
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
    this.purchasesService.getOrders(this.currentPage(), this.pageSize(), this.activeStatusFilter(), this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((order: PurchaseOrder) => ({
          ...order,
          supplier_name: order.supplier_details?.company_name || 'Unknown',
          total_amount_formatted: `$${order.total_amount}`,
          status_badge: order.status
        }));
        this.orders.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load Purchase Orders.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.toastService.success('Order Selected', `Viewing details for ${row.po_number}`);
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
