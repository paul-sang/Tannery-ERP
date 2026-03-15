import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductionService, ProductionBatch } from '../../../core/api/production.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { BatchFormComponent } from './batch-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, BatchFormComponent],
  templateUrl: './batch-list.component.html'
})
export class BatchListComponent implements OnInit {
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  batches = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);

  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchControl = new FormControl('');
  searchQuery = signal<string>('');
  activeOrdering = signal<string>('');
  activeStatus = signal<string>('');

  statusTabs = [
    { key: '', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'QA_HOLD', label: 'QA Hold' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' }
  ];

  tableColumns: TableColumn[] = [
    { key: 'batch_number', label: 'Batch ID', sortable: true },
    { key: 'process_name', label: 'Recipe' },
    { key: 'stage_name', label: 'Stage' },
    { key: 'start_date_formatted', label: 'Started', sortable: true, sortKey: 'start_date' },
    { key: 'manager_name', label: 'Manager' },
    { key: 'status_badge', label: 'Status', type: 'badge' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchBatches();
    });
    this.fetchBatches();
  }

  setStatusFilter(status: string) {
    this.activeStatus.set(status);
    this.currentPage.set(1);
    this.fetchBatches();
  }

  fetchBatches() {
    this.isLoading.set(true);
    this.productionService.getBatches(
      this.currentPage(), this.pageSize(),
      this.activeStatus() || undefined,
      this.searchQuery() || undefined,
      this.activeOrdering() || undefined
    ).subscribe({
      next: (response) => {
        const mappedData = response.results.map((batch: ProductionBatch) => ({
          ...batch,
          start_date_formatted: batch.start_date ? new Date(batch.start_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-',
          status_badge: batch.status.replace('_', ' ')
        }));
        this.batches.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error('Connection Error', 'Failed to load Production Batches.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.router.navigate(['/production/batches', row.id]);
  }

  openForm() { this.isFormOpen.set(true); }
  closeForm() { this.isFormOpen.set(false); }
  onBatchSaved() { this.fetchBatches(); }

  onPageChange(page: number) { this.currentPage.set(page); this.fetchBatches(); }
  onPageSizeChange(size: number) { this.pageSize.set(size); this.currentPage.set(1); this.fetchBatches(); }
  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    this.activeOrdering.set(`${event.direction === 'desc' ? '-' : ''}${event.column}`);
    this.currentPage.set(1);
    this.fetchBatches();
  }
}
