import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ProductionService, ProductionBatch, ProductionStage, ProductionProcess } from '../../../core/api/production.service';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { OffcanvasComponent } from '../../../shared/components/offcanvas/offcanvas.component';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-batch-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, OffcanvasComponent],
  templateUrl: './batch-list.component.html'
})
export class BatchListComponent implements OnInit {
  private productionService = inject(ProductionService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private http = inject(HttpClient);

  batches = signal<any[]>([]);
  isLoading = signal<boolean>(true);

  totalItems = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  searchControl = new FormControl('');
  searchQuery = signal<string>('');
  activeOrdering = signal<string>('');
  activeStatus = signal<string>('');

  // Filters
  isFilterOpen = signal<boolean>(false);
  stages = signal<ProductionStage[]>([]);
  processesList = signal<ProductionProcess[]>([]);
  managers = signal<any[]>([]);
  
  filterStageControl = new FormControl('');
  filterProcessControl = new FormControl('');
  filterManagerControl = new FormControl('');

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
    this.fetchStages();
    this.fetchProcessesList();
    this.fetchManagers();
    
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

  fetchStages() {
    this.productionService.getStages(1, 100).subscribe(res => this.stages.set(res.results));
  }

  fetchProcessesList() {
    this.productionService.getProcesses(1, 100).subscribe(res => this.processesList.set(res.results));
  }

  fetchManagers() {
    this.http.get<any>(`${environment.apiUrl}/users/`).subscribe({
      next: (res) => {
        // Users endpoint usually returns { count, next, previous, results } for paginated data
        const userList = res.results || res; 
        this.managers.set(userList);
      },
      error: () => console.error('Could not load users')
    });
  }

  setStatusFilter(status: string) {
    this.activeStatus.set(status);
    this.currentPage.set(1);
    this.fetchBatches();
  }

  fetchBatches() {
    this.isLoading.set(true);
    
    const stage = this.filterStageControl.value || undefined;
    const process = this.filterProcessControl.value || undefined;
    const manager = this.filterManagerControl.value || undefined;
    
    this.productionService.getBatches(
      this.currentPage(), this.pageSize(),
      this.activeStatus() || undefined,
      this.searchQuery() || undefined,
      this.activeOrdering() || undefined,
      stage,
      process,
      manager
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

  openForm() { this.router.navigate(['/production/batches/new']); }

  onPageChange(page: number) { this.currentPage.set(page); this.fetchBatches(); }
  onPageSizeChange(size: number) { this.pageSize.set(size); this.currentPage.set(1); this.fetchBatches(); }
  onSort(event: { column: string, direction: 'asc' | 'desc' }) {
    this.activeOrdering.set(`${event.direction === 'desc' ? '-' : ''}${event.column}`);
    this.currentPage.set(1);
    this.fetchBatches();
  }

  openFilters() { this.isFilterOpen.set(true); }
  closeFilters() { this.isFilterOpen.set(false); }

  applyFilters() {
    this.currentPage.set(1);
    this.fetchBatches();
    this.closeFilters();
  }

  clearFilters() {
    this.filterStageControl.setValue('');
    this.filterProcessControl.setValue('');
    this.filterManagerControl.setValue('');
    this.currentPage.set(1);
    this.fetchBatches();
    this.closeFilters();
  }
}
