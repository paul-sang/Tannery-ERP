import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchasesService, Supplier } from '../../../../core/api/purchases.service';
import { DataTableComponent, TableColumn } from '../../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../../core/services/toast.service';
import { SupplierFormComponent } from '../supplier-form/supplier-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, SupplierFormComponent],
  templateUrl: './supplier-list.component.html'
})
export class SupplierListComponent implements OnInit {
  private purchasesService = inject(PurchasesService);
  private toastService = inject(ToastService);

  suppliers = signal<Supplier[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);

  selectedSupplierForEdit: Supplier | null = null;

  // Pagination State
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Search State
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  // Sorting
  activeOrdering = signal<string>('');

  tableColumns: TableColumn[] = [
    { key: 'name', label: 'Company Name', sortable: true },
    { key: 'tax_id', label: 'Tax ID' },
    { key: 'contact_info', label: 'Contact Info' },
    { key: 'actions', label: 'Actions', type: 'action' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchSuppliers();
    });

    this.fetchSuppliers();
  }

  fetchSuppliers() {
    this.isLoading.set(true);
    // getSuppliers signature: (page, pageSize, search, ordering)
    this.purchasesService.getSuppliers(this.currentPage(), this.pageSize(), this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        this.suppliers.set(response.results);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load Suppliers.');
        this.isLoading.set(false);
      }
    });
  }

  handleTableAction(event: { action: string, row: any }) {
    if (event.action === 'edit') {
      this.selectedSupplierForEdit = event.row;
      this.isFormOpen.set(true);
    } else if (event.action === 'delete') {
      if (confirm(`Are you sure you want to delete supplier ${event.row.name}?`)) {
        this.purchasesService.deleteSupplier(event.row.id).subscribe({
          next: () => {
            this.toastService.success('Deleted', 'Supplier removed entirely.');
            this.fetchSuppliers();
          },
          error: () => this.toastService.error('Error', 'Cannot delete supplier (likely linked to Purchase Orders).')
        });
      }
    }
  }

  openCreateForm() {
    this.selectedSupplierForEdit = null;
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  onSupplierSaved() {
    this.fetchSuppliers();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchSuppliers();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchSuppliers();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchSuppliers();
  }
}
