import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductionService, ProductionProcess } from '../../../core/api/production.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { ProcessFormComponent } from './process-form.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-process-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, ProcessFormComponent],
  templateUrl: './process-list.component.html'
})
export class ProcessListComponent implements OnInit {
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);

  processes = signal<any[]>([]);
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
    { key: 'code', label: 'Process Code', sortable: true },
    { key: 'name', label: 'Recipe Name', sortable: true },
    { key: 'stage_name', label: 'Production Stage' },
    { key: 'target_item_name', label: 'Target Output' },
    { key: 'duration', label: 'Duration (Hrs)', sortable: true, sortKey: 'approximate_duration_hours' },
    { key: 'status_badge', label: 'Status', type: 'badge' }
  ];

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.searchQuery.set(value || '');
      this.currentPage.set(1);
      this.fetchProcesses();
    });

    this.fetchProcesses();
  }

  fetchProcesses() {
    this.isLoading.set(true);
    this.productionService.getProcesses(this.currentPage(), this.pageSize(), this.searchQuery(), this.activeOrdering()).subscribe({
      next: (response) => {
        const mappedData = response.results.map((proc: ProductionProcess) => ({
          ...proc,
          stage_name: proc.stage.name,
          target_item_name: proc.target_item ? proc.target_item.name : 'Intermediate',
          duration: `${proc.approximate_duration_hours}h`,
          status_badge: proc.is_active ? 'Active' : 'Archived'
        }));
        this.processes.set(mappedData as any);
        this.totalItems.set(response.count);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.toastService.error('Connection Error', 'Failed to load Production Recipes.');
        this.isLoading.set(false);
      }
    });
  }

  onRowClick(row: any) {
    this.toastService.success('Recipe Selected', `Opening formulation for ${row.name}`);
  }

  openForm() {
    this.isFormOpen.set(true);
  }

  closeForm() {
    this.isFormOpen.set(false);
  }

  onProcessSaved() {
    this.fetchProcesses();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.fetchProcesses();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.fetchProcesses();
  }

  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    const orderPrefix = event.direction === 'desc' ? '-' : '';
    this.activeOrdering.set(`${orderPrefix}${event.column}`);
    this.currentPage.set(1);
    this.fetchProcesses();
  }
}
