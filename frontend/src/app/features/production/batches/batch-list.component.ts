import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  batches = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  isFormOpen = signal<boolean>(false);

  // Pagination State
  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);

  // Search State
  searchControl = new FormControl('');
  searchQuery = signal<string>('');

  // Sorting State
  activeOrdering = signal<string>('');

  tableColumns: TableColumn[] = [
    { key: 'batch_number', label: 'Batch ID', sortable: true },
    { key: 'process_name', label: 'Recipe' },
    { key: 'stage_name', label: 'Current Stage' },
    { key: 'started_at_formatted', label: 'Started At', sortable: true, sortKey: 'started_at' },
    { key: 'expected_completion_formatted', label: 'Expected End', sortable: true, sortKey: 'expected_completion' },
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

  fetchBatches() {
    this.isLoading.set(true);
    // getBatches signature is (page, pageSize, status, search, ordering)
    this.productionService.getBatches(this.currentPage(), this.pageSize(), undefined, this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((batch: ProductionBatch) => {
          
          const formatDate = (dateStr: string | null) => {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
          };

          return {
            ...batch,
            process_name: batch.process.name,
            stage_name: batch.process.stage.name,
            started_at_formatted: formatDate(batch.started_at),
            expected_completion_formatted: formatDate(batch.expected_completion),
            status_badge: batch.status
          };
        });
        this.batches.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load active Production Batches.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.toastService.success('Batch Selected', `Loading Execution view for ${row.batch_number}`);
  }

  openForm() {
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  onBatchSaved() {
    this.fetchBatches(); // Refresh table
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchBatches();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchBatches();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchBatches();
  }
}
